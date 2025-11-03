const OpenAI = require('openai');

let openaiClient = null;

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

async function createEmbedding(text, model = 'text-embedding-3-large') {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model,
    input: text,
    encoding_format: 'float'
  });

  const embedding = response.data[0]?.embedding;

  if (!embedding) {
    throw new Error('No embedding returned from OpenAI API');
  }

  return {
    embedding,
    model: response.model,
    usage: {
      promptTokens: response.usage.prompt_tokens,
      totalTokens: response.usage.total_tokens
    }
  };
}

async function createEmbeddingsBatch(texts, model = 'text-embedding-3-large') {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model,
    input: texts,
    encoding_format: 'float'
  });

  return response.data.map(item => ({
    embedding: item.embedding,
    model: response.model,
    usage: {
      promptTokens: response.usage.prompt_tokens / texts.length,
      totalTokens: response.usage.total_tokens / texts.length
    }
  }));
}

module.exports = {
  createEmbedding,
  createEmbeddingsBatch
};
