"use client";

import { motion } from "framer-motion";
import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  delay?: number;
  variant?: "default" | "shimmer" | "pulse" | "wave";
  children?: ReactNode;
  count?: number;
  interval?: number;
}

export const LoadingSkeleton = forwardRef<HTMLDivElement, LoadingSkeletonProps>(
  (
    {
      className,
      delay = 0,
      variant = "shimmer",
      children,
      count = 1,
      interval = 0.05,
      ...props
    },
    ref
  ) => {
    const skeletons = Array.from({ length: count }, (_, i) => i);

    const skeletonBase = "rounded-md";

    const variantClasses = {
      default: "bg-muted/50",
      shimmer:
        "bg-gradient-to-r from-muted/30 via-muted to-muted/30 bg-[length:200%_100%] animate-shimmer",
      pulse: "bg-muted animate-pulse",
      wave: "bg-muted overflow-hidden",
    };

    return (
      <div ref={ref} className="space-y-2" {...props}>
        {skeletons.map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: delay + i * interval }}
            className={cn(skeletonBase, variantClasses[variant], className)}
            style={variant === "shimmer" ? {
              backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.8s ease-in-out infinite",
            } : undefined}
          >
            {children}
          </motion.div>
        ))}
      </div>
    );
  }
);
LoadingSkeleton.displayName = "LoadingSkeleton";

// Specific skeleton components for common patterns
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("rounded-xl bg-card border border-border p-5", className)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 space-y-2">
          <div
            className="h-4 w-1/3 bg-muted rounded-md"
            style={{
              backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.8s ease-in-out infinite",
            }}
          />
          <div
            className="h-8 w-1/2 bg-muted rounded-md"
            style={{
              backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.8s ease-in-out infinite",
            }}
          />
        </div>
        <div
          className="h-12 w-12 bg-muted rounded-xl"
          style={{
            backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.8s ease-in-out infinite",
          }}
        />
      </div>
      <div
        className="h-3 w-full bg-muted rounded-md"
        style={{
          backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.8s ease-in-out infinite",
        }}
      />
    </motion.div>
  );
}

export function SkeletonList({ items = 3, className }: { items?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
        >
          <div
            className="h-10 w-10 bg-muted rounded-lg"
            style={{
              backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.8s ease-in-out infinite",
            }}
          />
          <div className="flex-1 space-y-2">
            <div
              className="h-3 w-2/3 bg-muted rounded-md"
              style={{
                backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-3 w-1/3 bg-muted rounded-md"
              style={{
                backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 border-b border-border">
        {Array.from({ length: columns }, (_, i) => (
          <div
            key={i}
            className="h-4 flex-1 bg-muted rounded-md"
            style={{
              backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.8s ease-in-out infinite",
            }}
          />
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <motion.div
            key={rowIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: rowIndex * 0.05 }}
            className="flex items-center gap-4 p-4"
          >
            {Array.from({ length: columns }, (_, colIndex) => (
              <div
                key={colIndex}
                className="h-3 flex-1 bg-muted rounded-md"
                style={{
                  backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.8s ease-in-out infinite",
                }}
              />
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonAvatar({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={cn("rounded-full bg-muted", sizeClasses[size], className)}
      style={{
        backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
      }}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn("h-3 bg-muted rounded-md", i === lines - 1 ? "w-2/3" : "w-full")}
          style={{
            backgroundImage: "linear-gradient(90deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.6) 50%, hsl(var(--muted) / 0.3) 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.8s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

export function FullPageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <motion.div
        className="relative h-12 w-12"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
      >
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-muted-foreground"
      >
        {message}
      </motion.p>
    </div>
  );
}