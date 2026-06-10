"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";

interface CommunityLite {
  id: string;
  name: string;
}
interface SiteRow {
  id: string;
  name: string;
  communityId: string;
  acreage: number | null;
  address: string | null;
  submissionCount: number;
}

export default function SitesManager({
  communities: initialCommunities,
  initialSites,
}: {
  communities: CommunityLite[];
  initialSites: SiteRow[];
}) {
  const [communities, setCommunities] = useState(initialCommunities);
  const [sites, setSites] = useState(initialSites);
  const [name, setName] = useState("");
  const [communityId, setCommunityId] = useState(initialCommunities[0]?.id ?? "");
  const [acreage, setAcreage] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCommunity, setNewCommunity] = useState("");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);

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
      // Select the new community for the next site, and clear the input.
      setCommunityId(added.id);
      setNewCommunity("");
    } catch (e) {
      setCommunityError((e as Error).message);
    } finally {
      setCommunityBusy(false);
    }
  }

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
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create site");
      setSites((cur) => [
        ...cur,
        {
          id: json.site.id,
          name: json.site.name,
          communityId: json.site.communityId,
          acreage: json.site.acreage,
          address: json.site.address,
          submissionCount: 0,
        },
      ]);
      setName("");
      setAcreage("");
      setAddress("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add community */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900">Add a community</h3>
        {communityError && (
          <p className="mt-1 text-sm text-red-600">{communityError}</p>
        )}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="input sm:max-w-xs"
            placeholder="Community name (e.g. Niederwald)"
            value={newCommunity}
            onChange={(e) => setNewCommunity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCommunity()}
          />
          <button
            className="btn-secondary"
            onClick={addCommunity}
            disabled={communityBusy}
          >
            Add community
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Communities group sites and drive report breakdowns. New ones appear
          at the end of the list.
        </p>
      </div>

      {/* Quick add */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900">Add a site</h3>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
          <input
            className="input md:col-span-2"
            placeholder="Site name (e.g. McCarty Park)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSite()}
          />
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
          <input
            type="number"
            className="input"
            placeholder="acreage"
            value={acreage}
            onChange={(e) => setAcreage(e.target.value)}
          />
          <button className="btn-primary" onClick={addSite} disabled={busy}>
            Add site
          </button>
        </div>
        <input
          className="input mt-2"
          placeholder="Address or GPS (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
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
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400">
                      <th className="py-1">Site</th>
                      <th className="py-1">Acreage</th>
                      <th className="py-1">Address / GPS</th>
                      <th className="py-1 text-right">Submissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cs.map((s) => (
                      <tr key={s.id} className="border-t border-gray-100">
                        <td className="py-1 font-medium text-gray-900">
                          {s.name}
                        </td>
                        <td className="py-1 text-gray-600">
                          {s.acreage ? `${formatNumber(s.acreage)} ac` : "—"}
                        </td>
                        <td className="py-1 text-gray-600">{s.address ?? "—"}</td>
                        <td className="py-1 text-right text-gray-600">
                          {s.submissionCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
