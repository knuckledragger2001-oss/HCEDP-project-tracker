import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser, isInternal } from "@/lib/auth/session";
import { partnerCityLabel } from "@/lib/placer/schema";
import { logout } from "./login/actions";
import { BrandLockup } from "@/components/brand/Logo";
import MainNav, { type NavGroup } from "@/components/Nav";
import AppProviders from "@/components/ui/AppProviders";
import WhatsNew from "@/components/whatsnew/WhatsNew";
import { CHANGELOG, entriesNewerThan } from "@/lib/changelog";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HCEDP Projects Tracker",
  description:
    "Hays Caldwell EDP — RFI intake, pipeline, sites and partner reporting.",
};

// Nav is grouped into tinted clusters so related destinations read as a set.
// Group 1 (projects workflow), Group 2 (analytics), Group 3 (placer). Admin-only
// "Users" is appended as a standalone (plain) group. See MainNav for the tints.
const NAV_GROUPS: NavGroup[] = [
  {
    tone: "projects",
    items: [
      { href: "/intake", label: "New RFI" },
      { href: "/", label: "Pipeline" },
      { href: "/sites", label: "Sites" },
      { href: "/leads", label: "Leads" },
    ],
  },
  {
    tone: "analytics",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    tone: "placer",
    items: [{ href: "/placer", label: "Placer Requests" }],
  },
];

// Partners only ever see their own submission area.
const PARTNER_NAV_GROUPS: NavGroup[] = [
  { tone: "placer", items: [{ href: "/requests", label: "Placer Requests" }] },
];

const HTML_CLASS = "h-full antialiased";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-pathname") ?? "";

  // The login page renders without the app chrome or the auth gate.
  if (pathname === "/login") {
    return (
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${HTML_CLASS}`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    );
  }

  // Authoritative auth check for every protected page.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Route segmentation, enforced in one place. Partners are confined to their
  // /requests area; internal staff never render the partner submission surface.
  const partner = user.role === "PARTNER";
  const onPartnerArea = pathname === "/requests" || pathname.startsWith("/requests/");
  if (partner && !onPartnerArea) redirect("/requests");
  if (!partner && onPartnerArea) redirect("/placer");

  const navGroups: NavGroup[] = partner
    ? PARTNER_NAV_GROUPS
    : user.role === "ADMIN"
      ? [
          ...NAV_GROUPS,
          { tone: "plain", items: [{ href: "/admin/users", label: "Users" }] },
        ]
      : NAV_GROUPS;

  const unseenChangelog = partner ? [] : entriesNewerThan(user.lastSeenChangelog);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${HTML_CLASS}`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>
        <header className="sticky top-0 z-20 border-b border-line bg-surface">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2.5">
            <Link href="/" className="shrink-0">
              <BrandLockup />
            </Link>
            <MainNav groups={navGroups} />
            <div className="ml-auto flex items-center gap-3">
              {!partner && (
                <WhatsNew
                  entries={CHANGELOG}
                  unseenVersions={unseenChangelog.map((e) => e.version)}
                />
              )}
              <span
                className="hidden items-center gap-2 text-sm text-muted sm:flex"
                title={user.email}
              >
                {user.role === "ADMIN" && (
                  <span className="badge bg-accent/15 text-accent-dark">Admin</span>
                )}
                {partner && (
                  <span className="badge bg-accent/15 text-accent-dark">
                    {partnerCityLabel(user.partnerCity)}
                  </span>
                )}
                <span className="font-medium text-foreground">
                  {user.name ?? user.email}
                </span>
              </span>
              <form action={logout}>
                <button type="submit" className="nav-link">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
        </AppProviders>
      </body>
    </html>
  );
}
