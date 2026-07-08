"use client";

import { useState } from "react";
import {
  formatNumber,
  REAL_ESTATE_TYPE_LABELS,
  REAL_ESTATE_TYPES,
} from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";

interface CommunityLite {
  id: string;
  name: string;
}
interface ProviderLite {
  id: string;
  name: string;
  type: string; // "ELECTRIC" | "WATER" | "SEWER" | "GAS"
}
interface SiteRow {
  id: string;
  name: string;
  communityId: string | null;
  acreage: number | null;
  address: string | null;
  realEstateType: string | null;
  county: string | null;
  squareFeet: number | null;
  pricePerSqFt: number | null;
  currentElectricMw: number | null;
  projectedElectricMw: number | null;
  electricProviderId: string | null;
  electricProviderName: string | null;
  waterProviderId: string | null;
  waterProviderName: string | null;
  sewerProviderId: string | null;
  sewerProviderName: string | null;
  gasProviderId: string | null;
  gasProviderName: string | null;
  submissionCount: number;
}

const COUNTY_LABELS: Record<string, string> = {
  HAYS: "Hays",
  CALDWELL: "Caldwell",
  TRAVIS: "Travis",
};
const COUNTY_OPTIONS = Object.entries(COUNTY_LABELS);

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  ELECTRIC: "Electric",
  WATER: "Water",
  SEWER: "Sewer",
  GAS: "Gas",
};

// ---------------------------------------------------------------------------
// Shared site form
// ---------------------------------------------------------------------------

interface SiteForm {
  name: string;
  communityId: string;
  county: string;
  realEstateType: string;
  acreage: string;
  squareFeet: string;
  pricePerSqFt: string;
  currentMw: string;
  projectedMw: string;
  electricProviderId: string;
  waterProviderId: string;
  sewerProviderId: string;
  gasProviderId: string;
  address: string;
}

function emptyForm(): SiteForm {
  return {
    name: "",
    communityId: "",
    county: "",
    realEstateType: "",
    acreage: "",
    squareFeet: "",
    pricePerSqFt: "",
    currentMw: "",
    projectedMw: "",
    electricProviderId: "",
    waterProviderId: "",
    sewerProviderId: "",
    gasProviderId: "",
    address: "",
  };
}

function rowToForm(s: SiteRow): SiteForm {
  const str = (v: number | null) => (v != null ? String(v) : "");
  return {
    name: s.name,
    communityId: s.communityId ?? "",
    county: s.county ?? "",
    realEstateType: s.realEstateType ?? "",
    acreage: str(s.acreage),
    squareFeet: str(s.squareFeet),
    pricePerSqFt: str(s.pricePerSqFt),
    currentMw: str(s.currentElectricMw),
    projectedMw: str(s.projectedElectricMw),
    electricProviderId: s.electricProviderId ?? "",
    waterProviderId: s.waterProviderId ?? "",
    sewerProviderId: s.sewerProviderId ?? "",
    gasProviderId: s.gasProviderId ?? "",
    address: s.address ?? "",
  };
}

function toPayload(f: SiteForm) {
  const num = (v: string) => (v.trim() ? Number(v) : null);
  return {
    name: f.name.trim(),
    communityId: f.communityId || null,
    county: f.county || null,
    realEstateType: f.realEstateType || null,
    acreage: num(f.acreage),
    squareFeet: num(f.squareFeet),
    pricePerSqFt: num(f.pricePerSqFt),
    currentElectricMw: num(f.currentMw),
    projectedElectricMw: num(f.projectedMw),
    electricProviderId: f.electricProviderId || null,
    waterProviderId: f.waterProviderId || null,
    sewerProviderId: f.sewerProviderId || null,
    gasProviderId: f.gasProviderId || null,
    address: f.address || null,
  };
}

// Map an API site (with nested provider objects) back to a flat SiteRow.
function siteFromApi(s: Record<string, unknown>, submissionCount = 0): SiteRow {
  const n = (v: unknown) => (v != null ? Number(v as number) : null);
  const prov = (p: unknown) =>
    (p as { name?: string } | null)?.name ?? null;
  return {
    id: s.id as string,
    name: s.name as string,
    communityId: (s.communityId as string | null) ?? null,
    acreage: n(s.acreage),
    address: (s.address as string | null) ?? null,
    realEstateType: (s.realEstateType as string | null) ?? null,
    county: (s.county as string | null) ?? null,
    squareFeet: n(s.squareFeet),
    pricePerSqFt: n(s.pricePerSqFt),
    currentElectricMw: n(s.currentElectricMw),
    projectedElectricMw: n(s.projectedElectricMw),
    electricProviderId: (s.electricProviderId as string | null) ?? null,
    electricProviderName: prov(s.electricProvider),
    waterProviderId: (s.waterProviderId as string | null) ?? null,
    waterProviderName: prov(s.waterProvider),
    sewerProviderId: (s.sewerProviderId as string | null) ?? null,
    sewerProviderName: prov(s.sewerProvider),
    gasProviderId: (s.gasProviderId as string | null) ?? null,
    gasProviderName: prov(s.gasProvider),
    submissionCount:
      (s._count as { submissions?: number } | undefined)?.submissions ??
      submissionCount,
  };
}

// The grid of inputs shared by the add form and each row's inline edit.
function SiteFieldsGrid({
  form,
  onChange,
  communities,
  providers,
}: {
  form: SiteForm;
  onChange: (patch: Partial<SiteForm>) => void;
  communities: CommunityLite[];
  providers: ProviderLite[];
}) {
  const byType = (t: string) => providers.filter((p) => p.type === t);
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <label className="block">
        <span className="label">Site name</span>
        <input
          className="input"
          placeholder="e.g. McCarty Park"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="label">Community</span>
        <select
          className="input"
          value={form.communityId}
          onChange={(e) => onChange({ communityId: e.target.value })}
        >
          <option value="">— Outside city limits</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">County</span>
        <select
          className="input"
          value={form.county}
          onChange={(e) => onChange({ county: e.target.value })}
        >
          <option value="">—</option>
          {COUNTY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Real estate type</span>
        <select
          className="input"
          value={form.realEstateType}
          onChange={(e) => onChange({ realEstateType: e.target.value })}
        >
          <option value="">—</option>
          {REAL_ESTATE_TYPES.map((t) => (
            <option key={t} value={t}>
              {REAL_ESTATE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Acreage</span>
        <input
          type="number"
          className="input"
          placeholder="acres"
          value={form.acreage}
          onChange={(e) => onChange({ acreage: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="label">Square feet</span>
        <input
          type="number"
          className="input"
          placeholder="sq ft"
          value={form.squareFeet}
          onChange={(e) => onChange({ squareFeet: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="label">Price per sq ft ($)</span>
        <input
          type="number"
          className="input"
          placeholder="$/sq ft"
          value={form.pricePerSqFt}
          onChange={(e) => onChange({ pricePerSqFt: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="label">Current electric (MW)</span>
        <input
          type="number"
          className="input"
          placeholder="MW"
          value={form.currentMw}
          onChange={(e) => onChange({ currentMw: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="label">Projected electric (MW)</span>
        <input
          type="number"
          className="input"
          placeholder="MW"
          value={form.projectedMw}
          onChange={(e) => onChange({ projectedMw: e.target.value })}
        />
      </label>
      {(
        [
          ["electricProviderId", "Electric provider", "ELECTRIC"],
          ["waterProviderId", "Water provider", "WATER"],
          ["sewerProviderId", "Sewer provider", "SEWER"],
          ["gasProviderId", "Gas provider", "GAS"],
        ] as const
      ).map(([key, label, type]) => (
        <label key={key} className="block">
          <span className="label">{label}</span>
          <select
            className="input"
            value={form[key]}
            onChange={(e) => onChange({ [key]: e.target.value } as Partial<SiteForm>)}
          >
            <option value="">—</option>
            {byType(type).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="block">
        <span className="label">Address / GPS</span>
        <input
          className="input"
          placeholder="optional"
          value={form.address}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export default function SitesManager({
  communities: initialCommunities,
  providers: initialProviders,
  initialSites,
}: {
  communities: CommunityLite[];
  providers: ProviderLite[];
  initialSites: SiteRow[];
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [communities, setCommunities] = useState(initialCommunities);
  const [providers, setProviders] = useState(initialProviders);
  const [sites, setSites] = useState(initialSites);

  // --- add-site form ---
  const [addForm, setAddForm] = useState<SiteForm>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- inline edit ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SiteForm>(emptyForm());
  const [editBusy, setEditBusy] = useState(false);

  // --- community form ---
  const [newCommunity, setNewCommunity] = useState("");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);

  // --- provider forms ---
  const [newProvider, setNewProvider] = useState("");
  const [newProviderType, setNewProviderType] = useState("ELECTRIC");
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerEdits, setProviderEdits] = useState<Record<string, string>>({});

  async function addSite() {
    if (!addForm.name.trim()) {
      setError("Site name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(addForm)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create site");
      setSites((cur) => [...cur, siteFromApi(json.site)]);
      setAddForm(emptyForm());
      toast.success(`Added ${json.site.name}.`);
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: SiteRow) {
    setEditingId(s.id);
    setEditForm(rowToForm(s));
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editForm.name.trim()) {
      toast.error("Site name is required.");
      return;
    }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/sites/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editForm)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save site");
      const updated = siteFromApi(json.site);
      setSites((cur) => cur.map((s) => (s.id === updated.id ? updated : s)));
      setEditingId(null);
      toast.success("Site updated.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteSite(s: SiteRow) {
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      description:
        s.submissionCount > 0
          ? `This site is on ${s.submissionCount} submission${s.submissionCount === 1 ? "" : "s"}. It will be removed from the catalog but those records are kept. You can undo this.`
          : "It will be removed from the sites catalog. You can undo this right after.",
      confirmLabel: "Delete site",
      tone: "danger",
    });
    if (!ok) return;

    setSites((cur) => cur.filter((x) => x.id !== s.id));
    try {
      const res = await fetch(`/api/sites/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`Deleted ${s.name}.`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const r = await fetch(`/api/sites/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restore: true }),
            });
            if (r.ok) {
              setSites((cur) =>
                [...cur, s].sort((a, b) => a.name.localeCompare(b.name)),
              );
              toast.info("Site restored.");
            } else {
              toast.error("Could not restore the site.");
            }
          },
        },
      });
    } catch {
      // Put it back if the delete failed.
      setSites((cur) => [...cur, s].sort((a, b) => a.name.localeCompare(b.name)));
      toast.error("Could not delete the site.");
    }
  }

  async function addCommunity() {
    if (!newCommunity.trim()) {
      setCommunityError("Community name is required.");
      return;
    }
    setCommunityBusy(true);
    setCommunityError(null);
    try {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCommunity }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add community");
      setCommunities((cur) => [
        ...cur,
        { id: json.community.id, name: json.community.name },
      ]);
      setNewCommunity("");
      toast.success(`Added ${json.community.name}.`);
    } catch (e) {
      setCommunityError((e as Error).message);
    } finally {
      setCommunityBusy(false);
    }
  }

  async function addProvider() {
    if (!newProvider.trim()) {
      setProviderError("Provider name is required.");
      return;
    }
    setProviderBusy(true);
    setProviderError(null);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProvider, type: newProviderType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add provider");
      setProviders((cur) => [
        ...cur,
        { id: json.provider.id, name: json.provider.name, type: json.provider.type },
      ]);
      setNewProvider("");
      toast.success(`Added ${json.provider.name}.`);
    } catch (e) {
      setProviderError((e as Error).message);
    } finally {
      setProviderBusy(false);
    }
  }

  async function renameProvider(p: ProviderLite) {
    const name = (providerEdits[p.id] ?? p.name).trim();
    if (!name || name === p.name) return;
    try {
      const res = await fetch(`/api/providers/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to rename provider");
      setProviders((cur) =>
        cur.map((x) => (x.id === p.id ? { ...x, name } : x)),
      );
      // The provider name is denormalized onto site rows; keep them in sync.
      setSites((cur) =>
        cur.map((s) => ({
          ...s,
          electricProviderName: s.electricProviderId === p.id ? name : s.electricProviderName,
          waterProviderName: s.waterProviderId === p.id ? name : s.waterProviderName,
          sewerProviderName: s.sewerProviderId === p.id ? name : s.sewerProviderName,
          gasProviderName: s.gasProviderId === p.id ? name : s.gasProviderName,
        })),
      );
      toast.success("Provider renamed.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteProvider(p: ProviderLite) {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      description: "This utility provider will be removed from the pick lists.",
      confirmLabel: "Delete provider",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/providers/${p.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to delete provider");
      setProviders((cur) => cur.filter((x) => x.id !== p.id));
      toast.success(`Deleted ${p.name}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Community groups, plus a trailing "Outside city limits" bucket for sites
  // with no community (only shown when it has any).
  const groups: { key: string; name: string; sites: SiteRow[] }[] = [
    ...communities.map((c) => ({
      key: c.id,
      name: c.name,
      sites: sites.filter((s) => s.communityId === c.id),
    })),
  ];
  const orphanSites = sites.filter((s) => !s.communityId);
  if (orphanSites.length) {
    groups.push({ key: "__none", name: "Outside city limits", sites: orphanSites });
  }

  return (
    <div className="space-y-5">
      {/* Add site */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-foreground">Add a site</h3>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2">
          <SiteFieldsGrid
            form={addForm}
            onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
            communities={communities}
            providers={providers}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button className="btn-primary" onClick={addSite} disabled={busy}>
            {busy ? "Saving…" : "Add site"}
          </button>
        </div>
      </div>

      {/* Grouped by community */}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
              <span className="badge bg-brand/8 text-muted">
                {g.sites.length} site{g.sites.length === 1 ? "" : "s"}
              </span>
            </div>
            {g.sites.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No sites yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 pr-3">Site</th>
                      <th className="py-1 pr-3">County</th>
                      <th className="py-1 pr-3">Type</th>
                      <th className="py-1 pr-3">Acreage</th>
                      <th className="py-1 pr-3">Sq ft</th>
                      <th className="py-1 pr-3">$/sq ft</th>
                      <th className="py-1 pr-3">Electric (cur/proj MW)</th>
                      <th className="py-1 pr-3">Electric</th>
                      <th className="py-1 pr-3">Water</th>
                      <th className="py-1 pr-3">Sewer</th>
                      <th className="py-1 pr-3">Gas</th>
                      <th className="py-1 pr-3 text-right">Subs</th>
                      <th className="py-1 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.sites.map((s) =>
                      editingId === s.id ? (
                        <tr key={s.id} className="border-t border-line align-top">
                          <td colSpan={13} className="py-3">
                            <div className="rounded-lg border border-line bg-brand/5 p-3">
                              <p className="mb-2 text-xs font-semibold text-muted">
                                Editing {s.name}
                              </p>
                              <SiteFieldsGrid
                                form={editForm}
                                onChange={(patch) =>
                                  setEditForm((f) => ({ ...f, ...patch }))
                                }
                                communities={communities}
                                providers={providers}
                              />
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  className="btn-secondary text-xs"
                                  onClick={() => setEditingId(null)}
                                  disabled={editBusy}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-primary text-xs"
                                  onClick={saveEdit}
                                  disabled={editBusy}
                                >
                                  {editBusy ? "Saving…" : "Save changes"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={s.id} className="border-t border-line align-top">
                          <td className="py-1 pr-3 font-medium text-foreground">
                            {s.name}
                            {s.address && (
                              <div className="text-xs font-normal text-muted">
                                {s.address}
                              </div>
                            )}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.county ? COUNTY_LABELS[s.county] ?? s.county : "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.realEstateType
                              ? REAL_ESTATE_TYPE_LABELS[s.realEstateType] ??
                                s.realEstateType
                              : "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.acreage ? `${formatNumber(s.acreage)} ac` : "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.squareFeet ? `${formatNumber(s.squareFeet)} sf` : "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.pricePerSqFt != null ? `$${formatNumber(s.pricePerSqFt)}` : "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.currentElectricMw != null || s.projectedElectricMw != null
                              ? `${s.currentElectricMw ?? "—"} / ${s.projectedElectricMw ?? "—"}`
                              : "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.electricProviderName ?? "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.waterProviderName ?? "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.sewerProviderName ?? "—"}
                          </td>
                          <td className="py-1 pr-3 text-muted">
                            {s.gasProviderName ?? "—"}
                          </td>
                          <td className="py-1 pr-3 text-right text-muted">
                            {s.submissionCount}
                          </td>
                          <td className="py-1 text-right whitespace-nowrap">
                            <button
                              className="text-xs text-brand hover:underline"
                              onClick={() => startEdit(s)}
                            >
                              Edit
                            </button>
                            <button
                              className="ml-3 inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                              onClick={() => deleteSite(s)}
                            >
                              <TrashIcon className="text-sm" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Manage utility providers */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-foreground">Utility providers</h3>
        {providerError && (
          <p className="mt-1 text-sm text-red-600">{providerError}</p>
        )}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select
            className="input sm:w-32"
            value={newProviderType}
            onChange={(e) => setNewProviderType(e.target.value)}
          >
            <option value="ELECTRIC">Electric</option>
            <option value="WATER">Water</option>
            <option value="SEWER">Sewer</option>
            <option value="GAS">Gas</option>
          </select>
          <input
            className="input"
            placeholder="New provider name"
            value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProvider()}
          />
          <button
            className="btn-secondary whitespace-nowrap"
            onClick={addProvider}
            disabled={providerBusy}
          >
            Add provider
          </button>
        </div>

        {providers.length > 0 && (
          <div className="mt-4 space-y-3">
            {["ELECTRIC", "WATER", "SEWER", "GAS"].map((type) => {
              const list = providers.filter((p) => p.type === type);
              if (!list.length) return null;
              return (
                <div key={type}>
                  <p className="label">{PROVIDER_TYPE_LABELS[type]}</p>
                  <div className="space-y-1">
                    {list.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <input
                          className="input h-8 max-w-xs py-1 text-sm"
                          value={providerEdits[p.id] ?? p.name}
                          onChange={(e) =>
                            setProviderEdits((m) => ({ ...m, [p.id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && renameProvider(p)}
                        />
                        <button
                          className="text-xs text-brand hover:underline disabled:opacity-40"
                          onClick={() => renameProvider(p)}
                          disabled={(providerEdits[p.id] ?? p.name).trim() === p.name}
                        >
                          Save
                        </button>
                        <button
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                          onClick={() => deleteProvider(p)}
                        >
                          <TrashIcon className="text-sm" />
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add community */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-foreground">Add a community</h3>
        {communityError && (
          <p className="mt-1 text-sm text-red-600">{communityError}</p>
        )}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            placeholder="Community name (e.g. Niederwald)"
            value={newCommunity}
            onChange={(e) => setNewCommunity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCommunity()}
          />
          <button
            className="btn-secondary whitespace-nowrap"
            onClick={addCommunity}
            disabled={communityBusy}
          >
            Add community
          </button>
        </div>
      </div>
    </div>
  );
}
