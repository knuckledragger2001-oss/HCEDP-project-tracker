import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "./login/actions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HCEDP Projects Tracker",
  description:
    "Hays Caldwell EDP — RFI intake, pipeline, sites and partner reporting.",
};

const NAV = [
  { href: "/", label: "Pipeline" },
  { href: "/intake", label: "New RFI" },
  { href: "/sites", label: "Sites" },
  { href: "/reports", label: "Reports" },
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${HTML_CLASS}`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-brand text-sm font-bold text-white">
                HC
              </span>
              <span className="font-semibold text-gray-900">
                HCEDP Projects Tracker
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  {item.label}
                </Link>
              ))}
              {user.role === "ADMIN" && (
                <Link
                  href="/admin/users"
                  className="rounded-md px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  Users
                </Link>
              )}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden text-gray-500 sm:inline" title={user.email}>
                {user.name ?? user.email}
                {user.role === "ADMIN" && (
                  <span className="badge ml-2 bg-brand/10 text-brand">Admin</span>
                )}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
