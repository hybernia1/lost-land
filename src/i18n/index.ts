import { cs } from "./cs";
import { en } from "./en";
import type { Locale, TranslationPack } from "./types";

const LANGUAGE_KEY = "lost-land.language";

export const packs: Record<Locale, TranslationPack> = {
  cs,
  en,
};

export function loadLocale(): Locale {
  const storedLocale = localStorage.getItem(LANGUAGE_KEY);

  if (storedLocale === "cs" || storedLocale === "en") {
    return storedLocale;
  }

  return "cs";
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(LANGUAGE_KEY, locale);
}
