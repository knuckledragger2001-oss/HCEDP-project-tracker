"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Area, DateInput, Field, Select, Text } from "@/components/intake/fields";
import {
  PARTNER_CITY_LABELS,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_OTHER_VALUE,
  REQUEST_STATUSES,
} from "@/lib/placer/schema";
import type { QueueRequest } from "./PlacerBoard";

// The staff form for manually logging a Placer AI request that came in outside
// the portal (phone, email, or before a city had a login) — so an existing
// backlog can be seeded straight onto the queue. Unlike the partner form it
// asks for the city and, optionally, the stage the request is already at.

type Draft = {
  city: string;
  placeName: string;
  locationAddress: string;
  reportType: string;
  reportTypeOther: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  neededByDate: string;
  timeframeNote: string;
  purpose: string;
  status: string;
};

const EMPTY: Draft = {
  city: "",
  placeName: "",
  locationAddress: "",
  reportType: REPORT_TYPES[0],
  reportTypeOther: "",
  dateRangeStart: "",
  dateRangeEnd: "",
  neededByDate: "",
  timeframeNote: "",
  purpose: "",
  status: "SUBMITTED",
};

const CITY_OPTIONS = [
  { value: "", label: "Select a city…" },
  ...Object.entries(PARTNER_CITY_LABELS).map(([value, label]) => ({ value, label })),
];
const REPORT_TYPE_OPTIONS = REPORT_TYPES.map((t) => ({
  value: t,
  label: REPORT_TYPE_LABELS[t],
}));
const STATUS_OPTIONS = REQUEST_STATUSES.map((s) => ({ value: s.value, label: s.label }));

export default function AddRequestDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (request: QueueRequest) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isOther = draft.reportType === REPORT_TYPE_OTHER_VALUE;

  async function save() {
    if (!draft.city) {
      setError("Choose which city this request is for.");
      return;
    }
    if (!draft.placeName.trim()) {
      setError("Add the place or location to be measured.");
      return;
    }
    if (isOther && !draft.reportTypeOther.trim()) {
      setError("Describe the report that was requested.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/placer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not add the request.");
      onCreated(body.request as QueueRequest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the request.");
    } finally {
      setBusy(false);
    }
  }

  // The board only renders this after a click, so `document` always exists by
  // then. The guard is for safety if it is ever rendered during SSR.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-surface p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">Add a request</h2>
        <p className="mt-0.5 text-xs text-muted">
          Log a Placer AI request received outside the portal. It lands on the
          queue just like a partner submission.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="City *">
            <Select
              value={draft.city}
              onChange={(v) => set("city", v)}
              options={CITY_OPTIONS}
            />
          </Field>
          <Field label="Starting status">
            <Select
              value={draft.status}
              onChange={(v) => set("status", v)}
              options={STATUS_OPTIONS}
            />
          </Field>

          <Field label="Place / location *">
            <Text
              value={draft.placeName}
              onChange={(v) => set("placeName", v)}
              placeholder="e.g. Downtown, Springtown Festival, Main St restaurants"
            />
          </Field>
          <Field label="Address or area">
            <Text
              value={draft.locationAddress}
              onChange={(v) => set("locationAddress", v)}
              placeholder="Street address, block, or district"
            />
          </Field>

          <Field label="Report type">
            <Select
              value={draft.reportType}
              onChange={(v) => set("reportType", v)}
              options={REPORT_TYPE_OPTIONS}
            />
          </Field>
          {isOther && (
            <Field label="Describe the report *">
              <Text
                value={draft.reportTypeOther}
                onChange={(v) => set("reportTypeOther", v)}
                placeholder="What should we measure?"
              />
            </Field>
          )}

          <Field label="From">
            <DateInput
              value={draft.dateRangeStart}
              onChange={(v) => set("dateRangeStart", v)}
            />
          </Field>
          <Field label="To">
            <DateInput
              value={draft.dateRangeEnd}
              onChange={(v) => set("dateRangeEnd", v)}
            />
          </Field>
          <Field label="Needed by">
            <DateInput
              value={draft.neededByDate}
              onChange={(v) => set("neededByDate", v)}
            />
          </Field>
          <Field label="Timeframe note">
            <Text
              value={draft.timeframeNote}
              onChange={(v) => set("timeframeNote", v)}
              placeholder="e.g. the two weekends of the festival, weekdays only…"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Purpose & details">
              <Area value={draft.purpose} onChange={(v) => set("purpose", v)} rows={3} />
            </Field>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? "Adding…" : "Add request"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
