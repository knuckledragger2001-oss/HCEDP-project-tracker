"use client";

// Single client boundary that supplies the app-wide feedback layer (toasts +
// confirm dialogs) to everything rendered inside the authenticated shell.
// Mounted once in the root layout around {children}.
import { ToastProvider } from "./Toast";
import { ConfirmProvider } from "./ConfirmDialog";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
