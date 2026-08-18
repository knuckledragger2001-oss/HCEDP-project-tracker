"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { logout } from "@/app/login/actions";
import {
  PipelineIcon,
  NewRfiIcon,
  SitesIcon,
  LeadsIcon,
  DashboardIcon,
  ReportsIcon,
  PlacerIcon,
  UsersIcon,
  LogoutIcon,
  CalendarIcon,
  TaskListIcon,
} from "@/components/ui/icons";

// Nav data crosses the server -> client boundary, so items carry a plain string
// icon key (not a React element). The mapping to an icon component lives here.
export type SideIconKey =
  | "pipeline"
  | "newRfi"
  | "sites"
  | "leads"
  | "dashboard"
  | "reports"
  | "placer"
  | "calendar"
  | "tasks"
  | "users";

const ICONS: Record<SideIconKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  pipeline: PipelineIcon,
  newRfi: NewRfiIcon,
  sites: SitesIcon,
  leads: LeadsIcon,
  dashboard: DashboardIcon,
  reports: ReportsIcon,
  placer: PlacerIcon,
  calendar: CalendarIcon,
  tasks: TaskListIcon,
  users: UsersIcon,
};

export type SideItem = { href: string; label: string; icon: SideIconKey };
export type SideGroup = { label?: string; items: SideItem[] };

export type SidebarUser = {
  name: string | null;
  email: string;
  roleLabel: string | null;
};

// The width breakpoint at which the sidebar expands from the icon rail to the
// full labelled sidebar. Matches the reference design's collapse point. Below
// it, only centered icons show (see the grid column width in layout.tsx).
// Tailwind arbitrary variant `min-[1000px]:` is used everywhere here so the
// label visibility stays in lockstep with that grid column.

function initials(user: SidebarUser): string {
  const base = user.name?.trim() || user.email;
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || base.slice(0, 2)).toUpperCase();
}

export default function AppSidebar({
  groups,
  user,
}: {
  groups: SideGroup[];
  user: SidebarUser;
}) {
  const pathname = usePathname();
  // The most specific matching href wins, so a nested route (e.g.
  // /placer/calendar) only lights up its own item, not its parent's too.
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const matches = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const bestHref = allHrefs
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === bestHref;

  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-hidden border-r border-line bg-surface">
      {/* Brand. Square mark always shows; the wordmark appears when expanded. */}
      <div className="flex items-center justify-center gap-2.5 px-3 py-4 min-[1000px]:justify-start min-[1000px]:px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-foreground text-[13px] font-extrabold tracking-tight text-white">
          HC
        </span>
        <span className="hidden leading-tight min-[1000px]:block">
          <span className="block text-sm font-extrabold tracking-tight text-foreground">
            HCEDP
          </span>
          <span className="block text-[10.5px] font-medium text-muted">
            Project tracker
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 min-[1000px]:px-3">
        {groups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <div className="hidden px-2 pb-1.5 pt-4 text-[10px] font-extrabold uppercase tracking-[0.13em] text-muted-2 min-[1000px]:block">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={`relative mb-0.5 flex h-10 items-center justify-center gap-3 whitespace-nowrap rounded-lg px-2.5 text-[13.5px] font-semibold transition-colors min-[1000px]:justify-start ${
                    active
                      ? "bg-green-tint text-foreground"
                      : "text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {/* Thin green edge bar on the active item. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-brand"
                    />
                  )}
                  <Icon
                    className={`h-5 w-5 shrink-0 min-[1000px]:h-[18px] min-[1000px]:w-[18px] ${
                      active ? "text-brand" : "text-muted-2"
                    }`}
                  />
                  <span className="hidden min-[1000px]:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Signed-in user + sign out. */}
      <div className="border-t border-line p-2 min-[1000px]:p-3">
        <div className="flex items-center justify-center gap-2.5 px-1 py-1.5 min-[1000px]:justify-start">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-xs font-bold text-white">
            {initials(user)}
          </span>
          <span className="hidden min-w-0 min-[1000px]:block">
            <span className="block truncate text-sm font-semibold text-foreground">
              {user.name ?? user.email}
            </span>
            {user.roleLabel && (
              <span className="block truncate font-mono text-[11px] text-muted">
                {user.roleLabel}
              </span>
            )}
          </span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            title="Sign out"
            className="flex h-10 w-full items-center justify-center gap-3 rounded-lg px-2.5 text-[13.5px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground min-[1000px]:justify-start"
          >
            <LogoutIcon className="h-5 w-5 shrink-0 text-muted-2 min-[1000px]:h-[18px] min-[1000px]:w-[18px]" />
            <span className="hidden min-[1000px]:inline">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
