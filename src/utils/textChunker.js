const { encoding_for_model } = require('tiktoken');

const DEFAULT_OPTIONS = {
  minTokens: 500,
  maxTokens: 1000,
  overlapTokens: 150,
  model: 'gpt-3.5-turbo'
};

function chunkText(text, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const encoding = encoding_for_model(opts.model);

  try {
    const tokens = encoding.encode(text);
    const chunks = [];
    let currentPosition = 0;

    while (currentPosition < tokens.length) {
      const chunkStart = currentPosition;
      let chunkEnd = Math.min(currentPosition + opts.maxTokens, tokens.length);

      const chunkTokens = tokens.slice(chunkStart, chunkEnd);
      const actualTokenCount = chunkTokens.length;

      if (actualTokenCount < opts.minTokens && chunkEnd < tokens.length) {
        chunkEnd = Math.min(chunkStart + opts.minTokens, tokens.length);
      }

      const finalChunkTokens = tokens.slice(chunkStart, chunkEnd);
      const finalChunkText = new TextDecoder().decode(encoding.decode(finalChunkTokens));

      chunks.push({
        text: finalChunkText,
        tokenCount: finalChunkTokens.length,
        startIndex: chunkStart,
        endIndex: chunkEnd
      });

      currentPosition = chunkEnd - opts.overlapTokens;

      if (currentPosition >= tokens.length || chunkEnd === tokens.length) {
        break;
      }
    }

    return chunks;
  } finally {
    encoding.free();
  }
}

function countTokens(text, model = 'gpt-3.5-turbo') {
  const encoding = encoding_for_model(model);
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } finally {
    encoding.free();
  }
}

module.exports = {
  chunkText,
  countTokens
};
