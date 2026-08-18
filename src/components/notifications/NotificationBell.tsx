"use client";

// The bell in the top bar: recent in-app notifications (task assignments, Placer
// request assignments and due-date reminders, planned requests that just hit
// the queue). Polls GET /api/notifications, which also drives the throttled
// Placer schedule sync (release due plans, raise reminders) — see
// syncPlacerSchedule in src/lib/placer/planning.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon } from "@/components/ui/icons";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 45_000;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      setItems(body.notifications ?? []);
      setUnread(body.unread ?? 0);
      setLoaded(true);
    } catch {
      // Silent — the bell just stays as it was; next poll tries again.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setItems(body.notifications ?? []);
        setUnread(body.unread ?? 0);
        setLoaded(true);
      })
      .catch(() => {});
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onOpenItem(n: Notification) {
    setOpen(false);
    if (!n.read) {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
    }
    if (n.href) router.push(n.href);
  }

  async function markAllRead() {
    setItems((cur) => cur.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      load();
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!loaded) load();
        }}
        className="nav-link relative flex items-center gap-1.5"
        title="Notifications"
        aria-label="Notifications"
      >
        <BellIcon aria-hidden />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[110] mt-2 w-80 rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-brand hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-xs text-muted-2">
                Nothing yet. Task assignments and due-date reminders show up here.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onOpenItem(n)}
                      className={`flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left text-sm hover:bg-surface-2 ${
                        n.read ? "" : "bg-green-tint/40"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        {!n.read && (
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                            aria-hidden
                          />
                        )}
                        <span className={`leading-snug ${n.read ? "text-foreground/80" : "font-medium text-foreground"}`}>
                          {n.title}
                        </span>
                      </span>
                      {n.body && (
                        <span className="pl-3.5 text-xs text-muted">{n.body}</span>
                      )}
                      <span className="pl-3.5 text-[11px] text-muted-2">
                        {timeAgo(n.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-line px-3.5 py-2">
            <Link
              href="/tasks"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand hover:underline"
            >
              View your tasks →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
