import { thaiMessages } from "./translations";

export type Language = "th" | "en";
export type Translate = (message: string, values?: Record<string, string | number>) => string;
export const LANGUAGE_KEY = "splitbill_language";

export function translate(language: Language, message: string, values?: Record<string, string | number>) {
  const text = language === "th" ? (thaiMessages[message] ?? message) : message;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => String(values?.[key] ?? match));
}
