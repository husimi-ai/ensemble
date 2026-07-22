"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

type IconCmp = ComponentType<{ size?: number; className?: string }>;

/**
 * A sidebar navigation row rendered as a real link, active when the current
 * path matches (or is nested under) `href`. Row geometry matches the design
 * system: 36px min height, 10px radius, instant hover, `bg-muted` when active.
 */
export function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: IconCmp;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-sm text-fg hover:bg-hover ${
        active ? "bg-muted" : ""
      }`}
    >
      <Icon size={20} className="shrink-0 text-fg" />
      {label}
    </Link>
  );
}
