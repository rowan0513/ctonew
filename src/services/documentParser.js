const { TextDecoder } = require('util');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { parse: parseCsv } = require('csv-parse/sync');
const { ALLOWED_MIME_TYPES } = require('./mimeDetector');

const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();

const parsePdf = async (buffer) => {
  const result = await pdfParse(buffer);
  return {
    text: result.text.trim(),
    metadata: {
      pages: result.numpages || undefined,
      info: result.info || undefined
    }
  };
};

const parseDocx = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  const text = normalizeWhitespace(result.value || '');
  return {
    text,
    metadata: {
      warnings: result.messages || []
    }
  };
};

const parseTxt = async (buffer) => {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(buffer);
  return {
    text: text.trim(),
    metadata: {
      length: text.length
    }
  };
};

const parseCsvDocument = async (buffer) => {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const raw = decoder.decode(buffer);
  const records = parseCsv(raw, {
    bom: true,
    skip_empty_lines: true
  });

  const lines = records.map((row) => row.join(',')).join('\n');
  return {
    text: lines,
    metadata: {
      rows: records.length
    }
  };
};

const MIME_TO_HANDLER = {
  'application/pdf': parsePdf,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseDocx,
  'text/plain': parseTxt,
  'text/csv': parseCsvDocument
};

const parseDocumentBuffer = async ({ buffer, mimeType }) => {
  if (!buffer) {
    throw new Error('parseDocumentBuffer requires a buffer.');
  }

  if (!mimeType || !MIME_TO_HANDLER[mimeType]) {
    const error = new Error(`Unsupported MIME type for parsing: ${mimeType}`);
    error.code = 'UNSUPPORTED_MIME_TYPE';
    throw error;
  }

  const handler = MIME_TO_HANDLER[mimeType];
  const { text, metadata } = await handler(buffer);

  return {
    text,
    metadata: {
      ...metadata,
      mimeType
    }
  };
};

const getSupportedMimeTypes = () => Object.keys(ALLOWED_MIME_TYPES);

module.exports = {
  getSupportedMimeTypes,
  parseDocumentBuffer
};
