"use client";

import { createContext, useState, type ReactNode } from "react";

// When true, an editable section renders without its own card + title chrome —
// the enclosing TabbedCard supplies those (the tab bar + the surrounding card).
// SectionShell (in editable.tsx) consumes this.
export const BareSection = createContext(false);

export type TopicTab = { key: string; label: string; node: ReactNode };

// A topic "box" for the project page: a card with an underline tab bar that
// swaps between related sections, keeping the page horizontal instead of one
// long vertical stack. A single-tab box renders its label as a plain heading.
export default function TabbedCard({
  tabs,
  className = "",
}: {
  tabs: TopicTab[];
  className?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className={`card flex flex-col p-4 ${className}`}>
      {tabs.length === 1 ? (
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {tabs[0].label}
        </h3>
      ) : (
        <div className="mb-3 flex flex-wrap gap-x-1 border-b border-line">
          {tabs.map((t) => {
            const on = t.key === current?.key;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      <BareSection.Provider value={true}>{current?.node}</BareSection.Provider>
    </div>
  );
}
