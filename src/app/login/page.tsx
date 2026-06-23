import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — HCEDP Projects Tracker",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-brand text-lg font-bold text-white">
            HC
          </span>
          <h1 className="text-lg font-semibold text-gray-900">
            HCEDP Projects Tracker
          </h1>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
