"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  LEAD_SOURCE_LABELS,
  formatCurrency,
  formatDate,
  formatNumber,
  toDateInputValue,
} from "@/lib/format";
import { Text, Area, NumberInput, DateInput, Select } from "@/components/intake/fields";

const LEAD_SOURCE_OPTIONS = Object.entries(LEAD_SOURCE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const UTILITY_OPTIONS = [
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "WATER", label: "Water" },
  { value: "WASTEWATER", label: "Wastewater" },
  { value: "GAS", label: "Gas" },
];

// Shared PATCH helper; refreshes the server component on success.
function useSectionSave(projectId: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(payload: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed.");
      }
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { save, saving, error, setError };
}

function SectionShell({
  title,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  error,
  children,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {editing ? (
          <div className="flex gap-2">
            <button
              className="text-xs text-gray-500 hover:underline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="text-xs font-medium text-brand hover:underline"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button
            className="text-xs font-medium text-brand hover:underline"
            onClick={onEdit}
          >
            Edit
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

function GridField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

// --- Header: codename / industry / NAICS / type -------------------------------

export function EditableHeader(props: {
  projectId: string;
  codename: string;
  industryDescription: string | null;
  naicsCode: string | null;
  projectType: string | null;
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [codename, setCodename] = useState(props.codename);
  const [industry, setIndustry] = useState(props.industryDescription ?? "");
  const [naics, setNaics] = useState(props.naicsCode ?? "");
  const [type, setType] = useState(props.projectType ?? "");

  function begin() {
    setCodename(props.codename);
    setIndustry(props.industryDescription ?? "");
    setNaics(props.naicsCode ?? "");
    setType(props.projectType ?? "");
    setEditing(true);
  }
  async function onSave() {
    const ok = await save({
      codename: codename.trim() || "Untitled Project",
      industryDescription: industry || null,
      naicsCode: naics || null,
      projectType: type || null,
    });
    if (ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {props.codename}
          </h1>
          <p className="text-sm text-gray-500">
            {props.industryDescription ?? "—"}
            {props.naicsCode ? ` · NAICS ${props.naicsCode}` : ""}
            {props.projectType ? ` · ${props.projectType}` : ""}
          </p>
        </div>
        <button
          className="mt-1 text-xs font-medium text-brand hover:underline"
          onClick={begin}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="card p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <GridField label="Codename">
          <Text value={codename} onChange={setCodename} />
        </GridField>
        <GridField label="Industry">
          <Text value={industry} onChange={setIndustry} />
        </GridField>
        <GridField label="NAICS">
          <Text value={naics} onChange={setNaics} />
        </GridField>
        <GridField label="Project type">
          <Text value={type} onChange={setType} />
        </GridField>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          className="text-xs text-gray-500 hover:underline"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="text-xs font-medium text-brand hover:underline"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// --- Source & dates -----------------------------------------------------------

const DATE_FIELDS: { key: string; label: string }[] = [
  { key: "rfiReceivedDate", label: "RFI received" },
  { key: "responseDueDate", label: "Response due" },
  { key: "responseSubmittedDate", label: "Response submitted" },
  { key: "siteVisitDate", label: "Site visit" },
  { key: "projectedDecisionDate", label: "Projected decision" },
  { key: "productionStartDate", label: "Start of production" },
];

export function EditableSourceDates(props: {
  projectId: string;
  leadSource: string;
  leadSourceOther: string | null;
  sourceContactName: string | null;
  submissionDestination: string | null;
  dates: Record<string, string | null>;
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [leadSource, setLeadSource] = useState(props.leadSource);
  const [contact, setContact] = useState(props.sourceContactName ?? "");
  const [dest, setDest] = useState(props.submissionDestination ?? "");
  const [dates, setDates] = useState<Record<string, string>>({});

  function begin() {
    setLeadSource(props.leadSource);
    setContact(props.sourceContactName ?? "");
    setDest(props.submissionDestination ?? "");
    const d: Record<string, string> = {};
    for (const f of DATE_FIELDS) d[f.key] = toDateInputValue(props.dates[f.key]);
    setDates(d);
    setEditing(true);
  }
  async function onSave() {
    const payload: Record<string, unknown> = {
      leadSource,
      sourceContactName: contact || null,
      submissionDestination: dest || null,
    };
    for (const f of DATE_FIELDS) payload[f.key] = dates[f.key] || null;
    if (await save(payload)) setEditing(false);
  }

  return (
    <SectionShell
      title="Source & dates"
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={onSave}
      saving={saving}
      error={error}
    >
      {!editing ? (
        <>
          <Row
            label="Lead source"
            value={LEAD_SOURCE_LABELS[props.leadSource] ?? props.leadSource}
          />
          <Row label="Source contact" value={props.sourceContactName ?? "—"} />
          <Row label="Submit to" value={props.submissionDestination ?? "—"} />
          {DATE_FIELDS.map((f) => (
            <Row key={f.key} label={f.label} value={formatDate(props.dates[f.key])} />
          ))}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <GridField label="Lead source">
            <Select
              value={leadSource}
              onChange={setLeadSource}
              options={LEAD_SOURCE_OPTIONS}
            />
          </GridField>
          <GridField label="Source contact">
            <Text value={contact} onChange={setContact} />
          </GridField>
          <GridField label="Submit to">
            <Text value={dest} onChange={setDest} />
          </GridField>
          {DATE_FIELDS.map((f) => (
            <GridField key={f.key} label={f.label}>
              <DateInput
                value={dates[f.key] ?? ""}
                onChange={(v) => setDates((c) => ({ ...c, [f.key]: v }))}
              />
            </GridField>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// --- Investment & jobs --------------------------------------------------------

interface JobPhase {
  count: number;
  timeframe: string;
}

export function EditableInvestmentJobs(props: {
  projectId: string;
  capexTotal: number | null;
  capexLand: number | null;
  capexBuilding: number | null;
  capexEquipment: number | null;
  avgWage: number | null;
  financingNotes: string | null;
  jobPhases: JobPhase[];
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [capexTotal, setCapexTotal] = useState<number | null>(props.capexTotal);
  const [capexLand, setCapexLand] = useState<number | null>(props.capexLand);
  const [capexBuilding, setCapexBuilding] = useState<number | null>(
    props.capexBuilding,
  );
  const [capexEquipment, setCapexEquipment] = useState<number | null>(
    props.capexEquipment,
  );
  const [avgWage, setAvgWage] = useState<number | null>(props.avgWage);
  const [financing, setFinancing] = useState(props.financingNotes ?? "");
  const [phases, setPhases] = useState<JobPhase[]>(props.jobPhases);

  function begin() {
    setCapexTotal(props.capexTotal);
    setCapexLand(props.capexLand);
    setCapexBuilding(props.capexBuilding);
    setCapexEquipment(props.capexEquipment);
    setAvgWage(props.avgWage);
    setFinancing(props.financingNotes ?? "");
    setPhases(props.jobPhases);
    setEditing(true);
  }
  async function onSave() {
    const ok = await save({
      capexTotal,
      capexLand,
      capexBuilding,
      capexEquipment,
      avgWage,
      financingNotes: financing || null,
      jobPhases: phases
        .filter((p) => p.timeframe.trim() !== "")
        .map((p) => ({ count: Math.round(p.count) || 0, timeframe: p.timeframe })),
    });
    if (ok) setEditing(false);
  }

  return (
    <SectionShell
      title="Investment & jobs"
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={onSave}
      saving={saving}
      error={error}
    >
      {!editing ? (
        <>
          <Row label="Total capex" value={formatCurrency(props.capexTotal)} />
          <Row label="Land" value={formatCurrency(props.capexLand)} />
          <Row label="Building" value={formatCurrency(props.capexBuilding)} />
          <Row label="Equipment" value={formatCurrency(props.capexEquipment)} />
          <Row label="Avg wage" value={formatCurrency(props.avgWage)} />
          <div className="mt-2 border-t border-gray-100 pt-2">
            {props.jobPhases.length === 0 ? (
              <p className="text-sm text-gray-400">No job phases.</p>
            ) : (
              props.jobPhases.map((j, i) => (
                <Row key={i} label={j.timeframe} value={`${formatNumber(j.count)} jobs`} />
              ))
            )}
          </div>
          {props.financingNotes && (
            <p className="mt-2 text-xs text-gray-500">{props.financingNotes}</p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <GridField label="Total capex (USD)">
              <NumberInput value={capexTotal} onChange={setCapexTotal} />
            </GridField>
            <GridField label="Avg wage (USD)">
              <NumberInput value={avgWage} onChange={setAvgWage} />
            </GridField>
            <GridField label="Land">
              <NumberInput value={capexLand} onChange={setCapexLand} />
            </GridField>
            <GridField label="Building">
              <NumberInput value={capexBuilding} onChange={setCapexBuilding} />
            </GridField>
            <GridField label="Equipment">
              <NumberInput value={capexEquipment} onChange={setCapexEquipment} />
            </GridField>
          </div>
          <GridField label="Financing notes">
            <Area value={financing} onChange={setFinancing} rows={2} />
          </GridField>
          <div>
            <span className="label">Job phases</span>
            {phases.map((p, i) => (
              <div key={i} className="mb-1 flex gap-2">
                <input
                  type="number"
                  className="input w-28"
                  placeholder="count"
                  value={p.count}
                  onChange={(e) =>
                    setPhases((cur) =>
                      cur.map((x, j) =>
                        j === i ? { ...x, count: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <input
                  className="input"
                  placeholder="timeframe (e.g. Year One)"
                  value={p.timeframe}
                  onChange={(e) =>
                    setPhases((cur) =>
                      cur.map((x, j) =>
                        j === i ? { ...x, timeframe: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  className="text-xs text-red-500 hover:underline"
                  onClick={() =>
                    setPhases((cur) => cur.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="text-xs text-brand hover:underline"
              onClick={() =>
                setPhases((cur) => [...cur, { count: 0, timeframe: "" }])
              }
            >
              + Add job phase
            </button>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// --- Site requirements --------------------------------------------------------

export function EditableSiteRequirements(props: {
  projectId: string;
  minAcreage: number | null;
  siteLocationPreferences: string[];
  buildingSizeNeeds: string | null;
  requiredDeliverables: string[];
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [minAcreage, setMinAcreage] = useState<number | null>(props.minAcreage);
  const [prefs, setPrefs] = useState(props.siteLocationPreferences.join(", "));
  const [building, setBuilding] = useState(props.buildingSizeNeeds ?? "");
  const [deliverables, setDeliverables] = useState(
    props.requiredDeliverables.join(", "),
  );

  function begin() {
    setMinAcreage(props.minAcreage);
    setPrefs(props.siteLocationPreferences.join(", "));
    setBuilding(props.buildingSizeNeeds ?? "");
    setDeliverables(props.requiredDeliverables.join(", "));
    setEditing(true);
  }
  const csv = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);
  async function onSave() {
    const ok = await save({
      minAcreage,
      buildingSizeNeeds: building || null,
      siteLocationPreferences: csv(prefs),
      requiredDeliverables: csv(deliverables),
    });
    if (ok) setEditing(false);
  }

  return (
    <SectionShell
      title="Site requirements"
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={onSave}
      saving={saving}
      error={error}
    >
      {!editing ? (
        <>
          <Row
            label="Min acreage"
            value={props.minAcreage ? `${props.minAcreage} ac` : "—"}
          />
          <Row
            label="Location prefs"
            value={
              props.siteLocationPreferences.length
                ? props.siteLocationPreferences.join(", ")
                : "—"
            }
          />
          {props.buildingSizeNeeds && (
            <p className="mt-2 text-xs text-gray-600">{props.buildingSizeNeeds}</p>
          )}
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="label">Required deliverables</p>
            {props.requiredDeliverables.length ? (
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {props.requiredDeliverables.map((dlv, i) => (
                  <li key={i}>{dlv}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <GridField label="Min acreage">
            <NumberInput value={minAcreage} onChange={setMinAcreage} />
          </GridField>
          <GridField label="Location preferences (comma-separated)">
            <Text value={prefs} onChange={setPrefs} />
          </GridField>
          <GridField label="Building size needs">
            <Area value={building} onChange={setBuilding} rows={2} />
          </GridField>
          <GridField label="Required deliverables (comma-separated)">
            <Area value={deliverables} onChange={setDeliverables} rows={2} />
          </GridField>
        </div>
      )}
    </SectionShell>
  );
}

// --- Critical criteria --------------------------------------------------------

interface Criterion {
  rank: number;
  text: string;
}

export function EditableCriticalCriteria(props: {
  projectId: string;
  criticalCriteria: Criterion[];
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<Criterion[]>(props.criticalCriteria);

  function begin() {
    setItems(props.criticalCriteria);
    setEditing(true);
  }
  async function onSave() {
    const cleaned = items
      .filter((c) => c.text.trim() !== "")
      .map((c, i) => ({ rank: i + 1, text: c.text }));
    if (await save({ criticalCriteria: cleaned })) setEditing(false);
  }

  return (
    <SectionShell
      title="Critical criteria (in order of importance)"
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={onSave}
      saving={saving}
      error={error}
    >
      {!editing ? (
        props.criticalCriteria.length === 0 ? (
          <p className="text-sm text-gray-400">None recorded.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-800">
            {props.criticalCriteria.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ol>
        )
      ) : (
        <div className="space-y-2">
          {items.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 text-xs text-gray-400">{i + 1}.</span>
              <input
                className="input"
                value={c.text}
                onChange={(e) =>
                  setItems((cur) =>
                    cur.map((x, j) =>
                      j === i ? { ...x, text: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                className="mt-2 text-xs text-red-500 hover:underline"
                onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="text-xs text-brand hover:underline"
            onClick={() =>
              setItems((cur) => [...cur, { rank: cur.length + 1, text: "" }])
            }
          >
            + Add criterion
          </button>
        </div>
      )}
    </SectionShell>
  );
}

// --- Qualitative needs --------------------------------------------------------

interface Note {
  label: string;
  content: string;
}

export function EditableQualitative(props: {
  projectId: string;
  qualitativeNotes: Note[];
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<Note[]>(props.qualitativeNotes);

  function begin() {
    setItems(props.qualitativeNotes);
    setEditing(true);
  }
  async function onSave() {
    const cleaned = items.filter(
      (n) => n.label.trim() !== "" || n.content.trim() !== "",
    );
    if (await save({ qualitativeNotes: cleaned })) setEditing(false);
  }

  return (
    <SectionShell
      title="Qualitative needs"
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={onSave}
      saving={saving}
      error={error}
    >
      {!editing ? (
        props.qualitativeNotes.length === 0 ? (
          <p className="text-sm text-gray-400">None recorded.</p>
        ) : (
          props.qualitativeNotes.map((q, i) => (
            <div key={i} className="mb-2">
              <p className="text-xs font-semibold text-gray-700">{q.label}</p>
              <p className="text-sm text-gray-600">{q.content}</p>
            </div>
          ))
        )
      ) : (
        <div className="space-y-2">
          {items.map((n, i) => (
            <div key={i} className="space-y-1 rounded-md border border-gray-200 p-2">
              <input
                className="input"
                placeholder="Label"
                value={n.label}
                onChange={(e) =>
                  setItems((cur) =>
                    cur.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <textarea
                className="input"
                rows={2}
                placeholder="Content"
                value={n.content}
                onChange={(e) =>
                  setItems((cur) =>
                    cur.map((x, j) =>
                      j === i ? { ...x, content: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                className="text-xs text-red-500 hover:underline"
                onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="text-xs text-brand hover:underline"
            onClick={() =>
              setItems((cur) => [...cur, { label: "", content: "" }])
            }
          >
            + Add note
          </button>
        </div>
      )}
    </SectionShell>
  );
}

// --- Utilities ----------------------------------------------------------------

interface Datapoint {
  kind: string | null;
  label: string | null;
  value: number | null;
  unit: string | null;
  date: string | null;
  rawValue: string | null;
  flagged: boolean;
  assumptionNote: string | null;
}
interface Utility {
  type: string;
  normalizedValue: number | null;
  normalizedUnit: string | null;
  rawValue: string | null;
  purpose: string | null;
  alternatives: string | null;
  notes: string | null;
  flagged: boolean;
  assumptionNote: string | null;
  datapoints: Datapoint[];
}

function emptyUtility(): Utility {
  return {
    type: "ELECTRICITY",
    normalizedValue: null,
    normalizedUnit: null,
    rawValue: null,
    purpose: null,
    alternatives: null,
    notes: null,
    flagged: false,
    assumptionNote: null,
    datapoints: [],
  };
}

export function EditableUtilities(props: {
  projectId: string;
  utilities: Utility[];
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<Utility[]>(props.utilities);

  function begin() {
    setItems(props.utilities);
    setEditing(true);
  }
  function patchU(i: number, patch: Partial<Utility>) {
    setItems((cur) => cur.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  }
  function patchDp(ui: number, di: number, patch: Partial<Datapoint>) {
    setItems((cur) =>
      cur.map((u, j) =>
        j === ui
          ? {
              ...u,
              datapoints: u.datapoints.map((d, k) =>
                k === di ? { ...d, ...patch } : d,
              ),
            }
          : u,
      ),
    );
  }
  async function onSave() {
    if (await save({ utilities: items })) setEditing(false);
  }

  return (
    <SectionShell
      title="Utility requirements"
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={onSave}
      saving={saving}
      error={error}
    >
      {!editing ? (
        props.utilities.length === 0 ? (
          <p className="text-sm text-gray-400">None recorded.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {props.utilities.map((u, i) => (
              <div key={i} className="rounded-md border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {u.type.charAt(0) + u.type.slice(1).toLowerCase()}
                  </span>
                  <span className="text-sm text-gray-700">
                    {u.normalizedValue != null
                      ? `${formatNumber(u.normalizedValue)} ${u.normalizedUnit ?? ""}`
                      : "—"}
                  </span>
                </div>
                {u.rawValue && (
                  <p className="mt-1 text-xs text-gray-500">Raw: {u.rawValue}</p>
                )}
                {u.alternatives && (
                  <p className="text-xs text-gray-500">Alt: {u.alternatives}</p>
                )}
                {u.flagged && u.assumptionNote && (
                  <p className="mt-1 text-xs text-amber-700">⚠ {u.assumptionNote}</p>
                )}
                {u.datapoints.length > 0 && (
                  <table className="mt-2 w-full text-xs">
                    <tbody>
                      {u.datapoints.map((dp, k) => (
                        <tr key={k} className="text-gray-600">
                          <td className="pr-2">{dp.kind ?? dp.label ?? "—"}</td>
                          <td className="pr-2 text-right">
                            {dp.value != null
                              ? `${formatNumber(dp.value)} ${dp.unit ?? ""}`
                              : "—"}
                          </td>
                          <td className="text-right text-gray-400">
                            {dp.date ? formatDate(dp.date) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {items.map((u, i) => (
            <div key={i} className="rounded-md border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <GridField label="Type">
                  <Select
                    value={u.type}
                    onChange={(v) => patchU(i, { type: v })}
                    options={UTILITY_OPTIONS}
                  />
                </GridField>
                <GridField label="Normalized value">
                  <NumberInput
                    value={u.normalizedValue}
                    onChange={(v) => patchU(i, { normalizedValue: v })}
                  />
                </GridField>
                <GridField label="Normalized unit">
                  <Text
                    value={u.normalizedUnit ?? ""}
                    onChange={(v) => patchU(i, { normalizedUnit: v || null })}
                  />
                </GridField>
                <GridField label="Raw value">
                  <Text
                    value={u.rawValue ?? ""}
                    onChange={(v) => patchU(i, { rawValue: v || null })}
                  />
                </GridField>
                <GridField label="Purpose">
                  <Text
                    value={u.purpose ?? ""}
                    onChange={(v) => patchU(i, { purpose: v || null })}
                  />
                </GridField>
                <GridField label="Alternatives">
                  <Text
                    value={u.alternatives ?? ""}
                    onChange={(v) => patchU(i, { alternatives: v || null })}
                  />
                </GridField>
              </div>
              <div className="mt-2">
                <span className="label">Datapoints</span>
                {u.datapoints.map((dp, k) => (
                  <div key={k} className="mb-1 flex flex-wrap gap-1">
                    <input
                      className="input w-28"
                      placeholder="kind"
                      value={dp.kind ?? ""}
                      onChange={(e) => patchDp(i, k, { kind: e.target.value || null })}
                    />
                    <input
                      type="number"
                      className="input w-24"
                      placeholder="value"
                      value={dp.value ?? ""}
                      onChange={(e) =>
                        patchDp(i, k, {
                          value: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                    <input
                      className="input w-20"
                      placeholder="unit"
                      value={dp.unit ?? ""}
                      onChange={(e) => patchDp(i, k, { unit: e.target.value || null })}
                    />
                    <input
                      type="date"
                      className="input w-40"
                      value={dp.date ? dp.date.slice(0, 10) : ""}
                      onChange={(e) => patchDp(i, k, { date: e.target.value || null })}
                    />
                    <button
                      className="text-xs text-red-500 hover:underline"
                      onClick={() =>
                        patchU(i, {
                          datapoints: u.datapoints.filter((_, x) => x !== k),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  className="text-xs text-brand hover:underline"
                  onClick={() =>
                    patchU(i, {
                      datapoints: [
                        ...u.datapoints,
                        {
                          kind: null,
                          label: null,
                          value: null,
                          unit: null,
                          date: null,
                          rawValue: null,
                          flagged: false,
                          assumptionNote: null,
                        },
                      ],
                    })
                  }
                >
                  + Add datapoint
                </button>
              </div>
              <button
                className="mt-2 text-xs text-red-500 hover:underline"
                onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}
              >
                Remove utility
              </button>
            </div>
          ))}
          <button
            className="text-xs text-brand hover:underline"
            onClick={() => setItems((cur) => [...cur, emptyUtility()])}
          >
            + Add utility
          </button>
        </div>
      )}
    </SectionShell>
  );
}

// --- Notes --------------------------------------------------------------------

export function EditableNotes(props: {
  projectId: string;
  environmentalNotes: string | null;
  transportationNotes: string | null;
  specialServicesNotes: string | null;
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [env, setEnv] = useState(props.environmentalNotes ?? "");
  const [trans, setTrans] = useState(props.transportationNotes ?? "");
  const [special, setSpecial] = useState(props.specialServicesNotes ?? "");

  function begin() {
    setEnv(props.environmentalNotes ?? "");
    setTrans(props.transportationNotes ?? "");
    setSpecial(props.specialServicesNotes ?? "");
    setEditing(true);
  }
  async function onSave() {
    const ok = await save({
      environmentalNotes: env || null,
      transportationNotes: trans || null,
      specialServicesNotes: special || null,
    });
    if (ok) setEditing(false);
  }

  return (
    <SectionShell
      title="Notes"
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={onSave}
      saving={saving}
      error={error}
    >
      {!editing ? (
        <div className="space-y-2">
          {props.environmentalNotes && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Environmental:</span>{" "}
              {props.environmentalNotes}
            </p>
          )}
          {props.transportationNotes && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Transportation:</span>{" "}
              {props.transportationNotes}
            </p>
          )}
          {props.specialServicesNotes && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Special services:</span>{" "}
              {props.specialServicesNotes}
            </p>
          )}
          {!props.environmentalNotes &&
            !props.transportationNotes &&
            !props.specialServicesNotes && (
              <p className="text-sm text-gray-400">None recorded.</p>
            )}
        </div>
      ) : (
        <div className="space-y-2">
          <GridField label="Environmental">
            <Area value={env} onChange={setEnv} rows={2} />
          </GridField>
          <GridField label="Transportation">
            <Area value={trans} onChange={setTrans} rows={2} />
          </GridField>
          <GridField label="Special services">
            <Area value={special} onChange={setSpecial} rows={2} />
          </GridField>
        </div>
      )}
    </SectionShell>
  );
}
