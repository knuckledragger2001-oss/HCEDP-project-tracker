"use client";

// App-wide toast/notification system. There was no feedback layer before this;
// every mutation now confirms itself with a transient toast (success/error/info)
// and destructive actions can attach an "Undo" action button.
//
// Usage:
//   const toast = useToast();
//   toast.success("Site saved");
//   toast.error("Could not save the site");
//   toast.show({ tone: "success", message: "User deleted",
//                action: { label: "Undo", onClick: () => restore() } });

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
import { CheckIcon, InfoIcon, WarningIcon, XIcon, UndoIcon } from "./icons";

export type ToastTone = "success" | "error" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

export type ToastOptions = {
  tone?: ToastTone;
  message: string;
  /** ms before auto-dismiss. Defaults: 4000, or 8000 when an action is present. */
  duration?: number;
  action?: ToastAction;
};

type Toast = Required<Pick<ToastOptions, "message">> & {
  id: number;
  tone: ToastTone;
  duration: number;
  action?: ToastAction;
  leaving: boolean;
};

type ToastApi = {
  show: (opts: ToastOptions) => number;
  success: (message: string, opts?: Omit<ToastOptions, "message" | "tone">) => number;
  error: (message: string, opts?: Omit<ToastOptions, "message" | "tone">) => number;
  info: (message: string, opts?: Omit<ToastOptions, "message" | "tone">) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const TONE_STYLE: Record<ToastTone, { icon: typeof CheckIcon; ring: string; iconColor: string }> = {
  success: { icon: CheckIcon, ring: "border-l-brand", iconColor: "text-brand" },
  error: { icon: WarningIcon, ring: "border-l-red-500", iconColor: "text-red-500" },
  info: { icon: InfoIcon, ring: "border-l-accent", iconColor: "text-accent-dark" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setMounted(true);
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const remove = useCallback((id: number) => {
    // Play the exit animation, then drop from state.
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const timer = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 180);
    timers.current.set(id, timer);
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current;
      const tone = opts.tone ?? "info";
      const duration = opts.duration ?? (opts.action ? 8000 : 4000);
      setToasts((list) => [
        ...list,
        { id, tone, message: opts.message, duration, action: opts.action, leaving: false },
      ]);
      if (duration > 0) {
        const timer = setTimeout(() => remove(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, opts) => show({ ...opts, message, tone: "success" }),
      error: (message, opts) => show({ ...opts, message, tone: "error" }),
      info: (message, opts) => show({ ...opts, message, tone: "info" }),
      dismiss: remove,
    }),
    [show, remove],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
            aria-live="polite"
            aria-atomic="false"
          >
            {toasts.map((t) => {
              const { icon: Icon, ring, iconColor } = TONE_STYLE[t.tone];
              return (
                <div
                  key={t.id}
                  role="status"
                  className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line ${ring} border-l-4 bg-surface px-4 py-3 shadow-lg ${
                    t.leaving ? "toast-leave" : "toast-enter"
                  }`}
                >
                  <Icon className={`mt-0.5 shrink-0 text-base ${iconColor}`} />
                  <p className="flex-1 text-sm leading-snug text-foreground">{t.message}</p>
                  {t.action && (
                    <button
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-brand hover:bg-brand/5"
                      onClick={async () => {
                        remove(t.id);
                        await t.action!.onClick();
                      }}
                    >
                      <UndoIcon className="text-sm" />
                      {t.action.label}
                    </button>
                  )}
                  <button
                    className="shrink-0 rounded p-0.5 text-muted hover:bg-brand/5 hover:text-foreground"
                    onClick={() => remove(t.id)}
                    aria-label="Dismiss"
                  >
                    <XIcon className="text-sm" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
