"use client";

// The recurring-plans list on the planning calendar: pause/resume a series,
// change its lead time / end date / owner, or retire it. Editing or reactivating
// regenerates its future, unreleased occurrences server-side (see
// regenerateSeries in src/lib/placer/planning.ts), so this panel reloads the
// page after a change rather than trying to patch the calendar's local state.

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PARTNER_CITY_LABELS } from "@/lib/placer/schema";
import type { SeriesSummary } from "./PlacerCalendar";
import type { StaffOption } from "@/components/placer/PlacerBoard";

export default function SeriesPanel({
  series,
  staff,
  onChange,
  onPlansChanged,
}: {
  series: SeriesSummary[];
  staff: StaffOption[];
  onChange: (series: SeriesSummary[]) => void;
  onPlansChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(s: SeriesSummary) {
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/placer-series/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      });
      if (!res.ok) throw new Error("Failed");
      onChange(series.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)));
      toast.success(s.active ? "Paused." : "Resumed.");
      if (!s.active) onPlansChanged();
    } catch {
      toast.error("Could not update this plan.");
    } finally {
      setBusyId(null);
    }
  }

  async function reassign(s: SeriesSummary, assignedToId: string) {
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/placer-series/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assignedToId || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const who = staff.find((st) => st.id === assignedToId)?.label ?? null;
      onChange(series.map((x) => (x.id === s.id ? { ...x, assignedToId: assignedToId || null, assignedToName: who } : x)));
      toast.success("Owner updated.");
      onPlansChanged();
    } catch {
      toast.error("Could not update the owner.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(s: SeriesSummary) {
    const ok = await confirm({
      title: "Retire this recurring plan?",
      description: `Future occurrences of "${s.placeName}" that haven't reached the queue yet will be removed. Already-queued ones are kept.`,
      confirmLabel: "Retire",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/placer-series/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      onChange(series.filter((x) => x.id !== s.id));
      toast.success("Retired.");
      onPlansChanged();
    } catch {
      toast.error("Could not retire this plan.");
    } finally {
      setBusyId(null);
    }
  }

  if (series.length === 0) {
    return (
      <div className="card p-4 text-center text-xs text-muted-2">
        No recurring plans yet. Add one from &ldquo;Add plan&rdquo; and check &ldquo;Repeats&rdquo;.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-line p-0">
      {series.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
          <span className={`badge ${s.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
            {s.active ? "Active" : "Paused"}
          </span>
          <span className="badge bg-accent/15 text-accent-dark">{PARTNER_CITY_LABELS[s.city]}</span>
          <span className="font-medium text-foreground">{s.placeName}</span>
          <span className="text-xs text-muted">{s.description}</span>
          <span className="text-xs text-muted-2">{s.occurrenceCount} scheduled</span>

          <div className="ml-auto flex items-center gap-2">
            <select
              className="input h-7 w-36 py-0.5 text-xs"
              value={s.assignedToId ?? ""}
              onChange={(e) => reassign(s, e.target.value)}
              disabled={busyId === s.id}
              aria-label="Owner"
            >
              <option value="">Unassigned</option>
              {staff.map((st) => (
                <option key={st.id} value={st.id}>{st.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary h-7 py-0.5 text-xs"
              onClick={() => toggleActive(s)}
              disabled={busyId === s.id}
            >
              {s.active ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              className="btn-danger h-7 py-0.5 text-xs"
              onClick={() => remove(s)}
              disabled={busyId === s.id}
            >
              Retire
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
