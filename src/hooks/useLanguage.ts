/**
 * Language preference hook.
 *
 * Single source of truth for the UI language. Two views read/write through
 * this hook today: the top-bar `LanguageSwitcher` and the Settings page
 * `<select>`. They stay in sync because:
 *
 * 1. State lives in `localStorage["gc_user_settings"].language`, the same
 *    key the Settings page already uses (it just used to write it but not
 *    read it back anywhere else).
 * 2. After every change, we dispatch a `gc-language-change` CustomEvent on
 *    `window`. Every component using this hook subscribes to that event
 *    and re-reads `localStorage`, so they all converge to the new value
 *    within the same tick. This is the same pattern the rest of the app
 *    uses for cross-component state that doesn't warrant a Context
 *    (see `useTheme` / shadcn's theme provider).
 *
 * We intentionally do NOT use `i18next` here. Stage 1 of the AI Academic
 * Intelligence plan will install `i18next` + `react-i18next` and translate
 * every UI string; at that point this hook will additionally call
 * `i18next.changeLanguage(lang)`. For now we just persist the choice so
 * the switcher feels real, the Settings page reflects it, and a reload
 * keeps it.
 */
import { useCallback, useEffect, useState } from "react";
import i18n from "@/i18n";

export const SUPPORTED_LANGUAGES = ["en", "hi", "mr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
};

export const LANGUAGE_EVENT = "gc-language-change";
export const SETTINGS_KEY = "gc_user_settings";

const isSupported = (v: unknown): v is SupportedLanguage =>
  typeof v === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);

const readFromStorage = (): SupportedLanguage => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "en";
    const parsed = JSON.parse(raw) as { language?: unknown } | null;
    return isSupported(parsed?.language) ? parsed.language : "en";
  } catch {
    // Corrupt JSON in localStorage shouldn't crash the UI. Fall back to
    // the default; the next `setLanguage` call will overwrite it.
    return "en";
  }
};

const writeToStorage = (lang: SupportedLanguage) => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    parsed.language = lang;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage may be unavailable (private mode, quota). We still
    // keep the in-memory state for the current session so the UI
    // reflects the user's choice; the change just won't survive reload.
  }
};

export function useLanguage(): {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
} {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => readFromStorage());

  // Cross-component sync. When *any* component (top-bar switcher,
  // Settings page) updates the language, every other subscriber should
  // re-read and re-render. We listen to:
  //  - our own CustomEvent (same-tab updates)
  //  - the native `storage` event (other tabs / windows)
  useEffect(() => {
    const sync = () => {
      const next = readFromStorage();
      setLanguageState((prev) => (prev === next ? prev : next));
    };
    window.addEventListener(LANGUAGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANGUAGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    if (!isSupported(lang)) return;
    // Persist *first* so a crash during i18next.changeLanguage still
    // leaves the user's choice intact for the next page load.
    writeToStorage(lang);
    setLanguageState(lang);
    // Tell i18next. This is the one place the bridge between our
    // `localStorage` choice and react-i18next lives. Every component
    // using `useTranslation()` re-renders automatically when this
    // resolves, so the sidebar/topbar/header all flip together.
    // `changeLanguage` returns a promise; we don't await it because
    // resource loading is synchronous in our setup (the three locale
    // files are bundled at startup, not lazy-loaded).
    void i18n.changeLanguage(lang);
    // Fire *after* the write so subscribers that re-read storage see
    // the new value. `setLanguageState` is synchronous; the event
    // doesn't need to wait for it.
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: { language: lang } }));
  }, []);

  return { language, setLanguage };
}
