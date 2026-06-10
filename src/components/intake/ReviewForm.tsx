"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedProject, StagedAttachment } from "@/lib/anthropic/schema";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { LEAD_SOURCE_LABELS } from "@/lib/format";
import {
  Field,
  Text,
  Area,
  NumberInput,
  DateInput,
  Select,
  Section,
} from "./fields";

const LEAD_SOURCE_OPTIONS = Object.entries(LEAD_SOURCE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const UTILITY_OPTIONS = [
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "WATER", label: "Water" },
  { value: "WASTEWATER", label: "Wastewater" },
  { value: "GAS", label: "Gas" },
];

type Util = ParsedProject["utilities"][number];
type Datapoint = Util["datapoints"][number];

function csv(arr: string[] | undefined): string {
  return (arr ?? []).join(", ");
}
function fromCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function d(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export default function ReviewForm({
  proposal: initial,
  attachments,
  rawEmailText,
  parsedModel,
  parserAvailable,
}: {
  proposal: ParsedProject;
  attachments: StagedAttachment[];
  rawEmailText: string;
  parsedModel: string | null;
  parserAvailable: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState<ParsedProject>(initial);
  const [stage, setStage] = useState<PipelineStageValue>("RFI_RECEIVED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ParsedProject>(key: K, value: ParsedProject[K]) {
    setP((cur) => ({ ...cur, [key]: value }));
  }

  // --- array helpers -------------------------------------------------------
  function updateUtil(i: number, patch: Partial<Util>) {
    setP((cur) => {
      const utilities = [...cur.utilities];
      utilities[i] = { ...utilities[i], ...patch };
      return { ...cur, utilities };
    });
  }
  function updateDatapoint(ui: number, di: number, patch: Partial<Datapoint>) {
    setP((cur) => {
      const utilities = [...cur.utilities];
      const datapoints = [...utilities[ui].datapoints];
      datapoints[di] = { ...datapoints[di], ...patch };
      utilities[ui] = { ...utilities[ui], datapoints };
      return { ...cur, utilities };
    });
  }

  const flags = p.parseWarnings ?? [];
  const flagged = (field: string) => flags.some((w) => w.field === field);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...p,
          stage,
          rawEmailText,
          parsedModel,
          attachments,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save project.");
        setSaving(false);
        return;
      }
      router.push(`/projects/${json.project.id}`);
    } catch {
      setError("Network error while saving.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Review parsed RFI
          </h1>
          <p className="text-sm text-gray-500">
            {parserAvailable
              ? `Parsed with ${parsedModel}. Review and edit, then save — nothing is stored until you click Save.`
              : "Parser unavailable — fill the fields manually, then save."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={stage}
            onChange={(v) => setStage(v as PipelineStageValue)}
            options={PIPELINE_STAGES}
          />
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save project"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {flags.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-800">
            {flags.length} value{flags.length === 1 ? "" : "s"} to verify
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-700">
            {flags.map((w, i) => (
              <li key={i}>
                <span className="font-medium">{w.field}</span>
                {w.kind ? ` (${w.kind})` : ""}: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Identity & source">
          <Field label="Codename">
            <Text value={p.codename} onChange={(v) => set("codename", v)} />
          </Field>
          <Field label="Lead source">
            <Select
              value={p.leadSource ?? "OTHER"}
              onChange={(v) => set("leadSource", v as ParsedProject["leadSource"])}
              options={LEAD_SOURCE_OPTIONS}
            />
          </Field>
          {p.leadSource === "OTHER" && (
            <Field label="Lead source (other)">
              <Text
                value={p.leadSourceOther ?? ""}
                onChange={(v) => set("leadSourceOther", v)}
              />
            </Field>
          )}
          <Field label="Source contact name">
            <Text
              value={p.sourceContactName ?? ""}
              onChange={(v) => set("sourceContactName", v)}
            />
          </Field>
          <Field label="Source contact email">
            <Text
              value={p.sourceContactEmail ?? ""}
              onChange={(v) => set("sourceContactEmail", v)}
            />
          </Field>
          <Field label="Submission destination">
            <Text
              value={p.submissionDestination ?? ""}
              onChange={(v) => set("submissionDestination", v)}
            />
          </Field>
        </Section>

        <Section title="Industry & narrative">
          <Field label="NAICS code" flagged={flagged("naicsCode")}>
            <Text value={p.naicsCode ?? ""} onChange={(v) => set("naicsCode", v)} />
          </Field>
          <Field label="Industry description">
            <Text
              value={p.industryDescription ?? ""}
              onChange={(v) => set("industryDescription", v)}
            />
          </Field>
          <Field label="Project type" hint="expansion, new location, build-to-suit…">
            <Text
              value={p.projectType ?? ""}
              onChange={(v) => set("projectType", v)}
            />
          </Field>
          <Field label="Narrative">
            <Area
              value={p.narrative ?? ""}
              onChange={(v) => set("narrative", v)}
              rows={5}
            />
          </Field>
        </Section>

        <Section title="Capital investment">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total (USD)" flagged={flagged("capexTotal")}>
              <NumberInput value={p.capexTotal ?? null} onChange={(v) => set("capexTotal", v)} />
            </Field>
            <Field label="Land (USD)">
              <NumberInput value={p.capexLand ?? null} onChange={(v) => set("capexLand", v)} />
            </Field>
            <Field label="Building (USD)">
              <NumberInput value={p.capexBuilding ?? null} onChange={(v) => set("capexBuilding", v)} />
            </Field>
            <Field label="Equipment (USD)">
              <NumberInput value={p.capexEquipment ?? null} onChange={(v) => set("capexEquipment", v)} />
            </Field>
          </div>
          <Field label="Financing notes">
            <Area value={p.financingNotes ?? ""} onChange={(v) => set("financingNotes", v)} />
          </Field>
        </Section>

        <Section title="Jobs & wages">
          <Field label="Average wage (USD)">
            <NumberInput value={p.avgWage ?? null} onChange={(v) => set("avgWage", v)} />
          </Field>
          <div className="space-y-2">
            <span className="label">Phased job counts</span>
            {(p.jobPhases ?? []).map((j, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  className="input w-24"
                  value={j.count}
                  onChange={(e) =>
                    setP((cur) => {
                      const jobPhases = [...cur.jobPhases];
                      jobPhases[i] = { ...jobPhases[i], count: Number(e.target.value) };
                      return { ...cur, jobPhases };
                    })
                  }
                />
                <input
                  className="input flex-1"
                  placeholder="timeframe (e.g. Year One)"
                  value={j.timeframe}
                  onChange={(e) =>
                    setP((cur) => {
                      const jobPhases = [...cur.jobPhases];
                      jobPhases[i] = { ...jobPhases[i], timeframe: e.target.value };
                      return { ...cur, jobPhases };
                    })
                  }
                />
                <button
                  className="btn-danger"
                  onClick={() =>
                    setP((cur) => ({
                      ...cur,
                      jobPhases: cur.jobPhases.filter((_, x) => x !== i),
                    }))
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn-secondary"
              onClick={() =>
                setP((cur) => ({
                  ...cur,
                  jobPhases: [...cur.jobPhases, { count: 0, timeframe: "" }],
                }))
              }
            >
              + Add job phase
            </button>
          </div>
        </Section>

        <Section title="Site requirements">
          <Field label="Minimum acreage" flagged={flagged("minAcreage")}>
            <NumberInput value={p.minAcreage ?? null} onChange={(v) => set("minAcreage", v)} />
          </Field>
          <Field label="Building size / needs">
            <Area value={p.buildingSizeNeeds ?? ""} onChange={(v) => set("buildingSizeNeeds", v)} />
          </Field>
          <Field label="Site location preferences" hint="comma-separated">
            <Text
              value={csv(p.siteLocationPreferences)}
              onChange={(v) => set("siteLocationPreferences", fromCsv(v))}
            />
          </Field>
        </Section>

        <Section title="Dates">
          <div className="grid grid-cols-2 gap-3">
            <Field label="RFI received" flagged={flagged("rfiReceivedDate")}>
              <DateInput value={d(p.rfiReceivedDate)} onChange={(v) => set("rfiReceivedDate", v || null)} />
            </Field>
            <Field label="Response due" flagged={flagged("responseDueDate")}>
              <DateInput value={d(p.responseDueDate)} onChange={(v) => set("responseDueDate", v || null)} />
            </Field>
            <Field label="Projected decision">
              <DateInput value={d(p.projectedDecisionDate)} onChange={(v) => set("projectedDecisionDate", v || null)} />
            </Field>
            <Field label="Start of production">
              <DateInput value={d(p.productionStartDate)} onChange={(v) => set("productionStartDate", v || null)} />
            </Field>
            <Field label="Response submitted" hint="filled in when we respond">
              <DateInput value={d(p.responseSubmittedDate)} onChange={(v) => set("responseSubmittedDate", v || null)} />
            </Field>
            <Field label="Site visit" hint="filled in later">
              <DateInput value={d(p.siteVisitDate)} onChange={(v) => set("siteVisitDate", v || null)} />
            </Field>
          </div>
        </Section>
      </div>

      <Section
        title="Critical criteria"
        description="Ranked must-haves, in order of importance — these drive site selection and become the Yes/No columns of the Site Summary."
      >
        {(p.criticalCriteria ?? []).map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-sm font-semibold text-gray-400">{i + 1}.</span>
            <input
              className="input flex-1"
              value={c.text}
              onChange={(e) =>
                setP((cur) => {
                  const criticalCriteria = [...cur.criticalCriteria];
                  criticalCriteria[i] = { ...criticalCriteria[i], text: e.target.value, rank: i + 1 };
                  return { ...cur, criticalCriteria };
                })
              }
            />
            <button
              className="btn-danger"
              onClick={() =>
                setP((cur) => ({
                  ...cur,
                  criticalCriteria: cur.criticalCriteria
                    .filter((_, x) => x !== i)
                    .map((cc, idx) => ({ ...cc, rank: idx + 1 })),
                }))
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="btn-secondary"
          onClick={() =>
            setP((cur) => ({
              ...cur,
              criticalCriteria: [
                ...cur.criticalCriteria,
                { rank: cur.criticalCriteria.length + 1, text: "" },
              ],
            }))
          }
        >
          + Add criterion
        </button>
      </Section>

      <Section
        title="Utility requirements"
        description="Normalized values with raw values retained. Electricity → MW, water/wastewater → thousand gal/day, gas → thousand ft³/day."
      >
        {(p.utilities ?? []).map((u, ui) => (
          <div key={ui} className="rounded-md border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <Select
                value={u.type}
                onChange={(v) => updateUtil(ui, { type: v as Util["type"] })}
                options={UTILITY_OPTIONS}
              />
              {u.flagged && (
                <span className="badge bg-amber-100 text-amber-800">verify</span>
              )}
              <button
                className="btn-danger ml-auto"
                onClick={() =>
                  setP((cur) => ({
                    ...cur,
                    utilities: cur.utilities.filter((_, x) => x !== ui),
                  }))
                }
              >
                Remove
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Normalized value">
                <NumberInput value={u.normalizedValue ?? null} onChange={(v) => updateUtil(ui, { normalizedValue: v })} />
              </Field>
              <Field label="Normalized unit">
                <Text value={u.normalizedUnit ?? ""} onChange={(v) => updateUtil(ui, { normalizedUnit: v })} />
              </Field>
              <Field label="Raw value (verbatim)">
                <Text value={u.rawValue ?? ""} onChange={(v) => updateUtil(ui, { rawValue: v })} />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Purpose">
                <Text value={u.purpose ?? ""} onChange={(v) => updateUtil(ui, { purpose: v })} />
              </Field>
              <Field label="Alternatives">
                <Text value={u.alternatives ?? ""} onChange={(v) => updateUtil(ui, { alternatives: v })} />
              </Field>
            </div>
            {u.assumptionNote && (
              <p className="mt-2 text-xs text-amber-700">
                Assumption: {u.assumptionNote}
              </p>
            )}

            {/* datapoints */}
            <div className="mt-3">
              <span className="label">Datapoints (time-phased)</span>
              {(u.datapoints ?? []).map((dp, di) => (
                <div
                  key={di}
                  className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-5"
                >
                  <input
                    className="input"
                    placeholder="kind"
                    value={dp.kind ?? ""}
                    onChange={(e) => updateDatapoint(ui, di, { kind: e.target.value })}
                  />
                  <input
                    type="number"
                    className="input"
                    placeholder="value"
                    value={dp.value ?? ""}
                    onChange={(e) =>
                      updateDatapoint(ui, di, {
                        value: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                  <input
                    className="input"
                    placeholder="unit"
                    value={dp.unit ?? ""}
                    onChange={(e) => updateDatapoint(ui, di, { unit: e.target.value })}
                  />
                  <input
                    type="date"
                    className="input"
                    value={d(dp.date)}
                    onChange={(e) => updateDatapoint(ui, di, { date: e.target.value || null })}
                  />
                  <button
                    className="btn-danger"
                    onClick={() =>
                      updateUtil(ui, {
                        datapoints: u.datapoints.filter((_, x) => x !== di),
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="btn-secondary mt-2"
                onClick={() =>
                  updateUtil(ui, {
                    datapoints: [
                      ...u.datapoints,
                      { kind: "", label: null, value: null, unit: u.normalizedUnit ?? "", date: null, rawValue: null, flagged: false, assumptionNote: null },
                    ],
                  })
                }
              >
                + Add datapoint
              </button>
            </div>
          </div>
        ))}
        <button
          className="btn-secondary"
          onClick={() =>
            setP((cur) => ({
              ...cur,
              utilities: [
                ...cur.utilities,
                { type: "ELECTRICITY", normalizedValue: null, normalizedUnit: "MW", rawValue: null, purpose: null, alternatives: null, notes: null, flagged: false, assumptionNote: null, datapoints: [] },
              ],
            }))
          }
        >
          + Add utility
        </button>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Notes">
          <Field label="Environmental notes">
            <Area value={p.environmentalNotes ?? ""} onChange={(v) => set("environmentalNotes", v)} />
          </Field>
          <Field label="Transportation notes">
            <Area value={p.transportationNotes ?? ""} onChange={(v) => set("transportationNotes", v)} />
          </Field>
          <Field label="Special services notes">
            <Area value={p.specialServicesNotes ?? ""} onChange={(v) => set("specialServicesNotes", v)} />
          </Field>
          <Field label="Required deliverables" hint="comma-separated">
            <Text
              value={csv(p.requiredDeliverables)}
              onChange={(v) => set("requiredDeliverables", fromCsv(v))}
            />
          </Field>
        </Section>

        <Section
          title="Qualitative needs"
          description="Soft needs that don't fit a structured field (e.g. supportive educational ecosystem)."
        >
          {(p.qualitativeNotes ?? []).map((q, i) => (
            <div key={i} className="space-y-1 rounded-md border border-gray-200 p-2">
              <input
                className="input"
                placeholder="label"
                value={q.label}
                onChange={(e) =>
                  setP((cur) => {
                    const qualitativeNotes = [...cur.qualitativeNotes];
                    qualitativeNotes[i] = { ...qualitativeNotes[i], label: e.target.value };
                    return { ...cur, qualitativeNotes };
                  })
                }
              />
              <textarea
                className="input"
                rows={2}
                placeholder="content"
                value={q.content}
                onChange={(e) =>
                  setP((cur) => {
                    const qualitativeNotes = [...cur.qualitativeNotes];
                    qualitativeNotes[i] = { ...qualitativeNotes[i], content: e.target.value };
                    return { ...cur, qualitativeNotes };
                  })
                }
              />
              <button
                className="btn-danger"
                onClick={() =>
                  setP((cur) => ({
                    ...cur,
                    qualitativeNotes: cur.qualitativeNotes.filter((_, x) => x !== i),
                  }))
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn-secondary"
            onClick={() =>
              setP((cur) => ({
                ...cur,
                qualitativeNotes: [...cur.qualitativeNotes, { label: "", content: "" }],
              }))
            }
          >
            + Add qualitative note
          </button>
        </Section>
      </div>

      {attachments.length > 0 && (
        <Section title="Attachments" description="Stored with the project on save.">
          <ul className="list-disc pl-5 text-sm text-gray-600">
            {attachments.map((a) => (
              <li key={a.storageKey}>
                {a.fileName}{" "}
                <span className="text-gray-400">
                  ({Math.round(a.sizeBytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex justify-end gap-2 pb-10">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save project"}
        </button>
      </div>
    </div>
  );
}
