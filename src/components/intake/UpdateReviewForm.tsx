"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedProject } from "@/lib/anthropic/schema";

type Kind = "text" | "number" | "date" | "csv";

interface FieldDef {
  key: string;
  label: string;
  kind: Kind;
}

// Scalar + simple-list fields an incoming update is likely to revise. Repeated
// structured data (job phases, utilities, criteria) is edited on the project
// page, not merged here.
const FIELDS: FieldDef[] = [
  { key: "codename", label: "Codename", kind: "text" },
  { key: "naicsCode", label: "NAICS", kind: "text" },
  { key: "industryDescription", label: "Industry", kind: "text" },
  { key: "projectType", label: "Project type", kind: "text" },
  { key: "sourceContactName", label: "Source contact", kind: "text" },
  { key: "sourceContactEmail", label: "Source email", kind: "text" },
  { key: "submissionDestination", label: "Submit to", kind: "text" },
  { key: "capexTotal", label: "Total capex", kind: "number" },
  { key: "capexLand", label: "Capex — land", kind: "number" },
  { key: "capexBuilding", label: "Capex — building", kind: "number" },
  { key: "capexEquipment", label: "Capex — equipment", kind: "number" },
  { key: "avgWage", label: "Avg wage", kind: "number" },
  { key: "minAcreage", label: "Min acreage", kind: "number" },
  { key: "buildingSizeNeeds", label: "Building size", kind: "text" },
  { key: "financingNotes", label: "Financing notes", kind: "text" },
  { key: "narrative", label: "Narrative", kind: "text" },
  { key: "siteLocationPreferences", label: "Location prefs", kind: "csv" },
  { key: "requiredDeliverables", label: "Deliverables", kind: "csv" },
  { key: "rfiReceivedDate", label: "RFI received", kind: "date" },
  { key: "responseDueDate", label: "Response due", kind: "date" },
  { key: "responseSubmittedDate", label: "Response submitted", kind: "date" },
  { key: "projectedDecisionDate", label: "Projected decision", kind: "date" },
  { key: "productionStartDate", label: "Start of production", kind: "date" },
];

// Normalize any raw value to the string shown in the input.
function toInput(v: unknown, kind: Kind): string {
  if (v == null) return "";
  if (kind === "csv") return Array.isArray(v) ? v.join(", ") : String(v);
  if (kind === "date") return String(v).slice(0, 10);
  return String(v);
}

export default function UpdateReviewForm({
  projectId,
  proposal,
}: {
  projectId: string;
  proposal: ParsedProject;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [apply, setApply] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error("Could not load the existing project.");
        const json = await res.json();
        const proj = json.project as Record<string, unknown>;
        setCurrent(proj);

        const v: Record<string, string> = {};
        const a: Record<string, boolean> = {};
        for (const f of FIELDS) {
          const proposed = toInput(
            (proposal as Record<string, unknown>)[f.key],
            f.kind,
          );
          v[f.key] = proposed;
          const existing = toInput(proj[f.key], f.kind);
          // Default to applying only changes the parser actually found.
          a[f.key] = proposed !== "" && proposed !== existing;
        }
        setValues(v);
        setApply(a);
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
  }, [projectId, proposal]);

  async function submit() {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of FIELDS) {
        if (!apply[f.key]) continue;
        const raw = values[f.key]?.trim() ?? "";
        if (f.kind === "number") {
          payload[f.key] = raw === "" ? null : Number(raw);
        } else if (f.kind === "csv") {
          payload[f.key] = raw
            ? raw.split(",").map((x) => x.trim()).filter(Boolean)
            : [];
        } else {
          payload[f.key] = raw === "" ? null : raw;
        }
      }
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to apply updates.");
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {loadError}
      </div>
    );
  }
  if (!current) {
    return <p className="text-sm text-gray-500">Loading existing project…</p>;
  }

  const changed = FIELDS.filter(
    (f) => values[f.key] !== toInput(current[f.key], f.kind),
  );
  const appliedCount = FIELDS.filter((f) => apply[f.key]).length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Review update to {String(current.codename ?? "project")}
        </h1>
        <p className="text-sm text-gray-500">
          Nothing changes until you apply. Check the fields to update; edit any
          proposed value first if needed. {changed.length} field
          {changed.length === 1 ? "" : "s"} differ from the current record.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="w-10 py-2 pl-3">Apply</th>
              <th className="py-2 pr-3">Field</th>
              <th className="py-2 pr-3">Current</th>
              <th className="py-2 pr-3">Proposed (editable)</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => {
              const cur = toInput(current[f.key], f.kind);
              const differs = values[f.key] !== cur;
              return (
                <tr
                  key={f.key}
                  className={`border-b border-gray-100 align-top ${
                    differs ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="py-2 pl-3">
                    <input
                      type="checkbox"
                      checked={apply[f.key] ?? false}
                      onChange={(e) =>
                        setApply((cur) => ({
                          ...cur,
                          [f.key]: e.target.checked,
                        }))
                      }
                    />
                  </td>
                  <td className="py-2 pr-3 font-medium text-gray-700">
                    {f.label}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">
                    {cur === "" ? "—" : cur}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type={f.kind === "date" ? "date" : "text"}
                      className="input text-sm"
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues((cur) => ({
                          ...cur,
                          [f.key]: e.target.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-gray-500">
          {appliedCount} field{appliedCount === 1 ? "" : "s"} selected
        </span>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={saving || appliedCount === 0}
        >
          {saving ? "Applying…" : "Apply updates"}
        </button>
      </div>
    </div>
  );
}
