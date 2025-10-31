const DEFAULT_PROVIDER = (process.env.MODERATION_PROVIDER || 'mock').toLowerCase();

const containsSensitiveKeywords = (content = '') => {
  const patterns = [/ssn/i, /password/i, /secret/i, /api[_-]?key/i, /credit\s*card/i];
  return patterns.find((pattern) => pattern.test(content));
};

const mockModeration = async (input) => {
  const match = containsSensitiveKeywords(input.text || '');
  if (match) {
    return {
      flagged: true,
      reason: `Mock moderation flagged pattern: ${match}`
    };
  }

  return { flagged: false };
};

const openAiModeration = async () => {
  if (!process.env.OPENAI_API_KEY) {
    return {
      flagged: false,
      reason: 'OpenAI API key not provided. Moderation skipped.'
    };
  }

  return {
    flagged: false,
    reason: 'OpenAI moderation provider configured but remote call disabled in this environment.'
  };
};

const moderationProviders = {
  none: async () => ({ flagged: false, reason: 'Moderation disabled.' }),
  disabled: async () => ({ flagged: false, reason: 'Moderation disabled.' }),
  mock: mockModeration,
  openai: openAiModeration
};

const moderateContent = async (input, provider = DEFAULT_PROVIDER) => {
  const normalized = (provider || DEFAULT_PROVIDER).toLowerCase();
  const handler = moderationProviders[normalized];

  if (!handler) {
    return moderationProviders.mock(input);
  }

  return handler(input);
};

module.exports = {
  moderateContent
};
