"use client";

import { type ReactNode, useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** classes for the dialog panel (size / radius) */
  panelClassName?: string;
  labelledBy?: string;
};

/**
 * Centered modal with scrim. Enter/exit motion mirrors the reference: scrim
 * fades, panel fades + scales from 0.98 over 200ms ease-out. Closes on Escape
 * and backdrop click.
 */
export function Modal({ open, onClose, children, panelClassName = "", labelledBy }: Props) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-scrim transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative bg-elevated shadow-pop transition-all duration-200 ease-out ${
          shown ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
        } ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
