"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, size = "default" }: { className?: string; size?: "default" | "sm" | "lg" }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size={size === "default" ? "icon" : size === "sm" ? "icon" : "icon"}
        className={cn("h-10 w-10", className)}
        disabled
        aria-label="Loading theme..."
      >
        <div className="h-5 w-5 animate-pulse bg-muted rounded-full" />
      </Button>
    );
  }

  const themes = [
    { value: "light", label: "Light", icon: Sun, color: "text-amber-500" },
    { value: "dark", label: "Dark", icon: Moon, color: "text-indigo-500" },
    { value: "system", label: "System", icon: Monitor, color: "text-emerald-500" },
  ] as const;

  const currentTheme = themes.find((t) => t.value === theme) || themes[0];

  return (
    <div className="relative inline-flex items-center">
      <Button
        variant="ghost"
        size={size === "default" ? "icon" : size === "sm" ? "icon" : "icon"}
        className={cn(
          "relative overflow-hidden",
          "bg-muted/50 hover:bg-muted/80",
          "data-[state=open]:bg-muted",
          className
        )}
        onClick={() => {
          const currentIndex = themes.findIndex((t) => t.value === theme);
          const nextIndex = (currentIndex + 1) % themes.length;
          setTheme(themes[nextIndex].value);
        }}
        aria-label={`Current theme: ${currentTheme.label}. Click to cycle.`}
        aria-expanded="false"
      >
        <motion.span
          initial={false}
          animate={{ rotate: theme === "dark" ? 180 : 0, scale: [1, 0.8, 1] }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="flex h-5 w-5 items-center justify-center"
        >
          <currentTheme.icon className={cn("h-5 w-5", currentTheme.color)} aria-hidden="true" />
        </motion.span>

        {/* Tooltip indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-2 -right-2 h-2 w-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </Button>

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-xs font-medium rounded-lg shadow-lg border border-border whitespace-nowrap z-50 pointer-events-none"
      >
        {currentTheme.label} mode
      </motion.div>
    </div>
  );
}

export function ThemeSelector({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-10 w-32 animate-pulse bg-muted rounded-lg" />
      </div>
    );
  }

  const themes = [
    { value: "light", label: "Light", icon: Sun, description: "Bright & clean", color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
    { value: "dark", label: "Dark", icon: Moon, description: "Easy on eyes", color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
    { value: "system", label: "System", icon: Monitor, description: "Match OS setting", color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  ] as const;

  return (
    <div className={cn("flex items-center gap-2", className)} role="radiogroup" aria-label="Select theme">
      {themes.map((t) => (
        <motion.button
          key={t.value}
          role="radio"
          aria-checked={theme === t.value}
          onClick={() => setTheme(t.value)}
          className={cn(
            "relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all duration-200 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            theme === t.value
              ? "border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10"
              : "border-border bg-card hover:border-primary/30 hover:bg-muted/50 text-muted-foreground"
          )}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: themes.indexOf(t) * 0.05 }}
        >
          <motion.div
            className={cn("flex h-10 w-10 items-center justify-center rounded-lg", t.bg)}
            initial={false}
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            <t.icon className={cn("h-5 w-5", t.color)} aria-hidden="true" />
          </motion.div>
          <div className="text-center">
            <span className={cn("font-semibold text-sm", theme === t.value ? "text-foreground" : "text-muted-foreground")}>
              {t.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{t.description}</span>
          </div>

          {/* Active indicator */}
          <motion.div
            initial={false}
            animate={{ scale: theme === t.value ? 1 : 0 }}
            className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 0.5, ease: "linear", repeat: Infinity }}
              className="h-5 w-5 flex items-center justify-center"
            >
              <motion.path
                d="M20 6L9 17l-5-5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                className="h-3 w-3 text-primary-foreground stroke-current"
              />
            </motion.div>
          </motion.div>
        </motion.button>
      ))}
    </div>
  );
}