"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Area, DateInput, Field, NumberInput, Select, Text } from "@/components/intake/fields";
import { LEAD_SOURCE_LABELS, LEAD_SOURCE_OTHER_VALUE, isLegacyLeadSource, leadSourceLabel } from "@/lib/format";
import { NAME_REQUIRED_MESSAGE, hasUsableName, leadDisplayName } from "@/lib/leads/schema";
import { NAICS_OPTIONS } from "@/lib/naics";
import type { BoardLead } from "./LeadsBoard";

// The lead-source dropdown offers only the current values. When editing a lead
// that still carries a retired one, fold it in so the field shows what the row
// actually holds instead of silently displaying the first option.
function leadSourceOptions(current: string) {
  const options = Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  if (isLegacyLeadSource(current)) {
    options.unshift({ value: current, label: leadSourceLabel(current) });
  }
  return options;
}

// The editable shape, all strings/nulls as the inputs want them.
type Draft = {
  codename: string;
  companyName: string;
  leadSource: string;
  leadSourceOther: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyLocationRaw: string;
  naicsCode: string;
  industryDescription: string;
  estimatedCapex: number | null;
  estimatedJobs: number | null;
  minAcreage: number | null;
  minBuildingSqFt: number | null;
  notes: string;
  nextFollowUpDate: string;
};

function toDraft(lead: BoardLead | null): Draft {
  return {
    codename: lead?.codename ?? "",
    companyName: lead?.companyName ?? "",
    leadSource: lead?.leadSource ?? LEAD_SOURCE_OTHER_VALUE,
    leadSourceOther: lead?.leadSourceOther ?? "",
    contactName: lead?.contactName ?? "",
    contactEmail: lead?.contactEmail ?? "",
    contactPhone: lead?.contactPhone ?? "",
    companyLocationRaw: lead?.companyLocationRaw ?? "",
    naicsCode: lead?.naicsCode ?? "",
    industryDescription: lead?.industryDescription ?? "",
    estimatedCapex: lead?.estimatedCapex ? Number(lead.estimatedCapex) : null,
    estimatedJobs: lead?.estimatedJobs ?? null,
    minAcreage: lead?.minAcreage ?? null,
    minBuildingSqFt: lead?.minBuildingSqFt ?? null,
    notes: lead?.notes ?? "",
    // <input type="date"> wants YYYY-MM-DD, not an ISO timestamp.
    nextFollowUpDate: lead?.nextFollowUpDate?.slice(0, 10) ?? "",
  };
}

// Empty strings mean "cleared" to the API, which is what we want for a form.
function toPayload(d: Draft) {
  return {
    codename: d.codename,
    companyName: d.companyName,
    leadSource: d.leadSource,
    leadSourceOther: d.leadSource === LEAD_SOURCE_OTHER_VALUE ? d.leadSourceOther : "",
    contactName: d.contactName,
    contactEmail: d.contactEmail,
    contactPhone: d.contactPhone,
    companyLocationRaw: d.companyLocationRaw,
    naicsCode: d.naicsCode,
    industryDescription: d.industryDescription,
    estimatedCapex: d.estimatedCapex,
    estimatedJobs: d.estimatedJobs,
    minAcreage: d.minAcreage,
    minBuildingSqFt: d.minBuildingSqFt,
    notes: d.notes,
    nextFollowUpDate: d.nextFollowUpDate || null,
  };
}

export default function LeadDialog({
  lead,
  onClose,
  onSaved,
}: {
  /** null = creating a new lead. */
  lead: BoardLead | null;
  onClose: () => void;
  onSaved: (lead: BoardLead) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(lead));
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

  async function save() {
    if (!hasUsableName(draft)) {
      setError(NAME_REQUIRED_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(lead ? `/api/leads/${lead.id}` : "/api/leads", {
        method: lead ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(draft)),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not save the lead.");
      onSaved(body.lead as BoardLead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the lead.");
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
        <h2 className="text-base font-semibold text-foreground">
          {lead ? `Edit ${leadDisplayName(lead)}` : "New lead"}
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Give the lead a codename or a company name — everything else can follow.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Codename" hint="Optional until the lead has one.">
            <Text value={draft.codename} onChange={(v) => set("codename", v)} />
          </Field>
          <Field
            label="Company name"
            hint="Stands in for the codename on the card if there isn't one."
          >
            <Text value={draft.companyName} onChange={(v) => set("companyName", v)} />
          </Field>

          <Field label="Lead source">
            <Select
              value={draft.leadSource}
              onChange={(v) => set("leadSource", v)}
              options={leadSourceOptions(draft.leadSource)}
            />
          </Field>
          {draft.leadSource === LEAD_SOURCE_OTHER_VALUE && (
            <Field label="Lead source detail">
              <Text
                value={draft.leadSourceOther}
                onChange={(v) => set("leadSourceOther", v)}
              />
            </Field>
          )}

          <Field label="Contact name">
            <Text value={draft.contactName} onChange={(v) => set("contactName", v)} />
          </Field>
          <Field label="Contact email">
            <Text value={draft.contactEmail} onChange={(v) => set("contactEmail", v)} />
          </Field>
          <Field label="Contact phone">
            <Text value={draft.contactPhone} onChange={(v) => set("contactPhone", v)} />
          </Field>
          <Field label="Company location" hint='e.g. "Chicago, IL" or "Germany"'>
            <Text
              value={draft.companyLocationRaw}
              onChange={(v) => set("companyLocationRaw", v)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="NAICS code">
              <Select
                value={draft.naicsCode}
                onChange={(v) => set("naicsCode", v)}
                options={NAICS_OPTIONS}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Industry description">
              <Text
                value={draft.industryDescription}
                onChange={(v) => set("industryDescription", v)}
              />
            </Field>
          </div>

          <Field label="Estimated capex (USD)">
            <NumberInput
              value={draft.estimatedCapex}
              onChange={(v) => set("estimatedCapex", v)}
            />
          </Field>
          <Field label="Estimated jobs">
            <NumberInput
              value={draft.estimatedJobs}
              onChange={(v) => set("estimatedJobs", v)}
            />
          </Field>
          <Field label="Min acreage">
            <NumberInput value={draft.minAcreage} onChange={(v) => set("minAcreage", v)} />
          </Field>
          <Field label="Min building sq ft">
            <NumberInput
              value={draft.minBuildingSqFt}
              onChange={(v) => set("minBuildingSqFt", v)}
            />
          </Field>
          <Field label="Next follow-up">
            <DateInput
              value={draft.nextFollowUpDate}
              onChange={(v) => set("nextFollowUpDate", v)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes" hint="Carried onto the project narrative on conversion.">
              <Area value={draft.notes} onChange={(v) => set("notes", v)} rows={3} />
            </Field>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : lead ? "Save changes" : "Create lead"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
