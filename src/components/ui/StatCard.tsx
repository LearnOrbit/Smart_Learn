"use client";

import { motion } from "framer-motion";
import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  icon?: ReactNode;
  iconBg?: string;
  className?: string;
  variant?: "default" | "highlight" | "minimal";
  onClick?: () => void;
  delay?: number;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      title,
      value,
      description,
      trend,
      icon,
      iconBg = "bg-primary/10 text-primary",
      className,
      variant = "default",
      onClick,
      delay = 0,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "bg-card border border-border shadow-sm hover:shadow-md",
      highlight: "bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 shadow-sm hover:shadow-lg hover:border-primary/30",
      minimal: "bg-transparent border-0 shadow-none p-0",
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        whileHover={onClick ? { y: -4, scale: 1.01, boxShadow: "var(--shadow-lg)" } : undefined}
        whileTap={onClick ? { scale: 0.99 } : undefined}
        onClick={onClick}
        transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "rounded-xl transition-all duration-200",
          variants[variant],
          className
        )}
        {...props}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: delay + 0.1 }}
                className="text-sm font-medium text-muted-foreground truncate"
              >
                {title}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: delay + 0.15 }}
                className="mt-2 flex items-baseline gap-2"
              >
                <motion.span
                  className="text-3xl sm:text-4xl font-bold tabular-nums text-foreground"
                >
                  {value}
                </motion.span>
                {trend && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: delay + 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      trend.positive !== false ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}
                  >
                    <span className="text-xs" aria-hidden="true">
                      {trend.positive !== false ? "↑" : "↓"}
                    </span>
                    <span>{Math.abs(trend.value)}%</span>
                    {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
                  </motion.span>
                )}
              </motion.div>
              {description && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: delay + 0.2 }}
                  className="text-xs text-muted-foreground mt-3 line-clamp-2"
                >
                  {description}
                </motion.p>
              )}
            </div>

            {icon && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.4, delay: delay + 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                className={cn(
                  "flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl",
                  iconBg
                )}
              >
                {icon}
              </motion.div>
            )}
          </div>

          {/* Progress bar variant */}
          {trend && variant !== "minimal" && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.abs(trend.value), 100)}%` }}
              transition={{ duration: 0.8, delay: delay + 0.4, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                "mt-4 h-1.5 rounded-full bg-muted overflow-hidden",
                trend.positive !== false ? "bg-emerald-500" : "bg-red-500"
              )}
              style={{ width: `${Math.min(Math.abs(trend.value), 100)}%` }}
            />
          )}
        </div>
      </motion.div>
    );
  }
);
StatCard.displayName = "StatCard";

interface StatCardGridProps {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
  gap?: number;
}

export function StatCardGrid({
  children,
  className,
  columns = 4,
  gap = 4,
}: StatCardGridProps) {
  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.08,
          },
        },
      }}
      className={cn("grid gap-4 sm:gap-6", columnClasses[columns], className)}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </motion.div>
  );
}

interface MiniStatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    positive?: boolean;
  };
  className?: string;
}

export function MiniStat({ label, value, icon, trend, className }: MiniStatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className={cn("flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors", className)}
    >
      {icon && (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-lg font-bold tabular-nums text-foreground">{value}</span>
          {trend && (
            <span className={cn("text-xs font-medium flex items-center gap-0.5", trend.positive !== false ? "text-emerald-600" : "text-red-600")}>
              {trend.positive !== false ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}