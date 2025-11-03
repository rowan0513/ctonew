type Language = "en" | "nl";

const DUTCH_COMMON_WORDS = [
  "de",
  "het",
  "een",
  "van",
  "in",
  "is",
  "dat",
  "en",
  "te",
  "op",
  "met",
  "voor",
  "zijn",
  "worden",
  "als",
  "om",
  "wordt",
  "naar",
  "er",
  "bij",
  "aan",
  "ook",
  "maar",
  "niet",
  "deze",
  "door",
  "kan",
  "ze",
  "uit",
  "meer",
  "heeft",
  "of",
  "dit",
  "worden",
  "zij",
  "kunnen",
  "moet",
  "worden",
  "welke",
  "andere",
];

const ENGLISH_COMMON_WORDS = [
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
];

const DUTCH_DIGRAPHS = ["ij", "aa", "ee", "oo", "uu", "ou", "ei", "au", "eu", "ui"];

const DUTCH_PATTERNS = [
  /\b(de|het|een|van|voor|naar|met|aan)\b/gi,
  /\b\w+(heid|schap|ing|lijk|tje|je)\b/gi,
  /\b(wordt|kunnen|moeten|zullen|hebben|zijn)\b/gi,
];

export function detectLanguage(text: string): Language {
  const normalized = text.toLowerCase().trim();

  if (!normalized || normalized.length < 10) {
    return "en";
  }

  const words = normalized
    .split(/[\s\p{P}]+/u)
    .filter((word) => word.length > 2)
    .slice(0, 200);

  if (words.length === 0) {
    return "en";
  }

  let dutchScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (DUTCH_COMMON_WORDS.includes(word)) {
      dutchScore += 2;
    }
    if (ENGLISH_COMMON_WORDS.includes(word)) {
      englishScore += 2;
    }
  }

  for (const digraph of DUTCH_DIGRAPHS) {
    const matches = normalized.match(new RegExp(digraph, "g"));
    if (matches) {
      dutchScore += matches.length * 0.5;
    }
  }

  for (const pattern of DUTCH_PATTERNS) {
    const matches = normalized.match(pattern);
    if (matches) {
      dutchScore += matches.length;
    }
  }

  const totalScore = dutchScore + englishScore;
  if (totalScore === 0) {
    return "en";
  }

  return dutchScore > englishScore ? "nl" : "en";
}
