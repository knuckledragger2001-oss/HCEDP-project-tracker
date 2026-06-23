"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedProject, StagedAttachment } from "@/lib/anthropic/schema";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { LEAD_SOURCE_LABELS } from "@/lib/format";
import { NAICS_OPTIONS, NAICS_BY_CODE } from "@/lib/naics";
import {
  normalizeLocation,
  describeLocation,
  US_STATES,
  COUNTRIES,
} from "@/lib/location/normalize";

const LOCATION_SUGGESTIONS = [...Object.values(US_STATES), ...COUNTRIES];
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

// ---------------------------------------------------------------------------
// Warning helpers
// ---------------------------------------------------------------------------

type WarnCategory = "missing" | "verify" | "conversion" | "fyi";

const WARN_CATEGORY_META: Record<
  WarnCategory,
  { label: string; dot: string; border: string; bg: string; text: string; badge: string }
> = {
  missing:    { label: "Missing",          dot: "bg-red-500",   border: "border-red-200",   bg: "bg-red-50",   text: "text-red-800",   badge: "bg-red-100 text-red-700" },
  verify:     { label: "Verify",           dot: "bg-amber-500", border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" },
  conversion: { label: "Value Conversion", dot: "bg-blue-500",  border: "border-blue-200",  bg: "bg-blue-50",  text: "text-blue-800",  badge: "bg-blue-100 text-blue-700" },
  fyi:        { label: "FYI",              dot: "bg-gray-400",  border: "border-gray-200",  bg: "bg-gray-50",  text: "text-gray-700",  badge: "bg-gray-100 text-gray-600" },
};

function classifyWarning(kind: string | undefined): WarnCategory {
  if (kind === "missing")    return "missing";
  if (kind === "assumption") return "verify";
  if (kind === "conversion") return "conversion";
  return "fyi";
}

const TOP_LEVEL_FIELD_LABELS: Record<string, string> = {
  codename: "Project codename",
  naicsCode: "NAICS code",
  industryDescription: "Industry description",
  narrative: "Narrative",
  projectType: "Project type",
  capexTotal: "Total capital investment",
  capexLand: "Land investment",
  capexBuilding: "Building investment",
  capexEquipment: "Equipment investment",
  financingNotes: "Financing notes",
  avgWage: "Average wage",
  minAcreage: "Minimum acreage",
  rfiReceivedDate: "RFI received date",
  responseDueDate: "Response due date",
  projectedDecisionDate: "Projected decision date",
  productionStartDate: "Production start date",
  leadSource: "Lead source",
  leadSourceOther: "Lead source detail",
  sourceContactName: "Source contact name",
  sourceContactEmail: "Source contact email",
  submissionDestination: "Submission destination",
  buildingSizeNeeds: "Building size needs",
  siteLocationPreferences: "Site location preferences",
  requiredDeliverables: "Required deliverables",
  environmentalNotes: "Environmental notes",
  transportationNotes: "Transportation notes",
  specialServicesNotes: "Special services notes",
};

const UTILITY_TYPE_LABELS: Record<string, string> = {
  ELECTRICITY: "Electricity",
  WATER: "Water",
  WASTEWATER: "Wastewater",
  GAS: "Gas",
};

const UTILITY_SUBFIELD_LABELS: Record<string, string> = {
  normalizedValue: "normalized value",
  normalizedUnit: "unit",
  rawValue: "raw value",
  purpose: "purpose",
  alternatives: "alternatives",
  notes: "notes",
};

function friendlyFieldName(field: string): string {
  if (TOP_LEVEL_FIELD_LABELS[field]) return TOP_LEVEL_FIELD_LABELS[field];

  // utilities.ELECTRICITY.normalizedValue  or  utilities.WATER.datapoints[2].value
  const utilMatch = field.match(/^utilities\.([A-Z]+)\.?(.*)?$/);
  if (utilMatch) {
    const utilLabel = UTILITY_TYPE_LABELS[utilMatch[1]] ?? utilMatch[1];
    const rest = utilMatch[2] ?? "";
    if (!rest) return `${utilLabel} requirement`;
    const dpMatch = rest.match(/^datapoints\[(\d+)\]\.?(.*)$/);
    if (dpMatch) {
      const n = parseInt(dpMatch[1]) + 1;
      const sub = dpMatch[2] ? ` — ${dpMatch[2]}` : "";
      return `${utilLabel} load datapoint ${n}${sub}`;
    }
    const subLabel = UTILITY_SUBFIELD_LABELS[rest] ?? rest;
    return `${utilLabel} — ${subLabel}`;
  }

  // jobPhases[N] / criticalCriteria[N]
  const jpMatch = field.match(/^jobPhases\[(\d+)\]/);
  if (jpMatch) return `Job phase ${parseInt(jpMatch[1]) + 1}`;
  const ccMatch = field.match(/^criticalCriteria\[(\d+)\]/);
  if (ccMatch) return `Critical criterion #${parseInt(ccMatch[1]) + 1}`;

  // Fallback: camelCase → Title Case words
  return field
    .replace(/\[(\d+)\]/g, (_, n) => ` ${parseInt(n) + 1}`)
    .replace(/\./g, " — ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function WarningBuckets({ warnings }: { warnings: ParsedProject["parseWarnings"] }) {
  if (!warnings || warnings.length === 0) return null;

  const buckets = (["missing", "verify", "conversion", "fyi"] as WarnCategory[]).map(
    (cat) => ({ cat, items: warnings.filter((w) => classifyWarning(w.kind) === cat) }),
  ).filter((b) => b.items.length > 0);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">
          {warnings.length} parser note{warnings.length === 1 ? "" : "s"}
        </span>
        {buckets.map(({ cat, items }) => {
          const m = WARN_CATEGORY_META[cat];
          return (
            <span key={cat} className={`badge ${m.badge}`}>
              {items.length} {m.label}
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {buckets.map(({ cat, items }) => {
          const m = WARN_CATEGORY_META[cat];
          return (
            <div key={cat} className={`rounded border ${m.border} ${m.bg} p-2`}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
                <span className={`text-xs font-semibold ${m.text}`}>{m.label}</span>
              </div>
              <ul className="space-y-1">
                {items.map((w, i) => (
                  <li key={i} className={`text-xs ${m.text}`}>
                    <span className="font-medium">{friendlyFieldName(w.field)}</span>
                    {" — "}{w.message}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const today = new Date().toISOString().slice(0, 10);
  const [p, setP] = useState<ParsedProject>({
    ...initial,
    rfiReceivedDate: initial.rfiReceivedDate ?? today,
  });
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

      <WarningBuckets warnings={flags} />

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
          <Field
            label="Company location"
            hint="Type a city, state, or country — it auto-matches for reporting"
          >
            <input
              className="input"
              list="company-location-suggestions"
              placeholder="e.g. Chicago, IL or Germany"
              value={p.companyLocationRaw ?? ""}
              onChange={(e) => set("companyLocationRaw", e.target.value || null)}
            />
            <datalist id="company-location-suggestions">
              {LOCATION_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {p.companyLocationRaw?.trim() && (
              <span className="mt-1 block text-xs text-gray-400">
                → {describeLocation(normalizeLocation(p.companyLocationRaw))}
              </span>
            )}
          </Field>
        </Section>

        <Section title="Industry & narrative">
          <Field label="NAICS code" flagged={flagged("naicsCode")}>
            <select
              className="input"
              value={p.naicsCode ?? ""}
              onChange={(e) => {
                const code = e.target.value;
                const desc = code ? NAICS_BY_CODE[code] ?? null : null;
                setP((cur) => ({
                  ...cur,
                  naicsCode: code || null,
                  // Only auto-fill if the description is blank or matched the previous code
                  industryDescription:
                    desc && (!cur.industryDescription || cur.industryDescription === NAICS_BY_CODE[cur.naicsCode ?? ""])
                      ? desc
                      : cur.industryDescription,
                }));
              }}
            >
              {NAICS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Industry description" hint="Auto-filled from NAICS — edit to be more specific">
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
          <Field label="Minimum building sq ft" flagged={flagged("minBuildingSqFt")}>
            <NumberInput value={p.minBuildingSqFt ?? null} onChange={(v) => set("minBuildingSqFt", v)} />
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
