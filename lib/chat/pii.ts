const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /(?<!\d)(?:\+?\d[\d\s().-]{6,}\d)/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]?){13,19}\b/g;

function maskEmail(match: string): string {
  return "[REDACTED_EMAIL]";
}

function maskPhone(match: string): string {
  return "[REDACTED_PHONE]";
}

function maskCard(match: string): string {
  const digits = match.replace(/\D/g, "");

  if (digits.length < 13 || digits.length > 19) {
    return match;
  }

  const visibleSuffix = digits.slice(-4);
  const maskedPrefix = "*".repeat(digits.length - visibleSuffix.length);
  return `${maskedPrefix}${visibleSuffix}`;
}

export function maskSensitiveData(input: string): string {
  if (!input) {
    return input;
  }

  let masked = input.replace(EMAIL_REGEX, maskEmail);
  masked = masked.replace(PHONE_REGEX, maskPhone);
  masked = masked.replace(CREDIT_CARD_REGEX, maskCard);

  return masked;
}
