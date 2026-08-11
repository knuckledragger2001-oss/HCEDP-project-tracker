"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };
// Visually grouped nav clusters. Each group gets a faint tinted background so
// related destinations read as a set (projects vs. analytics vs. placer). A
// "plain" group has no tint and is used for standalone items (e.g. Users).
export type NavTone = "projects" | "analytics" | "placer" | "plain";
export type NavGroup = { tone: NavTone; items: NavItem[] };

const GROUP_BG: Record<NavTone, string> = {
  projects: "bg-brand/5",
  analytics: "bg-accent/10",
  placer: "bg-amber-500/10",
  plain: "",
};

// Top-nav links with a reactive active state. This must be a client component:
// the root layout doesn't re-render on client-side navigation, so computing the
// active link there would leave the highlight stale.
export default function MainNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex items-center gap-2">
      {groups.map((group, i) => (
        <div
          key={i}
          className={`flex items-center gap-0.5 rounded-xl p-0.5 ${GROUP_BG[group.tone]}`}
        >
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive(item.href) ? "nav-link-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
