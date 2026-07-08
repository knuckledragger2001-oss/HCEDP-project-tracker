"use client";

// Promise-based confirmation dialog. Replaces native window.confirm and the
// app's ad-hoc inline confirm cards with one accessible modal.
//
// Usage:
//   const confirm = useConfirm();
//   if (await confirm({ title: "Delete user?", tone: "danger",
//                       description: "They will lose access immediately." })) {
//     ...do it...
//   }
//
// For the highest-stakes actions, pass `requireText` to force the user to type a
// matching string (e.g. the project codename) before the confirm button enables.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { WarningIcon } from "./icons";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** When set, the confirm button stays disabled until the user types this exactly. */
  requireText?: string;
};

type ConfirmApi = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

type Pending = { opts: ConfirmOptions; resolve: (v: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const [mounted, setMounted] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const confirm = useCallback<ConfirmApi>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setPending({ opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (result: boolean) => {
      pending?.resolve(result);
      setPending(null);
      setTyped("");
    },
    [pending],
  );

  // Esc to cancel; focus the confirm button on open (unless type-to-confirm).
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    if (!pending.opts.requireText) confirmBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const api = useMemo(() => confirm, [confirm]);

  const danger = pending?.opts.tone === "danger";
  const needsText = pending?.opts.requireText;
  const canConfirm = !needsText || typed === needsText;

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {mounted &&
        pending &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm dialog-backdrop"
              onClick={() => close(false)}
            />
            <div className="dialog-panel relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
              <div className="flex items-start gap-3">
                {danger && (
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-lg text-red-500">
                    <WarningIcon />
                  </span>
                )}
                <div className="flex-1">
                  <h2 id="confirm-title" className="text-base font-semibold text-foreground">
                    {pending.opts.title}
                  </h2>
                  {pending.opts.description && (
                    <div className="mt-1 text-sm leading-relaxed text-muted">
                      {pending.opts.description}
                    </div>
                  )}
                </div>
              </div>

              {needsText && (
                <div className="mt-4">
                  <p className="mb-1 text-xs text-muted">
                    Type <span className="font-semibold text-foreground">{needsText}</span> to
                    confirm.
                  </p>
                  <input
                    autoFocus
                    className="input text-sm"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canConfirm) close(true);
                    }}
                  />
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button className="btn-secondary text-sm" onClick={() => close(false)}>
                  {pending.opts.cancelLabel ?? "Cancel"}
                </button>
                <button
                  ref={confirmBtnRef}
                  className={`${danger ? "btn-danger" : "btn-primary"} text-sm`}
                  disabled={!canConfirm}
                  onClick={() => close(true)}
                >
                  {pending.opts.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}
