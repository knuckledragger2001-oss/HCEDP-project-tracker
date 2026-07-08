import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in — HCEDP Projects Tracker",
};

export default async function LoginPage() {
  // DB-validated redirect for genuinely signed-in users. Kept here (not in the
  // cookie-only proxy) so a stale/invalid session cookie can't create a redirect
  // loop — an invalid cookie simply renders the login form.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <LogoMark className="h-16 w-16" />
          <Wordmark className="h-9 w-auto" />
          <p className="text-sm text-muted">Sign in to the Projects Tracker</p>
        </div>
        <div className="card p-6 shadow-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
