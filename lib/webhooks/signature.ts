import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_VERSION = "v1";

export const WEBHOOK_SIGNATURE_HEADER = "x-ezchat-signature";
export const WEBHOOK_TIMESTAMP_HEADER = "x-ezchat-timestamp";
export const WEBHOOK_EVENT_HEADER = "x-ezchat-event";

function createSignedPayload(timestamp: string, payload: string): string {
  return `${timestamp}.${payload}`;
}

export function createWebhookSignature(payload: string, secret: string, timestamp: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(createSignedPayload(timestamp, payload));
  const digest = hmac.digest("hex");
  return `${SIGNATURE_VERSION}=${digest}`;
}

export function verifyWebhookSignature(params: {
  payload: string;
  secret: string;
  timestamp: string;
  signature: string | null | undefined;
}): boolean {
  const { payload, secret, timestamp, signature } = params;

  if (!signature) {
    return false;
  }

  const [version, providedDigest] = signature.split("=", 2);

  if (version !== SIGNATURE_VERSION || !providedDigest) {
    return false;
  }

  const expected = createWebhookSignature(payload, secret, timestamp);
  const [, expectedDigest] = expected.split("=", 2);

  const expectedBuffer = Buffer.from(expectedDigest, "hex");
  const providedBuffer = Buffer.from(providedDigest, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}
