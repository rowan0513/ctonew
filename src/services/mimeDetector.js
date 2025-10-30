const path = require('path');
const { fileTypeFromBuffer } = require('file-type');

const ALLOWED_MIME_TYPES = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'text/plain': ['txt', 'text'],
  'text/csv': ['csv']
};

const allowedMimeSet = new Set(Object.keys(ALLOWED_MIME_TYPES));

const extensionFromName = (fileName) => {
  if (!fileName) {
    return undefined;
  }

  return path.extname(fileName).replace('.', '').toLowerCase();
};

const detectMimeType = async (buffer, fileName) => {
  const typeResult = await fileTypeFromBuffer(buffer);
  if (typeResult && allowedMimeSet.has(typeResult.mime)) {
    return typeResult.mime;
  }

  const extension = extensionFromName(fileName);
  if (!extension) {
    return typeResult ? typeResult.mime : undefined;
  }

  const matchingMime = Object.entries(ALLOWED_MIME_TYPES).find(([, extensions]) => extensions.includes(extension));
  if (matchingMime) {
    return matchingMime[0];
  }

  return typeResult ? typeResult.mime : undefined;
};

const isAllowedMimeType = (mimeType) => allowedMimeSet.has(mimeType);

const getAllowedMimeTypes = () => Array.from(allowedMimeSet.values());

module.exports = {
  ALLOWED_MIME_TYPES,
  detectMimeType,
  getAllowedMimeTypes,
  isAllowedMimeType
};
