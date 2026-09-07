"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "gradient" | "glass";
  size?: "sm" | "default" | "md" | "lg" | "xl" | "icon" | "icon-sm" | "icon-lg";
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  rounded?: "default" | "full" | "none" | "lg" | "sm";
  glow?: boolean;
  disabled?: boolean;
}

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "default",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      rounded = "default",
      glow = false,
      disabled,
      type = "button",
      onClick,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border border-border bg-card text-foreground hover:bg-muted hover:border-primary/30",
      ghost: "bg-transparent text-foreground hover:bg-muted",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      gradient: "bg-gradient-to-r from-primary to-primary-light text-primary-foreground hover:shadow-lg",
      glass: "bg-card/50 backdrop-blur-md border border-border/50 text-foreground hover:bg-card/80",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      default: "h-9 px-4 text-sm gap-2",
      md: "h-10 px-5 text-sm gap-2",
      lg: "h-11 px-6 text-base gap-2",
      xl: "h-12 px-8 text-lg gap-2.5",
      icon: "h-9 w-9",
      "icon-sm": "h-8 w-8",
      "icon-lg": "h-11 w-11",
    };

    const radiusMap = {
      default: "rounded-lg",
      full: "rounded-full",
      none: "rounded-none",
      lg: "rounded-xl",
      sm: "rounded-md",
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || isLoading}
        className={cn(
          "relative inline-flex items-center justify-center font-medium",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          "select-none whitespace-nowrap",
          variants[variant],
          sizes[size],
          radiusMap[rounded],
          fullWidth && "w-full",
          glow && variant === "primary" && "shadow-md shadow-primary/30",
          className
        )}
        whileHover={!disabled && !isLoading ? { scale: 1.02, y: -1 } : undefined}
        whileTap={!disabled && !isLoading ? { scale: 0.98, y: 0 } : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText && <span>{loadingText}</span>}
          </>
        ) : (
          <>
            {leftIcon && (
              <motion.span
                initial={{ x: 0, opacity: 1 }}
                whileHover={{ x: -2 }}
                className="inline-flex items-center"
              >
                {leftIcon}
              </motion.span>
            )}
            <span>{children}</span>
            {rightIcon && (
              <motion.span
                initial={{ x: 0, opacity: 1 }}
                whileHover={{ x: 2 }}
                className="inline-flex items-center"
              >
                {rightIcon}
              </motion.span>
            )}
          </>
        )}
      </motion.button>
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";

interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  icon: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg";
  label?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      className,
      variant = "ghost",
      size = "default",
      label,
      isLoading = false,
      disabled,
      type = "button",
      onClick,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border border-border bg-card text-foreground hover:bg-muted",
      ghost: "bg-transparent text-foreground hover:bg-muted",
      destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
    };

    const sizes = {
      sm: "h-8 w-8",
      default: "h-9 w-9",
      lg: "h-11 w-11",
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || isLoading}
        aria-label={label}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        whileHover={!disabled && !isLoading ? { scale: 1.1, rotate: 5 } : undefined}
        whileTap={!disabled && !isLoading ? { scale: 0.9 } : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </motion.button>
    );
  }
);
IconButton.displayName = "IconButton";