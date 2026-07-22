/**
 * Ensemble's primary navigation -- the real product surfaces (feed, profile,
 * operator) that replace the ChatGPT clone's hardcoded project/chat lists.
 * Rooms are per-user data (tasks 005/012) and are listed dynamically, not here.
 */

import { Home, LayoutDashboard, UserRound, type LucideIcon } from "lucide-react";

/** One primary nav destination. `founderOnly` hides + guards founder surfaces. */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  founderOnly?: boolean;
};

/** Top-of-sidebar destinations, in order. */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Feed", href: "/feed", icon: Home },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Operator", href: "/operator", icon: LayoutDashboard, founderOnly: true },
];

/** The top-bar title for a path (room routes read as "Ensemble room"). */
export function titleForPath(pathname: string): string {
  if (pathname.startsWith("/room/")) return "Ensemble room";
  const item = PRIMARY_NAV.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
  );
  return item?.label ?? "Ensemble";
}
