const crypto = require('crypto');
const { moderateContent } = require('./moderation');

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB

const SUSPICIOUS_PATTERNS = [
  /password\s*=/i,
  /api[_-]?key/i,
  /secret/i,
  /ssn/i,
  /social\s*security/i,
  /BEGIN( RSA)? PRIVATE KEY/
];

const hashBuffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const scanBufferForPatterns = (buffer) => {
  const asText = buffer.toString('utf8');
  const hits = SUSPICIOUS_PATTERNS.filter((pattern) => pattern.test(asText)).map((pattern) => pattern.toString());
  return {
    hits,
    text: asText
  };
};

const scanFile = async (file, options = {}) => {
  if (!file) {
    const error = new Error('No file provided for scanning.');
    error.statusCode = 400;
    throw error;
  }

  const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || options.maxBytes || DEFAULT_MAX_BYTES);

  const issues = [];

  if (file.buffer.length > maxBytes) {
    issues.push(`File exceeds maximum allowed size of ${maxBytes} bytes.`);
  }

  const { hits, text } = scanBufferForPatterns(file.buffer);
  if (hits.length > 0) {
    issues.push(`Detected sensitive patterns: ${hits.join(', ')}`);
  }

  const moderationEnabled = options.moderationEnabled ?? process.env.MODERATION_ENABLED === 'true';
  let moderationResult = { flagged: false };
  if (moderationEnabled) {
    moderationResult = await moderateContent(
      { text, fileName: file.originalname, mimeType: file.mimetype },
      options.moderationProvider
    );

    if (moderationResult.flagged) {
      issues.push(moderationResult.reason || 'Content moderation flagged the file.');
    }
  }

  return {
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.buffer.length,
    hash: hashBuffer(file.buffer),
    status: issues.length ? 'flagged' : 'clean',
    issues,
    moderation: moderationResult
  };
};

module.exports = {
  scanFile
};
