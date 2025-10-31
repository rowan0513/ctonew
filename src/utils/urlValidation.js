const { URL } = require('url');

const DEFAULT_ALLOWED_HOSTS = ['example.com'];

const getAllowedHosts = () => {
  const envHosts = process.env.CRAWLER_ALLOWED_HOSTS;
  if (!envHosts) {
    return DEFAULT_ALLOWED_HOSTS;
  }

  return envHosts
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
};

const assertSafeUrl = (inputUrl) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(inputUrl);
  } catch (error) {
    const err = new Error('Invalid URL');
    err.statusCode = 400;
    throw err;
  }

  const protocolAllowed = ['https:', 'http:'];
  if (!protocolAllowed.includes(parsedUrl.protocol)) {
    const err = new Error('Unsupported protocol supplied. Only HTTP and HTTPS are allowed.');
    err.statusCode = 400;
    throw err;
  }

  if (parsedUrl.username || parsedUrl.password) {
    const err = new Error('Credentials are not allowed in URLs.');
    err.statusCode = 400;
    throw err;
  }

  const allowedHosts = getAllowedHosts();
  const hostname = parsedUrl.hostname.toLowerCase();

  if (!allowedHosts.includes(hostname)) {
    const err = new Error('Host is not allowed for crawling.');
    err.statusCode = 403;
    throw err;
  }

  return parsedUrl;
};

const safeFetch = async (inputUrl) => {
  const parsedUrl = assertSafeUrl(inputUrl);
  const controller = new AbortController();
  const timeoutInMs = Number(process.env.CRAWLER_TIMEOUT_MS || 5000);

  const timeout = setTimeout(() => controller.abort(), timeoutInMs);

  let response;
  try {
    response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error('Request timed out while fetching remote content.');
      err.statusCode = 504;
      throw err;
    }

    error.statusCode = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const maxBytes = Number(process.env.CRAWLER_MAX_RESPONSE_BYTES || 1024 * 1024); // 1MB
  const stream = response.body;

  if (!stream) {
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: ''
    };
  }

  const reader = stream.getReader();
  let bytesRead = 0;
  const chunks = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytesRead += value.length;
    if (bytesRead > maxBytes) {
      reader.releaseLock();
      const err = new Error('Response size exceeds configured limit.');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(Buffer.from(value));
  }

  const body = Buffer.concat(chunks).toString('utf8');

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body
  };
};

module.exports = {
  assertSafeUrl,
  safeFetch
};
