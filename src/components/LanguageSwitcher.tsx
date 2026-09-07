/**
 * Top-bar language switcher.
 *
 * A compact icon button that opens a 3-item dropdown (English / हिन्दी /
 * मराठी) and writes the new choice through `useLanguage`. The current
 * language is marked with a check. The icon and the label "swap" via
 * `framer-motion` when the language changes, giving a small visual
 * confirmation that the change registered (the same `AnimatePresence`
 * pattern the rest of the app uses for state transitions).
 *
 * `DashboardLayout` mounts one of these in the top bar, so it's
 * available on every authenticated page. The Settings page renders a
 * larger `<select>` for the same value, and the two stay in sync via
 * the `gc-language-change` event the hook fires.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  useLanguage,
  type SupportedLanguage,
} from "@/hooks/useLanguage";
import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={t("topbar.changeLanguage")}
          title={t("topbar.changeLanguage")}
        >
          {/* Keyed on the current language so AnimatePresence re-mounts
              and the icon subtly slides when the user picks something. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={language}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              <Languages className="h-5 w-5" />
            </motion.span>
          </AnimatePresence>
          {/* Tiny chip showing the active code (EN/HI/MR) in the
              bottom-right corner. Hidden on the smallest screens to
              keep the icon button compact. */}
          <span className="absolute -bottom-0.5 -right-0.5 hidden h-3.5 min-w-[14px] select-none items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground sm:flex">
            {language.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("topbar.language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((code: SupportedLanguage) => {
          const isActive = code === language;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => {
                if (!isActive) setLanguage(code);
              }}
              className="flex cursor-pointer items-center justify-between gap-2"
            >
              <span className={isActive ? "font-semibold text-foreground" : "text-foreground/80"}>
                {LANGUAGE_LABELS[code]}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {code}
                </span>
                {isActive && <Check className="h-4 w-4 text-primary" />}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
