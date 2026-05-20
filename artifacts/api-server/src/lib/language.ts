const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  it: "Italian",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  ja: "Japanese",
  ar: "Arabic",
  zh: "Chinese (Simplified)",
};

export function getLanguageInstruction(lang?: string): string {
  if (!lang || lang === "en") return "";
  const name = LANGUAGE_NAMES[lang];
  if (!name) return "";
  return `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST write ALL text field values in ${name}. This includes every string value in the JSON — descriptions, summaries, plans, insights, copy, labels, and any other human-readable text. JSON keys must remain in English. Numbers remain as numbers. Do NOT use English for any text content.`;
}
