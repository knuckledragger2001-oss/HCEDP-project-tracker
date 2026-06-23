import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { LogoMark, Wordmark } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Sign in — HCEDP Projects Tracker",
};

export default function LoginPage() {
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
