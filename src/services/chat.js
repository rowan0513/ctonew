const { getLogger } = require('../observability/logger');

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const generateChatResponse = async ({ message, workspaceId, requestId, model = 'gpt-4o-mini' }) => {
  const logger = getLogger({ workspaceId, requestId, model });
  const sanitizedMessage = typeof message === 'string' ? message.trim() : '';

  logger.debug({ event: 'chat.generate.start' }, 'Generating chat response.');

  const artificialLatency = Math.min(150, 25 + sanitizedMessage.length);
  await sleep(artificialLatency);

  const reply = sanitizedMessage
    ? `Echo from ${model}: ${sanitizedMessage}`
    : `Echo from ${model}: (no content provided)`;

  const usage = {
    inputTokens: sanitizedMessage.length,
    outputTokens: reply.length
  };

  logger.info({ event: 'chat.generate.complete', usage }, 'Generated chat response.');

  return {
    reply,
    usage,
    model
  };
};

module.exports = {
  generateChatResponse
};
