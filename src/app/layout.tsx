import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { partnerCityLabel } from "@/lib/placer/schema";
import AppSidebar, {
  type SideGroup,
  type SidebarUser,
} from "@/components/shell/AppSidebar";
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

// Sidebar navigation, grouped so related destinations read as a set. Items carry
// a plain string icon key (see AppSidebar) so the data crosses to the client
// component without shipping React elements.
const NAV_GROUPS: SideGroup[] = [
  {
    label: "Menu",
    items: [
      { href: "/", label: "Pipeline", icon: "pipeline" },
      { href: "/intake", label: "New RFI", icon: "newRfi" },
      { href: "/sites", label: "Sites", icon: "sites" },
      { href: "/leads", label: "Leads", icon: "leads" },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/reports", label: "Reports", icon: "reports" },
      { href: "/placer", label: "Placer requests", icon: "placer" },
    ],
  },
];

const ADMIN_GROUP: SideGroup = {
  label: "Admin",
  items: [{ href: "/admin/users", label: "Users", icon: "users" }],
};

// Partners only ever see their own submission area.
const PARTNER_NAV_GROUPS: SideGroup[] = [
  {
    items: [{ href: "/requests", label: "Placer requests", icon: "placer" }],
  },
];

const HTML_CLASS = "h-full antialiased";

// The muted context label shown on the left of the top utility bar, so a person
// always knows which area they're in. Falls back to the org name.
function sectionTitle(pathname: string): string {
  if (pathname === "/") return "Pipeline";
  if (pathname.startsWith("/projects")) return "Project";
  if (pathname.startsWith("/intake")) return "New RFI";
  if (pathname.startsWith("/sites")) return "Sites";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/placer") || pathname.startsWith("/requests"))
    return "Placer requests";
  if (pathname.startsWith("/admin/users")) return "Users";
  return "HCEDP";
}

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

  const navGroups: SideGroup[] = partner
    ? PARTNER_NAV_GROUPS
    : user.role === "ADMIN"
      ? [...NAV_GROUPS, ADMIN_GROUP]
      : NAV_GROUPS;

  const roleLabel = partner
    ? partnerCityLabel(user.partnerCity)
    : user.role === "ADMIN"
      ? "HCEDP · Admin"
      : "HCEDP · Staff";

  const sidebarUser: SidebarUser = {
    name: user.name,
    email: user.email,
    roleLabel,
  };

  const unseenChangelog = partner ? [] : entriesNewerThan(user.lastSeenChangelog);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${HTML_CLASS}`}
    >
      <body className="min-h-full">
        <AppProviders>
          {/* Two-column app frame: a persistent sidebar that collapses to a
              64px icon rail below 1000px, and the main column beside it. The
              breakpoint matches AppSidebar's label visibility exactly. */}
          <div className="grid min-h-screen grid-cols-[64px_1fr] min-[1000px]:grid-cols-[236px_1fr]">
            <AppSidebar groups={navGroups} user={sidebarUser} />

            <div className="flex min-w-0 flex-col">
              {/* Slim top utility bar: context on the left, actions on the right. */}
              <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-surface/85 px-5 py-2.5 backdrop-blur">
                <span className="text-sm font-semibold text-muted">
                  {sectionTitle(pathname)}
                </span>
                <div className="flex items-center gap-3">
                  {!partner && (
                    <WhatsNew
                      entries={CHANGELOG}
                      unseenVersions={unseenChangelog.map((e) => e.version)}
                    />
                  )}
                  {(user.role === "ADMIN" || partner) && (
                    <span className="badge bg-info/15 text-accent-dark">
                      {partner ? partnerCityLabel(user.partnerCity) : "Admin"}
                    </span>
                  )}
                </div>
              </header>

              <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">
                {children}
              </main>
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
