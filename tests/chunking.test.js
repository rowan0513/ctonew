const { chunkText, countTokens } = require('../src/utils/textChunker');
const { detectLanguage } = require('../src/utils/languageDetector');

describe('Text Chunking', () => {
  test('should chunk text into segments with overlap', () => {
    const sampleText = 'This is a test document. '.repeat(200);
    
    const chunks = chunkText(sampleText, {
      minTokens: 50,
      maxTokens: 100,
      overlapTokens: 20
    });

    expect(chunks.length).toBeGreaterThan(0);
    
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThanOrEqual(50);
      expect(chunk.tokenCount).toBeLessThanOrEqual(100);
      expect(chunk.text).toBeTruthy();
    }
  });

  test('should produce chunks with proper token counts', () => {
    const text = 'Hello world. This is a test of the chunking system with tiktoken encoding.';
    
    const chunks = chunkText(text, {
      minTokens: 5,
      maxTokens: 15,
      overlapTokens: 3
    });

    for (const chunk of chunks) {
      const actualTokens = countTokens(chunk.text);
      expect(Math.abs(actualTokens - chunk.tokenCount)).toBeLessThanOrEqual(1);
    }
  });
});

describe('Language Detection', () => {
  test('should detect English text', () => {
    const englishText = 'This is a test document in English. The quick brown fox jumps over the lazy dog.';
    const language = detectLanguage(englishText);
    expect(language).toBe('en');
  });

  test('should detect Dutch text', () => {
    const dutchText = 'Dit is een test document in het Nederlands. De snelle bruine vos springt over de luie hond.';
    const language = detectLanguage(dutchText);
    expect(language).toBe('nl');
  });

  test('should default to English for short text', () => {
    const shortText = 'Hi';
    const language = detectLanguage(shortText);
    expect(language).toBe('en');
  });
});
