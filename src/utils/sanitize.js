const sanitizeHtml = require('sanitize-html');

const RICH_TEXT_ALLOWED_TAGS = [
  'b',
  'i',
  'u',
  'strong',
  'em',
  'p',
  'ul',
  'ol',
  'li',
  'br',
  'span',
  'a'
];

const RICH_TEXT_ALLOWED_ATTRIBUTES = {
  a: ['href', 'title', 'target'],
  span: ['style']
};

const sanitizeRichText = (input) =>
  sanitizeHtml(input || '', {
    allowedTags: RICH_TEXT_ALLOWED_TAGS,
    allowedAttributes: RICH_TEXT_ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' })
    }
  });

const sanitizePlainText = (input = '') => sanitizeRichText(input).replace(/<[^>]+>/g, '');

module.exports = {
  sanitizeRichText,
  sanitizePlainText
};
