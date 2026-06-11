"use client";

import { useState } from "react";
import {
  formatNumber,
  REAL_ESTATE_TYPE_LABELS,
  REAL_ESTATE_TYPES,
} from "@/lib/format";

interface CommunityLite {
  id: string;
  name: string;
}
interface ProviderLite {
  id: string;
  name: string;
  type: string; // "ELECTRIC" | "WATER" | "SEWER"
}
interface SiteRow {
  id: string;
  name: string;
  communityId: string;
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
  submissionCount: number;
}

const COUNTY_LABELS: Record<string, string> = {
  HAYS: "Hays",
  CALDWELL: "Caldwell",
  TRAVIS: "Travis",
};

export default function SitesManager({
  communities: initialCommunities,
  providers: initialProviders,
  initialSites,
}: {
  communities: CommunityLite[];
  providers: ProviderLite[];
  initialSites: SiteRow[];
}) {
  const [communities, setCommunities] = useState(initialCommunities);
  const [providers, setProviders] = useState(initialProviders);
  const [sites, setSites] = useState(initialSites);

  const electricProviders = providers.filter((p) => p.type === "ELECTRIC");
  const waterProviders = providers.filter((p) => p.type === "WATER");
  const sewerProviders = providers.filter((p) => p.type === "SEWER");

  // --- site form state ---
  const [name, setName] = useState("");
  const [communityId, setCommunityId] = useState(initialCommunities[0]?.id ?? "");
  const [acreage, setAcreage] = useState("");
  const [address, setAddress] = useState("");
  const [realEstateType, setRealEstateType] = useState("");
  const [county, setCounty] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [pricePerSqFt, setPricePerSqFt] = useState("");
  const [currentMw, setCurrentMw] = useState("");
  const [projectedMw, setProjectedMw] = useState("");
  const [electricProviderId, setElectricProviderId] = useState("");
  const [waterProviderId, setWaterProviderId] = useState("");
  const [sewerProviderId, setSewerProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- community form state ---
  const [newCommunity, setNewCommunity] = useState("");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);

  // --- provider form state ---
  const [newProvider, setNewProvider] = useState("");
  const [newProviderType, setNewProviderType] = useState("ELECTRIC");
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  async function addSite() {
    if (!name.trim()) {
      setError("Site name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          communityId,
          acreage: acreage ? Number(acreage) : null,
          address: address || null,
          realEstateType: realEstateType || null,
          county: county || null,
          squareFeet: squareFeet ? Number(squareFeet) : null,
          pricePerSqFt: pricePerSqFt ? Number(pricePerSqFt) : null,
          currentElectricMw: currentMw ? Number(currentMw) : null,
          projectedElectricMw: projectedMw ? Number(projectedMw) : null,
          electricProviderId: electricProviderId || null,
          waterProviderId: waterProviderId || null,
          sewerProviderId: sewerProviderId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create site");
      const s = json.site;
      setSites((cur) => [
        ...cur,
        {
          id: s.id,
          name: s.name,
          communityId: s.communityId,
          acreage: s.acreage,
          address: s.address,
          realEstateType: s.realEstateType,
          county: s.county,
          squareFeet: s.squareFeet,
          pricePerSqFt: s.pricePerSqFt,
          currentElectricMw: s.currentElectricMw,
          projectedElectricMw: s.projectedElectricMw,
          electricProviderId: s.electricProviderId,
          electricProviderName: s.electricProvider?.name ?? null,
          waterProviderId: s.waterProviderId,
          waterProviderName: s.waterProvider?.name ?? null,
          sewerProviderId: s.sewerProviderId,
          sewerProviderName: s.sewerProvider?.name ?? null,
          submissionCount: 0,
        },
      ]);
      setName("");
      setAcreage("");
      setAddress("");
      setRealEstateType("");
      setCounty("");
      setSquareFeet("");
      setPricePerSqFt("");
      setCurrentMw("");
      setProjectedMw("");
      setElectricProviderId("");
      setWaterProviderId("");
      setSewerProviderId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
      const added = { id: json.community.id, name: json.community.name };
      setCommunities((cur) => [...cur, added]);
      setCommunityId(added.id);
      setNewCommunity("");
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
    } catch (e) {
      setProviderError((e as Error).message);
    } finally {
      setProviderBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add community + add provider */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900">Add a community</h3>
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

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Add a utility provider
          </h3>
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
            </select>
            <input
              className="input"
              placeholder="Provider name"
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
        </div>
      </div>

      {/* Add site */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900">Add a site</h3>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="block">
            <span className="label">Site name</span>
            <input
              className="input"
              placeholder="e.g. McCarty Park"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Community</span>
            <select
              className="input"
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
            >
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Real estate type</span>
            <select
              className="input"
              value={realEstateType}
              onChange={(e) => setRealEstateType(e.target.value)}
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
            <span className="label">County</span>
            <select
              className="input"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            >
              <option value="">—</option>
              <option value="HAYS">Hays</option>
              <option value="CALDWELL">Caldwell</option>
              <option value="TRAVIS">Travis</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Acreage</span>
            <input
              type="number"
              className="input"
              placeholder="acres"
              value={acreage}
              onChange={(e) => setAcreage(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Square feet</span>
            <input
              type="number"
              className="input"
              placeholder="sq ft"
              value={squareFeet}
              onChange={(e) => setSquareFeet(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Price per sq ft ($)</span>
            <input
              type="number"
              className="input"
              placeholder="$/sq ft"
              value={pricePerSqFt}
              onChange={(e) => setPricePerSqFt(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Current electric (MW)</span>
            <input
              type="number"
              className="input"
              placeholder="MW"
              value={currentMw}
              onChange={(e) => setCurrentMw(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Projected electric (MW)</span>
            <input
              type="number"
              className="input"
              placeholder="MW"
              value={projectedMw}
              onChange={(e) => setProjectedMw(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Electric provider</span>
            <select
              className="input"
              value={electricProviderId}
              onChange={(e) => setElectricProviderId(e.target.value)}
            >
              <option value="">—</option>
              {electricProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Water provider</span>
            <select
              className="input"
              value={waterProviderId}
              onChange={(e) => setWaterProviderId(e.target.value)}
            >
              <option value="">—</option>
              {waterProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Sewer provider</span>
            <select
              className="input"
              value={sewerProviderId}
              onChange={(e) => setSewerProviderId(e.target.value)}
            >
              <option value="">—</option>
              {sewerProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Address / GPS</span>
            <input
              className="input"
              placeholder="optional"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="btn-primary" onClick={addSite} disabled={busy}>
            {busy ? "Saving…" : "Add site"}
          </button>
        </div>
      </div>

      {/* Grouped by community */}
      <div className="space-y-4">
        {communities.map((c) => {
          const cs = sites.filter((s) => s.communityId === c.id);
          return (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
                <span className="badge bg-gray-100 text-gray-600">
                  {cs.length} site{cs.length === 1 ? "" : "s"}
                </span>
              </div>
              {cs.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">No sites yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400">
                        <th className="py-1 pr-3">Site</th>
                        <th className="py-1 pr-3">Type</th>
                        <th className="py-1 pr-3">County</th>
                        <th className="py-1 pr-3">Acreage</th>
                        <th className="py-1 pr-3">Sq ft</th>
                        <th className="py-1 pr-3">$/sq ft</th>
                        <th className="py-1 pr-3">Electric (cur/proj MW)</th>
                        <th className="py-1 pr-3">Electric provider</th>
                        <th className="py-1 pr-3">Water provider</th>
                        <th className="py-1 pr-3">Sewer provider</th>
                        <th className="py-1 text-right">Subs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cs.map((s) => (
                        <tr key={s.id} className="border-t border-gray-100 align-top">
                          <td className="py-1 pr-3 font-medium text-gray-900">
                            {s.name}
                            {s.address && (
                              <div className="text-xs font-normal text-gray-400">
                                {s.address}
                              </div>
                            )}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.realEstateType
                              ? REAL_ESTATE_TYPE_LABELS[s.realEstateType] ??
                                s.realEstateType
                              : "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.county ? COUNTY_LABELS[s.county] ?? s.county : "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.acreage ? `${formatNumber(s.acreage)} ac` : "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.squareFeet ? `${formatNumber(s.squareFeet)} sf` : "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.pricePerSqFt != null ? `$${formatNumber(s.pricePerSqFt)}` : "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.currentElectricMw != null ||
                            s.projectedElectricMw != null
                              ? `${s.currentElectricMw ?? "—"} / ${s.projectedElectricMw ?? "—"}`
                              : "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.electricProviderName ?? "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.waterProviderName ?? "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">
                            {s.sewerProviderName ?? "—"}
                          </td>
                          <td className="py-1 text-right text-gray-600">
                            {s.submissionCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
