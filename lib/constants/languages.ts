export type LanguageCode = "en" | "pl" | "es" | "it" | "de";

export interface Language {
  value: LanguageCode;
  label: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  { value: "en", label: "English", nativeName: "English" },
  { value: "pl", label: "Polish", nativeName: "Polski" },
  { value: "es", label: "Spanish", nativeName: "Español" },
  { value: "it", label: "Italian", nativeName: "Italiano" },
  { value: "de", label: "German", nativeName: "Deutsch" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function getLanguageLabel(code: LanguageCode): string {
  const lang = LANGUAGES.find((l) => l.value === code);
  return lang?.label ?? "English";
}

export function getLanguageInstruction(code: LanguageCode): string {
  if (code === "en") {
    return "";
  }
  const lang = LANGUAGES.find((l) => l.value === code);
  if (!lang) {
    return "IMPORTANT: Generate all output in the specified language.";
  }
  return `IMPORTANT: Generate all output in ${lang.label} (${lang.nativeName}).`;
}
