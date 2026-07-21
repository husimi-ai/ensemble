"use client";

import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

/** Square, transparent icon button with a subtle hover fill (36px). */
export const IconButton = forwardRef<HTMLButtonElement, Props>(
  ({ label, className = "", children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg text-fg hover:bg-hover disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = "IconButton";
