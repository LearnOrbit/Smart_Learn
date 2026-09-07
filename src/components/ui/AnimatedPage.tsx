"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedPageProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  variant?: "fade" | "slide-up" | "slide-down" | "scale";
  delay?: number;
  duration?: number;
}

export const AnimatedPage = ({
  children,
  className,
  variant = "fade",
  delay = 0,
  duration = 0.4,
  ...props
}: AnimatedPageProps) => {
  const variants = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration, delay } },
      exit: { opacity: 0, transition: { duration: duration * 0.5 } },
    },
    "slide-up": {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration, delay, ease: [0.4, 0, 0.2, 1] } },
      exit: { opacity: 0, y: -20, transition: { duration: duration * 0.5 } },
    },
    "slide-down": {
      hidden: { opacity: 0, y: -20 },
      visible: { opacity: 1, y: 0, transition: { duration, delay, ease: [0.4, 0, 0.2, 1] } },
      exit: { opacity: 0, y: 20, transition: { duration: duration * 0.5 } },
    },
    scale: {
      hidden: { opacity: 0, scale: 0.95 },
      visible: { opacity: 1, scale: 1, transition: { duration, delay, ease: [0.4, 0, 0.2, 1] } },
      exit: { opacity: 0, scale: 0.95, transition: { duration: duration * 0.5 } },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants[variant]}
      className={cn("animate-in", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedPageSectionProps extends HTMLMotionProps<"section"> {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedPageSection = ({
  children,
  className,
  delay = 0,
  ...props
}: AnimatedPageSectionProps) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn("animate-in", className)}
      {...props}
    >
      {children}
    </motion.section>
  );
};

interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  delayChildren?: number;
}

export const StaggerContainer = ({
  children,
  className,
  staggerDelay = 0.1,
  delayChildren = 0,
  ...props
}: StaggerContainerProps) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren,
          },
        },
      }}
      className={cn("animate-in", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

export const StaggerItem = ({ children, className, ...props }: StaggerItemProps) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
      }}
      className={cn("animate-in", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};