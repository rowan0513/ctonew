const crypto = require('crypto');

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\b(?:(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4})\b/g;

const hashValue = (value = '') => {
  const normalized = value.toString();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
};

const buildPlaceholder = (value) => `[[hash:${hashValue(value)}]]`;

const maskEmails = (input) =>
  input.replace(EMAIL_REGEX, (match) => buildPlaceholder(match.trim().toLowerCase())) || input;

const normalizePhone = (input) => input.replace(/[^\d]/g, '');

const maskPhoneNumbers = (input) =>
  input.replace(PHONE_REGEX, (match) => {
    const normalized = normalizePhone(match);
    if (normalized.length < 10) {
      return match;
    }

    return buildPlaceholder(normalized);
  });

const maskString = (input) => {
  if (typeof input !== 'string' || input.length === 0) {
    return input;
  }

  let masked = maskEmails(input);
  masked = maskPhoneNumbers(masked);

  return masked;
};

const maskValue = (value, seen = new WeakMap()) => {
  if (typeof value === 'string') {
    return maskString(value);
  }

  if (value instanceof Date) {
    return new Date(value.toISOString());
  }

  if (Buffer.isBuffer(value)) {
    return Buffer.from(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item, seen));
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return seen.get(value);
    }

    const clone = Array.isArray(value) ? [] : {};
    seen.set(value, clone);

    Object.entries(value).forEach(([key, item]) => {
      clone[key] = maskValue(item, seen);
    });

    return clone;
  }

  return value;
};

module.exports = {
  EMAIL_REGEX,
  PHONE_REGEX,
  hashValue,
  maskString,
  maskValue
};
