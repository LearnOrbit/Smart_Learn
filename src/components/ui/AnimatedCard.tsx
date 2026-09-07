"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outlined" | "interactive";
  hover?: boolean;
  delay?: number;
  onClick?: () => void;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      children,
      className,
      variant = "default",
      hover = false,
      delay = 0,
      onClick,
      ...props
    },
    ref
  ) => {
    const baseVariants = {
      default: {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] } },
      },
      elevated: {
        hidden: { opacity: 0, y: 20, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] } },
      },
      outlined: {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] } },
      },
      interactive: {
        hidden: { opacity: 0, y: 20, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] } },
        hover: { y: -4, scale: 1.01, boxShadow: "var(--shadow-xl)" },
        tap: { scale: 0.99 },
      },
    };

    const variantStyles = {
      default: "bg-card text-card-foreground shadow-sm border border-border",
      elevated: "bg-card text-card-foreground shadow-lg border border-border/50",
      outlined: "bg-transparent text-card-foreground border-2 border-border",
      interactive: "bg-card text-card-foreground shadow-sm border border-border cursor-pointer",
    };

    const isInteractive = variant === "interactive" || onClick !== undefined;

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        variants={baseVariants[variant]}
        whileHover={isInteractive && hover ? "hover" : undefined}
        whileTap={isInteractive ? "tap" : undefined}
        onClick={onClick}
        className={cn(
          "rounded-xl transition-fast",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedCard.displayName = "AnimatedCard";

interface CardHeaderProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn("px-6 py-4 border-b border-border", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
CardHeader.displayName = "CardHeader";

interface CardTitleProps extends HTMLMotionProps<"h3"> {
  children: ReactNode;
  className?: string;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className, ...props }, ref) => (
    <motion.h3
      ref={ref}
      className={cn("text-lg font-semibold text-foreground tracking-tight", className)}
      {...props}
    >
      {children}
    </motion.h3>
  )
);
CardTitle.displayName = "CardTitle";

interface CardDescriptionProps extends HTMLMotionProps<"p"> {
  children: ReactNode;
  className?: string;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className, ...props }, ref) => (
    <motion.p
      ref={ref}
      className={cn("text-sm text-muted-foreground mt-1", className)}
      {...props}
    >
      {children}
    </motion.p>
  )
);
CardDescription.displayName = "CardDescription";

interface CardContentProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn("px-6 py-4", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
CardContent.displayName = "CardContent";

interface CardFooterProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn("px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
CardFooter.displayName = "CardFooter";