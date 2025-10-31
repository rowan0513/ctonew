const { URL } = require('url');
const { createHash } = require('crypto');
const normalizeUrl = require('normalize-url');
const robotsParser = require('robots-parser');
const { XMLParser } = require('fast-xml-parser');
const cheerio = require('cheerio');
const cld3 = require('cld3-asm');
const {
  ensureCrawlDocument,
  markDocumentCrawlProcessing,
  markDocumentIndexed,
  markDocumentCrawlSkipped,
  markDocumentFailed,
  findDocumentByUrlHash,
  findDocumentByHash,
  DOCUMENT_STATUSES
} = require('./documentStore');
const { safeFetch, assertSafeUrl } = require('../utils/urlValidation');

const DEFAULT_USER_AGENT = 'ctonew-crawler/1.0';
const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class UrlCrawlerService {
  constructor({ fetchImpl } = {}) {
    this.fetchImpl = fetchImpl || safeFetch;
    this.robotsCache = new Map();
    this.rateLimitState = new Map();
    this.userAgent = process.env.CRAWLER_USER_AGENT || DEFAULT_USER_AGENT;
    this.defaultDelayMs = Number(process.env.CRAWLER_DEFAULT_DELAY_MS || 1000);
    this.maxSitemapUrls = Number(process.env.CRAWLER_MAX_SITEMAP_URLS || 50);
    this.maxSitemapDepth = Number(process.env.CRAWLER_MAX_SITEMAP_DEPTH || 2);
    this.maxPageBytes = Number(process.env.CRAWLER_PAGE_MAX_BYTES || 2 * 1024 * 1024);
    this.pageTimeoutMs = Number(process.env.CRAWLER_PAGE_TIMEOUT_MS || 10000);
    this.languageIdentifierPromise = null;
  }

  setFetchImplementation(fn) {
    if (typeof fn === 'function') {
      this.fetchImpl = fn;
    }
  }

  resetCaches() {
    this.robotsCache.clear();
    this.rateLimitState.clear();
    this.languageIdentifierPromise = null;
  }

  async getLanguageIdentifier() {
    if (!this.languageIdentifierPromise) {
      this.languageIdentifierPromise = cld3.loadModule().then((module) => module.create(0, 512));
    }

    return this.languageIdentifierPromise;
  }

  computeHash(value) {
    return createHash('sha256').update(value).digest('hex');
  }

  normalizeUrl(inputUrl) {
    const validated = assertSafeUrl(inputUrl);
    return normalizeUrl(validated.toString(), {
      stripFragment: true,
      removeTrailingSlash: true,
      sortQueryParameters: true,
      defaultProtocol: 'https:'
    });
  }

  async getRobotsParser(targetUrl) {
    const { origin, hostname } = new URL(targetUrl);
    if (this.robotsCache.has(origin)) {
      return this.robotsCache.get(origin);
    }

    const robotsUrl = `${origin}/robots.txt`;
    try {
      const response = await this.fetchImpl(robotsUrl, {
        redirect: 'follow',
        maxBytes: 64 * 1024,
        timeoutMs: 3000,
        userAgent: this.userAgent,
        headers: {
          Accept: 'text/plain, */*'
        }
      });

      if (response.status >= 400 || !response.body) {
        this.robotsCache.set(origin, null);
        return null;
      }

      const parser = robotsParser(robotsUrl, response.body);
      this.robotsCache.set(origin, parser);
      return parser;
    } catch (error) {
      // treat failures as allow-all but cache the miss
      this.robotsCache.set(origin, null);
      return null;
    }
  }

  async isAllowed(url) {
    const parser = await this.getRobotsParser(url);
    if (!parser) {
      return {
        allowed: true,
        crawlDelayMs: this.defaultDelayMs
      };
    }

    const allowed = parser.isAllowed(url, this.userAgent);
    const crawlDelaySeconds = parser.getCrawlDelay(this.userAgent);
    const crawlDelayMs = Number.isFinite(crawlDelaySeconds) ? crawlDelaySeconds * 1000 : this.defaultDelayMs;

    return {
      allowed: allowed !== false,
      crawlDelayMs: Math.max(this.defaultDelayMs, crawlDelayMs || 0)
    };
  }

  async enforceRateLimit(url, requestedDelayMs) {
    const { hostname } = new URL(url);
    const now = Date.now();
    const delayMs = Math.max(this.defaultDelayMs, requestedDelayMs || 0);
    const lastFetch = this.rateLimitState.get(hostname) || 0;
    const waitTime = lastFetch + delayMs - now;

    if (waitTime > 0) {
      await sleep(waitTime);
    }

    this.rateLimitState.set(hostname, Date.now());
  }

  extractContent(baseUrl, html) {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, footer, nav').remove();

    const title = ($('title').text() || $('meta[property="og:title"]').attr('content') || '').trim() || null;

    const canonicalHref = $('link[rel="canonical"][href]').attr('href');
    let canonicalUrl = null;
    if (canonicalHref) {
      try {
        canonicalUrl = new URL(canonicalHref, baseUrl).toString();
      } catch (error) {
        canonicalUrl = null;
      }
    }

    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.post-body'];
    let textContent = '';
    for (const selector of mainSelectors) {
      const node = $(selector);
      if (node && node.length) {
        const candidate = node.text();
        if (candidate && candidate.trim()) {
          textContent = candidate;
          break;
        }
      }
    }

    if (!textContent || !textContent.trim()) {
      textContent = $('body').text() || '';
    }

    const normalizedText = textContent.replace(/\s+/g, ' ').trim();

    return {
      canonicalUrl,
      title,
      text: normalizedText
    };
  }

  async detectLanguage(text) {
    if (!text || text.trim().length < 20) {
      return 'UNKNOWN';
    }

    try {
      const identifier = await this.getLanguageIdentifier();
      const result = identifier.findLanguage(text.slice(0, 4000));
      if (!result || !result.language) {
        return 'UNKNOWN';
      }

      const code = result.language.toLowerCase();
      if (code === 'en') {
        return 'EN';
      }

      if (code === 'nl') {
        return 'NL';
      }

      if (code === 'und') {
        return 'UNKNOWN';
      }

      return code.slice(0, 2).toUpperCase();
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  async expandSitemap(url, depth = 0, collected = new Set(), visited = new Set()) {
    if (collected.size >= this.maxSitemapUrls || depth > this.maxSitemapDepth) {
      return collected;
    }

    const normalized = this.normalizeUrl(url);
    if (visited.has(normalized)) {
      return collected;
    }
    visited.add(normalized);

    let response;
    try {
      response = await this.fetchImpl(normalized, {
        redirect: 'follow',
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 5000,
        userAgent: this.userAgent,
        headers: {
          Accept: 'application/xml,text/xml,application/xhtml+xml;q=0.9,*/*;q=0.8'
        }
      });
    } catch (error) {
      return collected;
    }

    if (response.status >= 400 || !response.body) {
      return collected;
    }

    let parsed;
    try {
      parsed = XML_PARSER.parse(response.body);
    } catch (error) {
      return collected;
    }

    const addUrlCandidate = (candidate) => {
      if (!candidate || collected.size >= this.maxSitemapUrls) {
        return;
      }

      try {
        const absolute = new URL(candidate, normalized).toString();
        const safe = this.normalizeUrl(absolute);
        collected.add(safe);
      } catch (error) {
        // skip malformed URLs
      }
    };

    if (parsed.urlset && parsed.urlset.url) {
      const entries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
      for (const entry of entries) {
        if (collected.size >= this.maxSitemapUrls) {
          break;
        }
        if (entry && entry.loc) {
          addUrlCandidate(entry.loc);
        }
      }
    }

    if (parsed.sitemapindex && parsed.sitemapindex.sitemap && depth < this.maxSitemapDepth) {
      const nested = Array.isArray(parsed.sitemapindex.sitemap)
        ? parsed.sitemapindex.sitemap
        : [parsed.sitemapindex.sitemap];
      for (const sitemapEntry of nested) {
        if (collected.size >= this.maxSitemapUrls) {
          break;
        }
        if (sitemapEntry && sitemapEntry.loc) {
          await this.expandSitemap(sitemapEntry.loc, depth + 1, collected, visited);
        }
      }
    }

    return collected;
  }

  async scheduleSingleCrawl({ workspaceId, url, forceRecrawl = false }) {
    const normalizedTarget = this.normalizeUrl(url);
    const urlHash = this.computeHash(normalizedTarget);

    if (!forceRecrawl) {
      const duplicate = findDocumentByUrlHash(workspaceId, urlHash);
      if (duplicate) {
        return {
          documentId: duplicate.id,
          url: duplicate.canonicalUrl || normalizedTarget,
          status: duplicate.status,
          skipped: true,
          reason: 'duplicate_url'
        };
      }
    }

    const { document, created } = ensureCrawlDocument({
      workspaceId,
      url,
      canonicalUrl: normalizedTarget,
      urlHash
    });

    return {
      documentId: document.id,
      url: normalizedTarget,
      status: DOCUMENT_STATUSES.CRAWL_PENDING,
      created,
      skipped: false
    };
  }

  looksLikeSitemap(url) {
    const lower = url.toLowerCase();
    return lower.endsWith('.xml') || lower.includes('sitemap');
  }

  async scheduleCrawl({ workspaceId, url, forceRecrawl = false }) {
    const results = [];

    if (this.looksLikeSitemap(url)) {
      try {
        const urls = await this.expandSitemap(url);
        if (urls.size > 0) {
          for (const entry of urls) {
            if (results.length >= this.maxSitemapUrls) {
              break;
            }
            try {
              const scheduled = await this.scheduleSingleCrawl({ workspaceId, url: entry, forceRecrawl });
              results.push(scheduled);
            } catch (error) {
              results.push({
                url: entry,
                skipped: true,
                reason: error.message || 'failed_to_schedule'
              });
            }
          }

          return {
            type: 'sitemap',
            results
          };
        }
      } catch (error) {
        // fall back to treating as single URL
      }
    }

    const scheduled = await this.scheduleSingleCrawl({ workspaceId, url, forceRecrawl });
    results.push(scheduled);

    return {
      type: 'url',
      results
    };
  }

  async processJob({ workspaceId, documentId, url }) {
    await markDocumentCrawlProcessing(documentId, workspaceId);

    const { allowed, crawlDelayMs } = await this.isAllowed(url);
    if (!allowed) {
      await markDocumentCrawlSkipped(documentId, workspaceId, 'BlockedByRobots', {
        url
      });
      return {
        status: 'skipped',
        reason: 'BlockedByRobots'
      };
    }

    await this.enforceRateLimit(url, crawlDelayMs);

    let response;
    try {
      response = await this.fetchImpl(url, {
        redirect: 'follow',
        maxBytes: this.maxPageBytes,
        timeoutMs: this.pageTimeoutMs,
        userAgent: this.userAgent,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
    } catch (error) {
      await markDocumentFailed(documentId, workspaceId, error.message || 'FetchFailed');
      throw error;
    }

    if (response.status >= 400) {
      const errorMessage = `HTTP_${response.status}`;
      await markDocumentFailed(documentId, workspaceId, errorMessage);
      return {
        status: 'failed',
        error: errorMessage
      };
    }

    const baseForParsing = response.finalUrl || url;
    const { canonicalUrl, title, text } = this.extractContent(baseForParsing, response.body || '');

    if (!text) {
      await markDocumentFailed(documentId, workspaceId, 'EmptyContent', {
        url: baseForParsing,
        title
      });
      return {
        status: 'failed',
        error: 'EmptyContent'
      };
    }

    const resolvedCanonical = canonicalUrl ? this.normalizeUrl(canonicalUrl) : this.normalizeUrl(baseForParsing);
    const urlHash = this.computeHash(resolvedCanonical);

    const existingForCanonical = findDocumentByUrlHash(workspaceId, urlHash);
    if (existingForCanonical && existingForCanonical.id !== documentId) {
      await markDocumentCrawlSkipped(documentId, workspaceId, 'DuplicateURL', {
        url: resolvedCanonical,
        duplicateOf: existingForCanonical.id
      });
      return {
        status: 'skipped',
        reason: 'DuplicateURL',
        duplicateDocumentId: existingForCanonical.id
      };
    }

    const contentHash = this.computeHash(text);
    const duplicateContent = findDocumentByHash(workspaceId, contentHash);
    if (duplicateContent && duplicateContent.id !== documentId) {
      await markDocumentCrawlSkipped(documentId, workspaceId, 'DuplicateContent', {
        url: resolvedCanonical,
        duplicateOf: duplicateContent.id
      });
      return {
        status: 'skipped',
        reason: 'DuplicateContent',
        duplicateDocumentId: duplicateContent.id
      };
    }

    const language = await this.detectLanguage(text);

    const metadata = {
      source_type: 'url',
      url,
      canonicalUrl: resolvedCanonical,
      finalUrl: baseForParsing,
      title,
      language,
      contentHash
    };

    await markDocumentIndexed(documentId, workspaceId, {
      normalizedText: text,
      metadata,
      hash: contentHash,
      canonicalUrl: resolvedCanonical,
      urlHash,
      mimeType: 'text/html',
      sizeBytes: Buffer.byteLength(text, 'utf8')
    });

    return {
      status: 'indexed',
      documentId,
      canonicalUrl: resolvedCanonical,
      language,
      title
    };
  }
}

const urlCrawlerService = new UrlCrawlerService();

module.exports = {
  UrlCrawlerService,
  urlCrawlerService
};
