"use client";

// Add / edit dialog for the planning calendar. Adding supports a one-off plan
// or a recurring series; editing works on a single occurrence (whether it was
// entered by hand or generated from a series — the series pattern itself is
// managed from SeriesPanel).

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Area, DateInput, Field, Select, Text } from "@/components/intake/fields";
import AssignTaskButton from "@/components/tasks/AssignTaskButton";
import {
  PARTNER_CITY_LABELS,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_OTHER_VALUE,
  RECURRENCE_OPTIONS,
  DEFAULT_LEAD_DAYS,
} from "@/lib/placer/schema";
import { toDateKey, ordinal, WEEKDAY_LABELS, WEEK_OF_MONTH_LABELS } from "@/lib/placer/recurrence";
import { formatDate } from "@/lib/format";
import type { CalendarPlan } from "./PlacerCalendar";
import type { StaffOption } from "@/components/placer/PlacerBoard";

const CITY_OPTIONS = [
  { value: "", label: "Select a city…" },
  ...Object.entries(PARTNER_CITY_LABELS).map(([value, label]) => ({ value, label })),
];
const REPORT_TYPE_OPTIONS = REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] }));
const STAFF_EMPTY_OPTION = { value: "", label: "Unassigned" };
const MODE_OPTIONS = [
  { value: "DAY_OF_MONTH", label: "A fixed day of the month" },
  { value: "NTH_WEEKDAY", label: "A specific weekday (e.g. third Friday)" },
];
const WEEK_OF_MONTH_OPTIONS = [
  { value: "1", label: "First" },
  { value: "2", label: "Second" },
  { value: "3", label: "Third" },
  { value: "4", label: "Fourth" },
  { value: "-1", label: "Last" },
];
const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, i) => ({ value: String(i), label }));

type Draft = {
  city: string;
  placeName: string;
  locationAddress: string;
  reportType: string;
  reportTypeOther: string;
  purpose: string;
  eventDate: string;
  eventEndDate: string;
  leadDays: string;
  queueOnDate: string;
  assignedToId: string;
};

function emptyDraft(date: Date | null): Draft {
  return {
    city: "",
    placeName: "",
    locationAddress: "",
    reportType: REPORT_TYPES[0],
    reportTypeOther: "",
    purpose: "",
    eventDate: date ? toDateKey(date) : "",
    eventEndDate: "",
    leadDays: String(DEFAULT_LEAD_DAYS),
    queueOnDate: "",
    assignedToId: "",
  };
}

function draftFromPlan(plan: CalendarPlan): Draft {
  return {
    city: plan.city,
    placeName: plan.placeName,
    locationAddress: plan.locationAddress ?? "",
    reportType: plan.reportType,
    reportTypeOther: plan.reportTypeOther ?? "",
    purpose: plan.purpose ?? "",
    eventDate: plan.eventDate ? plan.eventDate.slice(0, 10) : "",
    eventEndDate: plan.eventEndDate ? plan.eventEndDate.slice(0, 10) : "",
    leadDays: "",
    queueOnDate: plan.queueOnDate ? plan.queueOnDate.slice(0, 10) : "",
    assignedToId: plan.assignedToId ?? "",
  };
}

type RecurrenceDraft = {
  enabled: boolean;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  interval: string;
  mode: "DAY_OF_MONTH" | "NTH_WEEKDAY";
  dayOfMonth: string;
  weekday: string;
  weekOfMonth: string;
  endDate: string;
};

function emptyRecurrence(date: Date | null): RecurrenceDraft {
  const d = date ?? new Date();
  return {
    enabled: false,
    frequency: "MONTHLY",
    interval: "1",
    mode: "DAY_OF_MONTH",
    dayOfMonth: String(d.getUTCDate()),
    weekday: String(d.getUTCDay()),
    weekOfMonth: "1",
    endDate: "",
  };
}

function recurrenceSummary(r: RecurrenceDraft): string {
  const n = Math.max(1, Number(r.interval) || 1);
  const unit =
    r.frequency === "WEEKLY" ? (n === 1 ? "week" : `${n} weeks`)
    : r.frequency === "MONTHLY" ? (n === 1 ? "month" : `${n} months`)
    : r.frequency === "QUARTERLY" ? (n === 1 ? "quarter" : `${n} quarters`)
    : n === 1 ? "year" : `${n} years`;
  if (r.frequency === "WEEKLY") {
    return `Every ${unit} on ${WEEKDAY_LABELS[Number(r.weekday)] ?? "—"}`;
  }
  if (r.mode === "NTH_WEEKDAY") {
    const nth = WEEK_OF_MONTH_LABELS[Number(r.weekOfMonth)] ?? "first";
    return `Every ${unit} on the ${nth} ${WEEKDAY_LABELS[Number(r.weekday)] ?? "—"}`;
  }
  return `Every ${unit} on the ${ordinal(Number(r.dayOfMonth) || 1)}`;
}

export default function PlanDialog({
  mode,
  date,
  plan,
  staff,
  onClose,
  onCreated,
  onCreatedSeries,
  onUpdated,
  onDeleted,
  onReleased,
}: {
  mode: "add" | "edit";
  date: Date | null;
  plan: CalendarPlan | null;
  staff: StaffOption[];
  onClose: () => void;
  onCreated: (plan: CalendarPlan) => void;
  onCreatedSeries: () => void;
  onUpdated: (plan: CalendarPlan) => void;
  onDeleted: (id: string) => void;
  onReleased: (id: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft>(() =>
    mode === "edit" && plan ? draftFromPlan(plan) : emptyDraft(date),
  );
  const [recurrence, setRecurrence] = useState<RecurrenceDraft>(() => emptyRecurrence(date));
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
  const setR = <K extends keyof RecurrenceDraft>(key: K, value: RecurrenceDraft[K]) =>
    setRecurrence((r) => ({ ...r, [key]: value }));

  const isOther = draft.reportType === REPORT_TYPE_OTHER_VALUE;
  const staffOptions = [STAFF_EMPTY_OPTION, ...staff.map((s) => ({ value: s.id, label: s.label }))];

  const previewQueueDate = useMemo(() => {
    if (draft.queueOnDate) return draft.queueOnDate;
    if (!draft.eventDate) return null;
    const days = Number(draft.leadDays) || 0;
    const d = new Date(`${draft.eventDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return toDateKey(d);
  }, [draft.eventDate, draft.leadDays, draft.queueOnDate]);

  async function createPlan() {
    if (!draft.city) return setError("Choose which city this is for.");
    if (!draft.placeName.trim()) return setError("Name the event or report.");
    if (isOther && !draft.reportTypeOther.trim()) return setError("Describe the report.");
    if (recurrence.enabled && !draft.eventDate) return setError("A repeating plan needs a first date.");

    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        city: draft.city,
        placeName: draft.placeName,
        locationAddress: draft.locationAddress,
        reportType: draft.reportType,
        reportTypeOther: draft.reportTypeOther,
        purpose: draft.purpose,
        eventDate: draft.eventDate,
        eventEndDate: draft.eventEndDate,
        leadDays: draft.leadDays,
        queueOnDate: draft.queueOnDate,
        assignedToId: draft.assignedToId || null,
      };
      if (recurrence.enabled) {
        body.recurrence = {
          frequency: recurrence.frequency,
          interval: recurrence.interval,
          mode: recurrence.frequency === "WEEKLY" ? "DAY_OF_MONTH" : recurrence.mode,
          dayOfMonth: recurrence.mode === "DAY_OF_MONTH" ? recurrence.dayOfMonth : null,
          weekday:
            recurrence.frequency === "WEEKLY" || recurrence.mode === "NTH_WEEKDAY"
              ? recurrence.weekday
              : null,
          weekOfMonth: recurrence.mode === "NTH_WEEKDAY" ? recurrence.weekOfMonth : null,
          endDate: recurrence.endDate,
        };
      }
      const res = await fetch("/api/placer-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json().catch(() => null);
      if (!res.ok) throw new Error(responseBody?.error ?? "Could not add the plan.");

      if (recurrence.enabled) {
        toast.success(
          `Repeating plan created${
            typeof responseBody?.occurrencesCreated === "number"
              ? ` — ${responseBody.occurrencesCreated} dates added to the calendar`
              : ""
          }.`,
        );
        onCreatedSeries();
      } else {
        const p = responseBody.plan;
        onCreated({
          id: p.id,
          city: p.city,
          placeName: p.placeName,
          locationAddress: draft.locationAddress || null,
          reportType: p.reportType,
          reportTypeOther: p.reportTypeOther,
          purpose: draft.purpose || null,
          eventDate: p.dateRangeStart,
          eventEndDate: p.dateRangeEnd,
          queueOnDate: p.queueOnDate,
          assignedToId: p.assignedToId,
          assignedToName: staff.find((s) => s.id === p.assignedToId)?.label ?? null,
          seriesId: null,
        });
        toast.success("Added to the planning calendar.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the plan.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/placer-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeName: draft.placeName,
          locationAddress: draft.locationAddress,
          reportType: draft.reportType,
          reportTypeOther: draft.reportTypeOther,
          purpose: draft.purpose,
          eventDate: draft.eventDate,
          eventEndDate: draft.eventEndDate,
          queueOnDate: draft.queueOnDate,
          assignedToId: draft.assignedToId || null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not save.");
      onUpdated({
        ...plan,
        placeName: draft.placeName,
        locationAddress: draft.locationAddress || null,
        reportType: draft.reportType,
        reportTypeOther: draft.reportTypeOther || null,
        purpose: draft.purpose || null,
        eventDate: body.plan.dateRangeStart,
        eventEndDate: body.plan.dateRangeEnd,
        queueOnDate: body.plan.queueOnDate,
        assignedToId: body.plan.assignedToId,
        assignedToName: staff.find((s) => s.id === body.plan.assignedToId)?.label ?? null,
      });
      toast.success("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function releaseNow() {
    if (!plan) return;
    const ok = await confirm({
      title: "Release into the queue now?",
      description: `${plan.placeName} will move to the fulfillment board as a live request, regardless of its queue date.`,
      confirmLabel: "Release now",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/placer-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ release: true }),
      });
      if (!res.ok) throw new Error("Failed");
      onReleased(plan.id);
    } catch {
      toast.error("Could not release this plan.");
      setBusy(false);
    }
  }

  async function deletePlan() {
    if (!plan) return;
    const ok = await confirm({
      title: "Remove this plan?",
      description: "It will come off the planning calendar.",
      confirmLabel: "Remove plan",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/placer-plans/${plan.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      onDeleted(plan.id);
    } catch {
      toast.error("Could not remove this plan.");
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {mode === "add" ? "Add a plan" : plan?.placeName}
          </h2>
          {mode === "edit" && plan?.seriesId && (
            <span className="badge bg-indigo-100 text-indigo-800">From a recurring plan</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {mode === "add"
            ? "A request we know is coming. It joins the live queue automatically on its queue date."
            : "Edit this occurrence, release it into the queue early, or remove it."}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {mode === "add" && (
            <Field label="City *">
              <Select value={draft.city} onChange={(v) => set("city", v)} options={CITY_OPTIONS} />
            </Field>
          )}
          <Field label="Assigned to">
            <Select value={draft.assignedToId} onChange={(v) => set("assignedToId", v)} options={staffOptions} />
          </Field>

          <Field label="Place / event name *">
            <Text value={draft.placeName} onChange={(v) => set("placeName", v)} placeholder="e.g. Buda Christmas Parade" />
          </Field>
          <Field label="Address or area">
            <Text value={draft.locationAddress} onChange={(v) => set("locationAddress", v)} />
          </Field>

          <Field label="Report type">
            <Select value={draft.reportType} onChange={(v) => set("reportType", v)} options={REPORT_TYPE_OPTIONS} />
          </Field>
          {isOther && (
            <Field label="Describe the report *">
              <Text value={draft.reportTypeOther} onChange={(v) => set("reportTypeOther", v)} />
            </Field>
          )}

          <Field label={mode === "add" ? "Event date" : "Event date"}>
            <DateInput value={draft.eventDate} onChange={(v) => set("eventDate", v)} />
          </Field>
          <Field label="Event end date (optional)">
            <DateInput value={draft.eventEndDate} onChange={(v) => set("eventEndDate", v)} />
          </Field>

          {mode === "add" ? (
            <Field label="Days after the event to queue it" hint={previewQueueDate ? `Queues ${formatDate(previewQueueDate)}` : undefined}>
              <input
                type="number"
                min={0}
                className="input mono"
                value={draft.leadDays}
                onChange={(e) => set("leadDays", e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Queue date">
              <DateInput value={draft.queueOnDate} onChange={(v) => set("queueOnDate", v)} />
            </Field>
          )}

          <div className="sm:col-span-2">
            <Field label="Purpose & details">
              <Area value={draft.purpose} onChange={(v) => set("purpose", v)} rows={2} />
            </Field>
          </div>
        </div>

        {mode === "add" && (
          <div className="mt-4 rounded-lg border border-line p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={recurrence.enabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  // Re-anchor the pattern's weekday/day-of-month to whatever
                  // event date is in the form right now, so checking "Repeats"
                  // after typing a date doesn't leave it defaulted to today.
                  const anchor = draft.eventDate
                    ? new Date(`${draft.eventDate}T00:00:00.000Z`)
                    : new Date();
                  const nth = Math.ceil(anchor.getUTCDate() / 7);
                  setRecurrence((r) => ({
                    ...r,
                    enabled: checked,
                    dayOfMonth: checked ? String(anchor.getUTCDate()) : r.dayOfMonth,
                    weekday: checked ? String(anchor.getUTCDay()) : r.weekday,
                    weekOfMonth: checked ? String(nth) : r.weekOfMonth,
                  }));
                }}
              />
              Repeats
            </label>
            {recurrence.enabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Frequency">
                  <Select
                    value={recurrence.frequency}
                    onChange={(v) => setR("frequency", v as RecurrenceDraft["frequency"])}
                    options={RECURRENCE_OPTIONS}
                  />
                </Field>
                <Field label="Every">
                  <input
                    type="number"
                    min={1}
                    className="input mono"
                    value={recurrence.interval}
                    onChange={(e) => setR("interval", e.target.value)}
                  />
                </Field>

                {recurrence.frequency !== "WEEKLY" && (
                  <div className="sm:col-span-2">
                    <Field label="Which day">
                      <Select
                        value={recurrence.mode}
                        onChange={(v) => setR("mode", v as RecurrenceDraft["mode"])}
                        options={MODE_OPTIONS}
                      />
                    </Field>
                  </div>
                )}

                {recurrence.frequency !== "WEEKLY" && recurrence.mode === "DAY_OF_MONTH" && (
                  <Field label="Day of month">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className="input mono"
                      value={recurrence.dayOfMonth}
                      onChange={(e) => setR("dayOfMonth", e.target.value)}
                    />
                  </Field>
                )}

                {(recurrence.frequency === "WEEKLY" || recurrence.mode === "NTH_WEEKDAY") && (
                  <>
                    {recurrence.mode === "NTH_WEEKDAY" && recurrence.frequency !== "WEEKLY" && (
                      <Field label="Week of month">
                        <Select
                          value={recurrence.weekOfMonth}
                          onChange={(v) => setR("weekOfMonth", v)}
                          options={WEEK_OF_MONTH_OPTIONS}
                        />
                      </Field>
                    )}
                    <Field label="Weekday">
                      <Select
                        value={recurrence.weekday}
                        onChange={(v) => setR("weekday", v)}
                        options={WEEKDAY_OPTIONS}
                      />
                    </Field>
                  </>
                )}

                <Field label="Ends (optional)">
                  <DateInput value={recurrence.endDate} onChange={(v) => setR("endDate", v)} />
                </Field>
                <div className="flex items-end pb-1.5 text-xs text-muted">
                  {recurrenceSummary(recurrence)}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {mode === "edit" && plan && (
              <>
                <button type="button" className="btn-danger h-8 py-1 text-xs" onClick={deletePlan} disabled={busy}>
                  Remove
                </button>
                <AssignTaskButton
                  staff={staff}
                  defaultTitle={`Follow up: ${plan.placeName}`}
                  className="btn-secondary h-8 py-1 text-xs"
                />
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary h-8 py-1 text-xs" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            {mode === "edit" && plan && (
              <button type="button" className="btn-secondary h-8 py-1 text-xs" onClick={releaseNow} disabled={busy}>
                Release now
              </button>
            )}
            <button
              type="button"
              className="btn-primary h-8 py-1 text-xs"
              onClick={mode === "add" ? createPlan : saveEdit}
              disabled={busy}
            >
              {busy ? "Saving…" : mode === "add" ? "Add plan" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
