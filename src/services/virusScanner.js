const KNOWN_TEST_SIGNATURES = [/EICAR/i, /<script>evil/i];

const scanBufferForViruses = async (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('scanBufferForViruses requires a buffer.');
  }

  const textSample = buffer.toString('utf8');

  const match = KNOWN_TEST_SIGNATURES.find((pattern) => pattern.test(textSample));
  if (match) {
    return {
      clean: false,
      signature: match.toString()
    };
  }

  return {
    clean: true
  };
};

module.exports = {
  scanBufferForViruses
};
