"use client";

import { useState, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BareSection } from "./TabbedCard";
import {
  LEAD_SOURCE_LABELS,
  REQUIREMENT_PREFERENCE_LABELS,
  leadSourceLabel,
  isLegacyLeadSource,
  formatCurrency,
  formatDate,
  formatNumber,
  toDateInputValue,
} from "@/lib/format";
import { Text, Area, NumberInput, DateInput, Select } from "@/components/intake/fields";
import {
  normalizeLocation,
  describeLocation,
  US_STATES,
  COUNTRIES,
} from "@/lib/location/normalize";

// Autocomplete suggestions for the location box: full state names + countries.
const LOCATION_SUGGESTIONS = [...Object.values(US_STATES), ...COUNTRIES];

const LEAD_SOURCE_OPTIONS = Object.entries(LEAD_SOURCE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
// Nullable tri-state prefs (existing building, rail) — blank "—" = not specified.
const PREFERENCE_OPTIONS = [
  { value: "", label: "—" },
  ...Object.entries(REQUIREMENT_PREFERENCE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
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
  const bare = useContext(BareSection);

  const controls = editing ? (
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
  );

  // Inside a TabbedCard the box already provides the card + tab label, so drop
  // this section's own card and title and just float the edit/save controls.
  if (bare) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mb-1 flex min-h-[1.25rem] items-center justify-end">
          {controls}
        </div>
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {controls}
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
          <div className="mt-1 space-y-0.5 text-sm text-gray-500">
            <p>
              {props.naicsCode ? `NAICS ${props.naicsCode}` : ""}
              {props.naicsCode && props.industryDescription ? " — " : ""}
              {props.industryDescription ??
                (props.naicsCode ? "" : "—")}
            </p>
            {props.projectType && <p>{props.projectType}</p>}
          </div>
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

// Site visits are managed as their own list below; the single "Site visit"
// date is derived from the earliest visit and no longer shown as a field here.
const DATE_FIELDS: { key: string; label: string }[] = [
  { key: "rfiReceivedDate", label: "RFI received" },
  { key: "responseDueDate", label: "Response due" },
  { key: "responseSubmittedDate", label: "Response submitted" },
  { key: "projectedDecisionDate", label: "Projected decision" },
  { key: "productionStartDate", label: "Start of production" },
];

interface SiteVisitItem {
  date: string;
  note: string | null;
  siteId: string | null;
}

export function EditableSourceDates(props: {
  projectId: string;
  leadSource: string;
  leadSourceOther: string | null;
  sourceContactName: string | null;
  submissionDestination: string | null;
  companyLocationRaw: string | null;
  companyState: string | null;
  companyCountry: string | null;
  dates: Record<string, string | null>;
  siteVisits: SiteVisitItem[];
  // Sites submitted for this project — the options for the per-visit site picker.
  submittedSites: { id: string; name: string; communityName: string }[];
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [leadSource, setLeadSource] = useState(props.leadSource);
  const [contact, setContact] = useState(props.sourceContactName ?? "");
  const [dest, setDest] = useState(props.submissionDestination ?? "");
  const [location, setLocation] = useState(props.companyLocationRaw ?? "");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [visits, setVisits] = useState<SiteVisitItem[]>([]);

  function begin() {
    setLeadSource(props.leadSource);
    setContact(props.sourceContactName ?? "");
    setDest(props.submissionDestination ?? "");
    setLocation(props.companyLocationRaw ?? "");
    const d: Record<string, string> = {};
    for (const f of DATE_FIELDS) d[f.key] = toDateInputValue(props.dates[f.key]);
    setDates(d);
    setVisits(
      props.siteVisits.map((v) => ({
        date: toDateInputValue(v.date),
        note: v.note,
        siteId: v.siteId,
      })),
    );
    setEditing(true);
  }
  async function onSave() {
    const payload: Record<string, unknown> = {
      leadSource,
      sourceContactName: contact || null,
      submissionDestination: dest || null,
      companyLocationRaw: location.trim() || null,
      siteVisits: visits
        .filter((v) => v.date)
        .map((v) => ({
          date: v.date,
          note: v.note?.trim() || null,
          siteId: v.siteId || null,
        })),
    };
    for (const f of DATE_FIELDS) payload[f.key] = dates[f.key] || null;
    if (await save(payload)) setEditing(false);
  }

  const siteNameById = new Map(props.submittedSites.map((s) => [s.id, s.name]));

  // Live preview of how the typed location resolves (city / state / country).
  const resolved = location.trim() ? describeLocation(normalizeLocation(location)) : "";

  // Read-only summary of the stored, normalized location.
  const storedLocation =
    props.companyLocationRaw ??
    (describeLocation({
      city: null,
      state: props.companyState,
      country: props.companyCountry,
    }) ||
      null);

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
          <Row label="Lead source" value={leadSourceLabel(props.leadSource)} />
          <Row label="Source contact" value={props.sourceContactName ?? "—"} />
          <Row label="Submit to" value={props.submissionDestination ?? "—"} />
          <Row label="Company location" value={storedLocation || "—"} />
          {DATE_FIELDS.map((f) => (
            <Row key={f.key} label={f.label} value={formatDate(props.dates[f.key])} />
          ))}
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="label">Site visits</p>
            {props.siteVisits.length === 0 ? (
              <p className="text-sm text-gray-400">None recorded.</p>
            ) : (
              <ul className="space-y-0.5 text-sm text-gray-700">
                {props.siteVisits.map((v, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="font-medium">
                      {formatDate(v.date)}
                      {v.siteId && siteNameById.has(v.siteId)
                        ? ` — ${siteNameById.get(v.siteId)}`
                        : ""}
                    </span>
                    {v.note && <span className="text-right text-gray-500">{v.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <GridField label="Lead source">
              <Select
                value={leadSource}
                onChange={setLeadSource}
                options={
                  isLegacyLeadSource(props.leadSource)
                    ? [
                        ...LEAD_SOURCE_OPTIONS,
                        {
                          value: props.leadSource,
                          label: leadSourceLabel(props.leadSource),
                        },
                      ]
                    : LEAD_SOURCE_OPTIONS
                }
              />
            </GridField>
            <GridField label="Source contact">
              <Text value={contact} onChange={setContact} />
            </GridField>
            <GridField label="Submit to">
              <Text value={dest} onChange={setDest} />
            </GridField>
            <GridField label="Company location">
              <input
                className="input"
                list="company-location-suggestions"
                placeholder="e.g. Chicago, IL or Germany"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <datalist id="company-location-suggestions">
                {LOCATION_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {resolved && (
                <span className="mt-1 block text-xs text-gray-400">→ {resolved}</span>
              )}
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
          <div className="border-t border-gray-100 pt-2">
            <span className="label">Site visits</span>
            {props.submittedSites.length === 0 && (
              <p className="mb-1 text-xs text-gray-400">
                Submit sites below to link a visit to a specific site.
              </p>
            )}
            {visits.map((v, i) => (
              <div key={i} className="mb-1 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="input w-40"
                  value={v.date}
                  onChange={(e) =>
                    setVisits((cur) =>
                      cur.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)),
                    )
                  }
                />
                <select
                  className="input w-48"
                  value={v.siteId ?? ""}
                  onChange={(e) =>
                    setVisits((cur) =>
                      cur.map((x, j) =>
                        j === i ? { ...x, siteId: e.target.value || null } : x,
                      ),
                    )
                  }
                >
                  <option value="">— Site visited —</option>
                  {props.submittedSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input flex-1"
                  placeholder="note (who attended / outcome)"
                  value={v.note ?? ""}
                  onChange={(e) =>
                    setVisits((cur) =>
                      cur.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                    )
                  }
                />
                <button
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => setVisits((cur) => cur.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="text-xs text-brand hover:underline"
              onClick={() =>
                setVisits((cur) => [...cur, { date: "", note: "", siteId: null }])
              }
            >
              + Add site visit
            </button>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// --- Investment & jobs --------------------------------------------------------

export function EditableInvestmentJobs(props: {
  projectId: string;
  capexTotal: number | null;
  capexLand: number | null;
  capexBuilding: number | null;
  capexEquipment: number | null;
  avgWage: number | null;
  financingNotes: string | null;
  jobs: number | null;
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
  const [jobs, setJobs] = useState<number | null>(props.jobs);

  function begin() {
    setCapexTotal(props.capexTotal);
    setCapexLand(props.capexLand);
    setCapexBuilding(props.capexBuilding);
    setCapexEquipment(props.capexEquipment);
    setAvgWage(props.avgWage);
    setFinancing(props.financingNotes ?? "");
    setJobs(props.jobs);
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
      jobs: jobs == null ? null : Math.round(jobs),
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
          <Row
            label="Jobs (peak)"
            value={props.jobs != null ? formatNumber(props.jobs) : "—"}
          />
          <Row label="Avg wage" value={formatCurrency(props.avgWage)} />
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
            <GridField label="Jobs (peak)">
              <NumberInput value={jobs} onChange={setJobs} />
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
        </div>
      )}
    </SectionShell>
  );
}

// --- Site requirements --------------------------------------------------------

export function EditableSiteRequirements(props: {
  projectId: string;
  minAcreage: number | null;
  maxAcreage: number | null;
  minBuildingSqFt: number | null;
  maxBuildingSqFt: number | null;
  siteLocationPreferences: string[];
  buildingSizeNeeds: string | null;
  requiredDeliverables: string[];
  existingBuildingPreference: string | null;
  railPreference: string | null;
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [minAcreage, setMinAcreage] = useState<number | null>(props.minAcreage);
  const [maxAcreage, setMaxAcreage] = useState<number | null>(props.maxAcreage);
  const [minBuildingSqFt, setMinBuildingSqFt] = useState<number | null>(props.minBuildingSqFt);
  const [maxBuildingSqFt, setMaxBuildingSqFt] = useState<number | null>(props.maxBuildingSqFt);
  const [prefs, setPrefs] = useState(props.siteLocationPreferences.join(", "));
  const [building, setBuilding] = useState(props.buildingSizeNeeds ?? "");
  const [deliverables, setDeliverables] = useState(
    props.requiredDeliverables.join(", "),
  );
  const [existingBuilding, setExistingBuilding] = useState(
    props.existingBuildingPreference ?? "",
  );
  const [rail, setRail] = useState(props.railPreference ?? "");

  function begin() {
    setMinAcreage(props.minAcreage);
    setMaxAcreage(props.maxAcreage);
    setMinBuildingSqFt(props.minBuildingSqFt);
    setMaxBuildingSqFt(props.maxBuildingSqFt);
    setPrefs(props.siteLocationPreferences.join(", "));
    setBuilding(props.buildingSizeNeeds ?? "");
    setDeliverables(props.requiredDeliverables.join(", "));
    setExistingBuilding(props.existingBuildingPreference ?? "");
    setRail(props.railPreference ?? "");
    setEditing(true);
  }
  const csv = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);
  async function onSave() {
    const ok = await save({
      minAcreage,
      maxAcreage,
      minBuildingSqFt,
      maxBuildingSqFt,
      buildingSizeNeeds: building || null,
      siteLocationPreferences: csv(prefs),
      requiredDeliverables: csv(deliverables),
      existingBuildingPreference: existingBuilding || null,
      railPreference: rail || null,
    });
    if (ok) setEditing(false);
  }

  // "min ac" or "min–max ac" depending on whether a max is set.
  const acreageDisplay = props.minAcreage
    ? props.maxAcreage
      ? `${formatNumber(props.minAcreage)}–${formatNumber(props.maxAcreage)} ac`
      : `${formatNumber(props.minAcreage)} ac`
    : "—";
  const buildingDisplay = props.minBuildingSqFt
    ? props.maxBuildingSqFt
      ? `${formatNumber(props.minBuildingSqFt)}–${formatNumber(props.maxBuildingSqFt)} sf`
      : `${formatNumber(props.minBuildingSqFt)} sf`
    : "—";

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
          <Row label="Acreage" value={acreageDisplay} />
          <Row label="Building sq ft" value={buildingDisplay} />
          <Row
            label="Location prefs"
            value={
              props.siteLocationPreferences.length
                ? props.siteLocationPreferences.join(", ")
                : "—"
            }
          />
          <Row
            label="Existing building"
            value={
              props.existingBuildingPreference
                ? REQUIREMENT_PREFERENCE_LABELS[props.existingBuildingPreference] ??
                  props.existingBuildingPreference
                : "—"
            }
          />
          <Row
            label="Rail requirement"
            value={
              props.railPreference
                ? REQUIREMENT_PREFERENCE_LABELS[props.railPreference] ??
                  props.railPreference
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
          <div className="grid grid-cols-2 gap-2">
            <GridField label="Min acreage">
              <NumberInput value={minAcreage} onChange={setMinAcreage} />
            </GridField>
            <GridField label="Max acreage">
              <NumberInput value={maxAcreage} onChange={setMaxAcreage} />
            </GridField>
            <GridField label="Min building sq ft">
              <NumberInput value={minBuildingSqFt} onChange={setMinBuildingSqFt} />
            </GridField>
            <GridField label="Max building sq ft">
              <NumberInput value={maxBuildingSqFt} onChange={setMaxBuildingSqFt} />
            </GridField>
          </div>
          <GridField label="Location preferences (comma-separated)">
            <Text value={prefs} onChange={setPrefs} />
          </GridField>
          <GridField label="Existing building">
            <Select
              value={existingBuilding}
              onChange={setExistingBuilding}
              options={PREFERENCE_OPTIONS}
            />
          </GridField>
          <GridField label="Rail requirement">
            <Select value={rail} onChange={setRail} options={PREFERENCE_OPTIONS} />
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

// Utilities are now free text — one box per utility, captured as written in the
// RFI. (The legacy normalized UtilityRequirement data is retained in the DB for
// historical projects but no longer shown or edited here.)
export function EditableUtilities(props: {
  projectId: string;
  electricityNeeds: string | null;
  waterNeeds: string | null;
  wastewaterNeeds: string | null;
  gasNeeds: string | null;
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [electricity, setElectricity] = useState(props.electricityNeeds ?? "");
  const [water, setWater] = useState(props.waterNeeds ?? "");
  const [wastewater, setWastewater] = useState(props.wastewaterNeeds ?? "");
  const [gas, setGas] = useState(props.gasNeeds ?? "");

  function begin() {
    setElectricity(props.electricityNeeds ?? "");
    setWater(props.waterNeeds ?? "");
    setWastewater(props.wastewaterNeeds ?? "");
    setGas(props.gasNeeds ?? "");
    setEditing(true);
  }
  async function onSave() {
    const ok = await save({
      electricityNeeds: electricity.trim() || null,
      waterNeeds: water.trim() || null,
      wastewaterNeeds: wastewater.trim() || null,
      gasNeeds: gas.trim() || null,
    });
    if (ok) setEditing(false);
  }

  const rows: { label: string; value: string | null }[] = [
    { label: "Electricity", value: props.electricityNeeds },
    { label: "Water", value: props.waterNeeds },
    { label: "Wastewater", value: props.wastewaterNeeds },
    { label: "Gas", value: props.gasNeeds },
  ];
  const anySet = rows.some((r) => r.value && r.value.trim());

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
        !anySet ? (
          <p className="text-sm text-gray-400">None recorded.</p>
        ) : (
          <div className="space-y-2">
            {rows
              .filter((r) => r.value && r.value.trim())
              .map((r) => (
                <div key={r.label}>
                  <p className="text-xs font-semibold text-gray-700">{r.label}</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-600">
                    {r.value}
                  </p>
                </div>
              ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <GridField label="Electricity">
            <Area value={electricity} onChange={setElectricity} rows={3} />
          </GridField>
          <GridField label="Water">
            <Area value={water} onChange={setWater} rows={3} />
          </GridField>
          <GridField label="Wastewater">
            <Area value={wastewater} onChange={setWastewater} rows={3} />
          </GridField>
          <GridField label="Gas">
            <Area value={gas} onChange={setGas} rows={3} />
          </GridField>
        </div>
      )}
    </SectionShell>
  );
}

// --- No-submission reason -----------------------------------------------------

// Shown only when a project is in the "No Submission" stage. Records why we
// chose not to respond to the RFI; feeds the no-submission reporting.
export function EditableNoSubmissionReason(props: {
  projectId: string;
  noSubmissionReason: string | null;
}) {
  const { save, saving, error } = useSectionSave(props.projectId);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(props.noSubmissionReason ?? "");

  function begin() {
    setReason(props.noSubmissionReason ?? "");
    setEditing(true);
  }
  async function onSave() {
    const trimmed = reason.trim();
    if (!trimmed) return; // reason is required for this stage
    if (await save({ noSubmissionReason: trimmed })) setEditing(false);
  }

  return (
    <div className="card border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Reason for not submitting
        </h3>
        {editing ? (
          <div className="flex gap-2">
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
        ) : (
          <button
            className="text-xs font-medium text-brand hover:underline"
            onClick={begin}
          >
            Edit
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2">
        {!editing ? (
          <p className="text-sm text-slate-700">
            {props.noSubmissionReason || (
              <span className="text-gray-400">No reason recorded.</span>
            )}
          </p>
        ) : (
          <Area value={reason} onChange={setReason} rows={3} />
        )}
      </div>
    </div>
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
