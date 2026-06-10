"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUBMISSION_STATUS_LABELS,
  formatDate,
  toDateInputValue,
} from "@/lib/format";

interface CommunityLite {
  id: string;
  name: string;
}
interface SiteLite {
  id: string;
  name: string;
  communityId: string;
  community: { name: string };
}
export interface SubmissionLite {
  id: string;
  status: string;
  outcomeNote: string | null;
  submissionDate: string;
  site: { id: string; name: string; community: { id: string; name: string } };
}

const STATUS_OPTIONS = Object.entries(SUBMISSION_STATUS_LABELS);

export default function SubmissionsPanel({
  projectId,
  initialSubmissions,
  communities,
  sites: initialSites,
}: {
  projectId: string;
  initialSubmissions: SubmissionLite[];
  communities: CommunityLite[];
  sites: SiteLite[];
}) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [sites, setSites] = useState(initialSites);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add-existing state
  const [siteId, setSiteId] = useState("");
  const [submissionDate, setSubmissionDate] = useState(
    toDateInputValue(new Date()),
  );
  const [status, setStatus] = useState("SUBMITTED");

  // quick-create site state
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteCommunity, setNewSiteCommunity] = useState(
    communities[0]?.id ?? "",
  );
  const [newSiteAcreage, setNewSiteAcreage] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, SubmissionLite[]>();
    for (const s of submissions) {
      const key = s.site.community.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }, [submissions]);

  async function quickCreateSite() {
    if (!newSiteName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSiteName,
          communityId: newSiteCommunity,
          acreage: newSiteAcreage ? Number(newSiteAcreage) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create site");
      const site: SiteLite = json.site;
      setSites((cur) =>
        [...cur, site].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSiteId(site.id);
      setNewSiteName("");
      setNewSiteAcreage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addSubmission() {
    if (!siteId) {
      setError("Pick a site to submit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, siteId, submissionDate, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add submission");
      setSubmissions((cur) => [json.submission, ...cur]);
      setSiteId("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    setSubmissions((cur) =>
      cur.map((s) => (s.id === id ? { ...s, status: newStatus } : s)),
    );
    await fetch("/api/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this submission?")) return;
    setSubmissions((cur) => cur.filter((s) => s.id !== id));
    await fetch(`/api/submissions?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add submission */}
      <div className="rounded-md border border-gray-200 p-3">
        <p className="text-sm font-semibold text-gray-800">Submit a site</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
          <select
            className="input md:col-span-2"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Select an existing site…</option>
            {communities.map((c) => {
              const cs = sites.filter((s) => s.communityId === c.id);
              if (cs.length === 0) return null;
              return (
                <optgroup key={c.id} label={c.name}>
                  {cs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <input
            type="date"
            className="input"
            value={submissionDate}
            onChange={(e) => setSubmissionDate(e.target.value)}
          />
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex justify-end">
          <button className="btn-primary" onClick={addSubmission} disabled={busy}>
            Add submission
          </button>
        </div>

        {/* Quick-create site */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-brand">
            + Quick-create a new site
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              className="input md:col-span-2"
              placeholder="Site name (e.g. CTX 110)"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
            />
            <select
              className="input"
              value={newSiteCommunity}
              onChange={(e) => setNewSiteCommunity(e.target.value)}
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
              value={newSiteAcreage}
              onChange={(e) => setNewSiteAcreage(e.target.value)}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <button
              className="btn-secondary"
              onClick={quickCreateSite}
              disabled={busy}
            >
              Create &amp; select
            </button>
          </div>
        </details>
      </div>

      {/* Existing submissions grouped by community */}
      {submissions.length === 0 ? (
        <p className="text-sm text-gray-400">No sites submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([community, subs]) => (
            <div key={community}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {community} · {subs.length}
              </p>
              <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {subs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {s.site.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {formatDate(s.submissionDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded border border-gray-200 px-1 py-1 text-xs"
                        value={s.status}
                        onChange={(e) => updateStatus(s.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => remove(s.id)}
                      >
                        remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
