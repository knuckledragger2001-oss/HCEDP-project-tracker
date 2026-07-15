"use client";

// "What's new" changelog surface. Renders a header trigger button (with an
// unread dot) plus a modal that lists recent releases. When the signed-in user
// has entries they haven't acknowledged, the modal opens on arrival; dismissing
// it marks them caught up via the markChangelogSeen server action so it won't
// reappear until the next release. Users can reopen it anytime.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ChangelogEntry, ChangelogTag } from "@/lib/changelog";
import { SparkleIcon, XIcon } from "@/components/ui/icons";
import { markChangelogSeen } from "./actions";

const TAG_META: Record<ChangelogTag, { label: string; className: string }> = {
  new: { label: "New", className: "bg-accent/15 text-accent-dark" },
  improved: { label: "Improved", className: "bg-brand/10 text-brand" },
  fixed: { label: "Fixed", className: "bg-emerald-500/15 text-emerald-700" },
};

// Client-only flag with no setState-in-effect, so createPortal (which needs
// document) never runs during server rendering.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function formatReleaseDate(iso: string): string {
  // Parse as a local date (avoid the UTC shift that `new Date("YYYY-MM-DD")` causes).
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function WhatsNew({
  entries,
  unseenVersions,
}: {
  entries: ChangelogEntry[];
  unseenVersions: string[];
}) {
  const unseen = useMemo(() => new Set(unseenVersions), [unseenVersions]);
  const hadUnread = unseenVersions.length > 0;
  const isClient = useIsClient();
  // Auto-open on arrival when there are unacknowledged entries (lazy initial
  // state, so no effect is needed to trigger it).
  const [open, setOpen] = useState(hadUnread);
  const [dismissed, setDismissed] = useState(false);
  // Guards against firing the server ack more than once (e.g. StrictMode).
  const ackedRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    if (hadUnread && !ackedRef.current) {
      ackedRef.current = true;
      setDismissed(true);
      // Fire-and-forget: persist that this user has seen the latest release.
      void markChangelogSeen();
    }
  }, [hadUnread]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (entries.length === 0) return null;

  const showDot = hadUnread && !dismissed;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nav-link relative flex items-center gap-1.5"
        title="What's new"
      >
        <SparkleIcon aria-hidden />
        <span className="hidden sm:inline">What&apos;s new</span>
        {showDot && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface"
            aria-hidden
          />
        )}
      </button>

      {isClient &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsnew-title"
          >
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm dialog-backdrop"
              onClick={close}
            />
            <div className="dialog-panel relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-surface shadow-xl">
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-lg text-accent-dark">
                    <SparkleIcon aria-hidden />
                  </span>
                  <div>
                    <h2 id="whatsnew-title" className="text-base font-semibold text-foreground">
                      What&apos;s new
                    </h2>
                    <p className="text-xs text-muted">Recent updates to the tracker</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-brand/5 hover:text-brand"
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
                {entries.map((entry) => (
                  <section key={entry.version}>
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{entry.title}</h3>
                      {unseen.has(entry.version) && (
                        <span className="badge bg-accent/15 text-accent-dark">New</span>
                      )}
                      <span className="ml-auto text-xs text-muted">
                        {formatReleaseDate(entry.date)}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {entry.items.map((item, i) => {
                        const meta = TAG_META[item.tag];
                        return (
                          <li key={i} className="flex gap-2 text-sm text-foreground/90">
                            <span className={`badge mt-0.5 shrink-0 ${meta.className}`}>
                              {meta.label}
                            </span>
                            <span className="leading-relaxed">{item.text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>

              <div className="flex justify-end border-t border-line px-5 py-3">
                <button type="button" className="btn-primary text-sm" onClick={close}>
                  Got it
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
