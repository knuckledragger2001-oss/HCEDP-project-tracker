import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
