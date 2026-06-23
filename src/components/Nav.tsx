"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Top-nav links with a reactive active state. This must be a client component:
// the root layout doesn't re-render on client-side navigation, so computing the
// active link there would leave the highlight stale.
export default function MainNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex items-center gap-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-link ${isActive(item.href) ? "nav-link-active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
