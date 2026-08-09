"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_OTHER_VALUE,
} from "@/lib/placer/schema";

const EMPTY = {
  placeName: "",
  locationAddress: "",
  reportType: REPORT_TYPES[0] as string,
  reportTypeOther: "",
  dateRangeStart: "",
  dateRangeEnd: "",
  timeframeNote: "",
  neededByDate: "",
  purpose: "",
};

// The submission form partners use to request a Placer AI report. Posts to
// /api/placer-requests; the server stamps the city from the session.
export default function RequestForm() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const isOther = form.reportType === REPORT_TYPE_OTHER_VALUE;
  const set = (k: keyof typeof EMPTY, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.placeName.trim()) {
      toast.error("Add the place or location you want measured.");
      return;
    }
    if (isOther && !form.reportTypeOther.trim()) {
      toast.error("Describe the report you need.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/placer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Request submitted. We'll take it from here.");
      setForm(EMPTY);
      router.refresh();
    } catch {
      toast.error("Could not submit the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Place / location *</label>
          <input
            className="input"
            value={form.placeName}
            onChange={(e) => set("placeName", e.target.value)}
            placeholder="e.g. Downtown, Springtown Festival, Main St restaurants"
            required
          />
        </div>
        <div>
          <label className="label">Address or area (optional)</label>
          <input
            className="input"
            value={form.locationAddress}
            onChange={(e) => set("locationAddress", e.target.value)}
            placeholder="Street address, block, or district"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Report type *</label>
          <select
            className="input"
            value={form.reportType}
            onChange={(e) => set("reportType", e.target.value)}
          >
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {REPORT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        {isOther && (
          <div>
            <label className="label">Describe the report *</label>
            <input
              className="input"
              value={form.reportTypeOther}
              onChange={(e) => set("reportTypeOther", e.target.value)}
              placeholder="What should we measure?"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="label">From (optional)</label>
          <input
            type="date"
            className="input"
            value={form.dateRangeStart}
            onChange={(e) => set("dateRangeStart", e.target.value)}
          />
        </div>
        <div>
          <label className="label">To (optional)</label>
          <input
            type="date"
            className="input"
            value={form.dateRangeEnd}
            onChange={(e) => set("dateRangeEnd", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Needed by (optional)</label>
          <input
            type="date"
            className="input"
            value={form.neededByDate}
            onChange={(e) => set("neededByDate", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Timeframe note (optional)</label>
        <input
          className="input"
          value={form.timeframeNote}
          onChange={(e) => set("timeframeNote", e.target.value)}
          placeholder="e.g. the two weekends of the festival, weekdays only…"
        />
      </div>

      <div>
        <label className="label">Purpose &amp; details (optional)</label>
        <textarea
          className="input min-h-24"
          value={form.purpose}
          onChange={(e) => set("purpose", e.target.value)}
          placeholder="Why you need it and anything specific that would help us."
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}
