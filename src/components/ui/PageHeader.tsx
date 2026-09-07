"use client";

import { motion } from "framer-motion";
import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string; onClick?: () => void }>;
  variant?: "default" | "minimal" | "hero";
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      title,
      description,
      children,
      className,
      action,
      breadcrumbs,
      variant = "default",
      ...props
    },
    ref
  ) => {
    const variants = {
      default: {
        container: "py-6 sm:py-8",
        title: "text-3xl sm:text-4xl font-bold tracking-tight",
        description: "text-lg text-muted-foreground mt-2 max-w-2xl",
        breadcrumbs: "text-sm text-muted-foreground",
      },
      minimal: {
        container: "py-4",
        title: "text-2xl sm:text-3xl font-bold tracking-tight",
        description: "text-base text-muted-foreground mt-1 max-w-xl",
        breadcrumbs: "text-sm text-muted-foreground",
      },
      hero: {
        container: "py-12 sm:py-16 text-center",
        title: "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight",
        description: "text-xl sm:text-2xl text-muted-foreground mt-4 max-w-3xl mx-auto",
        breadcrumbs: "text-sm text-muted-foreground justify-center",
      },
    };

    const styles = variants[variant];

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className={cn(styles.container, className)}
        {...props}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={cn("flex items-center gap-1.5 mb-4", styles.breadcrumbs)}
            aria-label="Breadcrumb"
          >
            {breadcrumbs.map((crumb, index) => (
              <motion.span
                key={crumb.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                {index > 0 && (
                  <span className="mx-1.5 text-muted-foreground/50" aria-hidden="true">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                    onClick={crumb.onClick}
                  >
                    {crumb.label}
                  </a>
                ) : crumb.onClick ? (
                  <button
                    onClick={crumb.onClick}
                    className="hover:text-foreground transition-colors bg-none border-none p-0 cursor-pointer font-inherit"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
              </motion.span>
            ))}
          </motion.nav>
        )}

        <div className={cn("flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4", variant === "hero" ? "items-center" : "")}>
          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className={cn(styles.title, "text-foreground")}
            >
              {title}
            </motion.h1>

            {description && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className={styles.description}
              >
                {description}
              </motion.p>
            )}

            {children && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                {children}
              </motion.div>
            )}
          </div>

          {action && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className={cn("flex-shrink-0", variant === "hero" ? "mt-6 sm:mt-0" : "self-end")}
            >
              {action}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }
);
PageHeader.displayName = "PageHeader";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
  count?: number | string;
}

export function SectionHeader({
  title,
  description,
  action,
  className,
  icon,
  count,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", className)}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            {icon}
          </motion.div>
        )}
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2"
          >
            {title}
            {count !== undefined && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full"
              >
                {count}
              </motion.span>
            )}
          </motion.h2>
          {description && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="text-sm text-muted-foreground mt-0.5"
            >
              {description}
            </motion.p>
          )}
        </div>
      </div>

      {action && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex-shrink-0"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}