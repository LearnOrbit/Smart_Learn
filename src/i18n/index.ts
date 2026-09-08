import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";
import indexEn from "./locales/pages/index/en.json";
import indexHi from "./locales/pages/index/hi.json";
import indexMr from "./locales/pages/index/mr.json";
import authEn from "./locales/pages/auth/en.json";
import authHi from "./locales/pages/auth/hi.json";
import authMr from "./locales/pages/auth/mr.json";
import chatbotEn from "./locales/pages/chatbot/en.json";
import chatbotHi from "./locales/pages/chatbot/hi.json";
import chatbotMr from "./locales/pages/chatbot/mr.json";

const initialLang = (() => {
  try {
    const raw = localStorage.getItem("gc_user_settings");
    if (!raw) return "en";
    const parsed = JSON.parse(raw) as { language?: unknown } | null;
    return parsed?.language === "hi" || parsed?.language === "mr" || parsed?.language === "en"
      ? parsed.language
      : "en";
  } catch {
    return "en";
  }
})();

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { chrome: en, chatbot: chatbotEn, pages: { index: indexEn, auth: authEn, chatbot: chatbotEn } },
      hi: { chrome: hi, chatbot: chatbotHi, pages: { index: indexHi, auth: authHi, chatbot: chatbotHi } },
      mr: { chrome: mr, chatbot: chatbotMr, pages: { index: indexMr, auth: authMr, chatbot: chatbotMr } },
    },
    lng: initialLang,
    fallbackLng: "en",
    // Two namespaces today:
    //   - `chrome`  — sidebar/topbar/common button words
    //   - `pages`   — per-page strings, lazy-loaded as pages mount
    //                  (we use eager `import` for v1 simplicity; can
    //                  switch to backend-loaded later)
    //
    // Per-page keys live under `pages.<pageName>.<key>` so a typo in
    // one page never collides with another. The `missingKeyHandler`
    // below logs the namespace so you can find the offender fast.
    ns: ["chrome", "pages"],
    defaultNS: "chrome",
    interpolation: {
      escapeValue: false,
    },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (_lngs, ns, key) => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] missing key: ${ns}:${key}`);
      }
    },
  });

/**
 * Per-page translation namespaces.
 *
 * Each translated page has a JSON file under `src/i18n/locales/pages/<name>/`
 * with three language variants. To wire a new page:
 *
 *   1. Add `useTranslation("pages")` in the page component.
 *   2. Call `loadPageNamespace("dashboard")` once on mount.
 *   3. Use `t("dashboard:foo.bar")` (or just `t("dashboard.foo.bar")` if
 *      `defaultNS = "pages"` for that component, but we keep the
 *      explicit prefix for grep-ability).
 *
 * Strings fall back to English if a locale is missing the key — so we
 * can ship a page in en-only, switch it to hi, and the page renders in
 * English until a native speaker fills in the hi file.
 */
import type { Resource } from "i18next";

type PageName =
  | "auth"
  | "settings"
  | "teacherDashboard"
  | "studentDashboard"
  | "aiQuiz"
  | "aiGenerator"
  | "assignmentCreator"
  | "evaluation"
  | "analytics"
  | "lesAnalytics"
  | "lesDebug"
  | "scores"
  | "outcomes"
  | "copoMapping"
  | "reports"
  | "subjects"
  | "questionPaper"
  | "feedback"
  | "announcements"
  | "calendar"
  | "enrolled"
  | "archived"
  | "chatbot"
  | "notFound"
  | "index";

const loaded = new Set<string>(["index", "auth", "chatbot"]);

export async function loadPageNamespace(page: PageName): Promise<void> {
  if (loaded.has(page)) return;
  loaded.add(page);

  // Dynamic imports: only the pages the user actually visits get
  // their JSON files in the chunk graph. The locale files are tiny
  // (~1-3kB each) so the network cost is negligible; the main win is
  // that a missing page file fails locally instead of breaking the
  // whole app.
  const [enPage, hiPage, mrPage] = await Promise.all([
    import(`./locales/pages/${page}/en.json`),
    import(`./locales/pages/${page}/hi.json`),
    import(`./locales/pages/${page}/mr.json`),
  ]);

  // i18next.addResourceBundle adds to an already-initialised instance
  // and triggers a re-render of every `useTranslation` consumer of
  // that namespace. Safe to call after init.
  const bundle: Resource = {
    en: { pages: { [page]: enPage.default } },
    hi: { pages: { [page]: hiPage.default } },
    mr: { pages: { [page]: mrPage.default } },
  };
  Object.entries(bundle).forEach(([lng, namespaces]) => {
    Object.entries(namespaces).forEach(([namespace, resources]) => {
      i18n.addResourceBundle(lng, namespace, resources, true, true);
      if (namespace === "pages") {
        i18n.addResourceBundle(lng, page, resources[page], true, true);
      }
    });
  });
}

export type { PageName };

export default i18n;
