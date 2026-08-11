"use client";

import { useMemo, useState } from "react";
import { PIPELINE_STAGES } from "@/lib/projects/schema";
import {
  STAGE_LABELS,
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/format";
import { NAICS_BY_CODE } from "@/lib/naics";
import type {
  CityActivityProject,
  CityActivityReport,
  LeadSourceReport,
  ProviderActivityReport,
  QuarterlyReport,
  SiteVisitReport,
} from "@/lib/reports/data";

const COUNTY_OPTIONS = [
  { value: "", label: "All counties" },
  { value: "HAYS", label: "Hays County" },
  { value: "CALDWELL", label: "Caldwell County" },
];
const SORT_OPTIONS = [
  { value: "", label: "Default (community order)" },
  { value: "date", label: "Active date (newest first)" },
  { value: "status", label: "Status" },
  { value: "name", label: "Name" },
];

interface CommunityLite {
  id: string;
  name: string;
}
interface ProviderLite {
  id: string;
  name: string;
  type: string;
}

type ReportKind =
  | "city-activity"
  | "quarterly"
  | "provider-activity"
  | "lead-source"
  | "site-visits";

function quarterOptions(): string[] {
  const now = new Date();
  const opts: string[] = [];
  let year = now.getUTCFullYear();
  let q = Math.floor(now.getUTCMonth() / 3) + 1;
  for (let i = 0; i < 8; i++) {
    opts.push(`${year}-Q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      year -= 1;
    }
  }
  return opts;
}

export default function ReportsView({
  communities,
  providers,
}: {
  communities: CommunityLite[];
  providers: ProviderLite[];
}) {
  const electricProviders = providers.filter((p) => p.type === "ELECTRIC");
  const waterProviders = providers.filter((p) => p.type === "WATER");

  const [kind, setKind] = useState<ReportKind>("city-activity");
  const [communityId, setCommunityId] = useState("");
  const [county, setCounty] = useState("");
  const [sort, setSort] = useState("");
  const [naics, setNaics] = useState("");
  const [stage, setStage] = useState("");
  const [electricProviderId, setElectricProviderId] = useState("");
  const [waterProviderId, setWaterProviderId] = useState("");
  const [dimension, setDimension] = useState<"electric" | "water">("electric");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [quarter, setQuarter] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<CityActivityReport | null>(null);
  const [quarterly, setQuarterly] = useState<QuarterlyReport | null>(null);
  const [leadSource, setLeadSource] = useState<LeadSourceReport | null>(null);
  const [providerActivity, setProviderActivity] =
    useState<ProviderActivityReport | null>(null);
  const [siteVisits, setSiteVisits] = useState<SiteVisitReport | null>(null);

  // Lead Source and Site Visits are project-level, so community/provider
  // filters do not apply.
  const submissionScoped = kind !== "lead-source" && kind !== "site-visits";

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (submissionScoped && communityId) p.set("communityId", communityId);
    if (submissionScoped && county) p.set("county", county);
    if (submissionScoped && electricProviderId)
      p.set("electricProviderId", electricProviderId);
    if (submissionScoped && waterProviderId)
      p.set("waterProviderId", waterProviderId);
    if (kind === "provider-activity") p.set("dimension", dimension);
    if (naics) p.set("naics", naics);
    if (stage) p.set("stage", stage);
    if (sort) p.set("sort", sort);
    if (quarter) {
      p.set("quarter", quarter);
    } else {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    return p;
  }, [
    kind,
    dimension,
    submissionScoped,
    communityId,
    county,
    electricProviderId,
    waterProviderId,
    naics,
    stage,
    sort,
    quarter,
    from,
    to,
  ]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${kind}?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to run report");
      const json = await res.json();
      setCity(kind === "city-activity" ? json : null);
      setQuarterly(kind === "quarterly" ? json : null);
      setLeadSource(kind === "lead-source" ? json : null);
      setProviderActivity(kind === "provider-activity" ? json : null);
      setSiteVisits(kind === "site-visits" ? json : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function exportUrl(format: "pdf" | "xlsx") {
    const p = new URLSearchParams(query);
    p.set("format", format);
    return `/api/reports/${kind}?${p.toString()}`;
  }

  const hasResult =
    (kind === "city-activity" && city) ||
    (kind === "quarterly" && quarterly) ||
    (kind === "provider-activity" && providerActivity) ||
    (kind === "lead-source" && leadSource) ||
    (kind === "site-visits" && siteVisits);

  const tab = (k: ReportKind, label: string) => (
    <button
      className={kind === k ? "btn-primary" : "btn-secondary"}
      onClick={() => setKind(k)}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {tab("city-activity", "City Activity")}
          {tab("quarterly", "Quarterly Summary")}
          {tab("provider-activity", "Provider Activity")}
          {tab("lead-source", "Lead Source")}
          {tab("site-visits", "Site Visits")}
        </div>

        {kind === "provider-activity" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Group by</span>
            <div className="flex gap-1">
              <button
                className={
                  dimension === "electric" ? "btn-primary" : "btn-secondary"
                }
                onClick={() => setDimension("electric")}
              >
                Electric provider
              </button>
              <button
                className={
                  dimension === "water" ? "btn-primary" : "btn-secondary"
                }
                onClick={() => setDimension("water")}
              >
                Water provider
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="label">Community</label>
            <select
              className="input"
              value={communityId}
              disabled={!submissionScoped}
              onChange={(e) => setCommunityId(e.target.value)}
            >
              <option value="">All communities</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">County</label>
            <select
              className="input"
              value={county}
              disabled={!submissionScoped}
              onChange={(e) => setCounty(e.target.value)}
            >
              {COUNTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Electric provider</label>
            <select
              className="input"
              value={electricProviderId}
              disabled={!submissionScoped}
              onChange={(e) => setElectricProviderId(e.target.value)}
            >
              <option value="">All</option>
              {electricProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Water provider</label>
            <select
              className="input"
              value={waterProviderId}
              disabled={!submissionScoped}
              onChange={(e) => setWaterProviderId(e.target.value)}
            >
              <option value="">All</option>
              {waterProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">NAICS</label>
            <input
              className="input"
              placeholder="e.g. 531390"
              value={naics}
              onChange={(e) => setNaics(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Stage</label>
            <select
              className="input"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All stages</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quarter</label>
            <select
              className="input"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
            >
              <option value="">Custom dates</option>
              {quarterOptions().map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="input"
              value={from}
              disabled={!!quarter}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="input"
              value={to}
              disabled={!!quarter}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Sort projects by</label>
            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {kind === "lead-source" && (
          <p className="text-xs text-muted-2">
            Lead Source is a project-level report; the date filter applies to RFI
            receipt date. Community and provider filters do not apply.
          </p>
        )}
        {kind === "site-visits" && (
          <p className="text-xs text-muted-2">
            Site Visits lists projects visited within the selected date range
            (the date filter applies to the visit date). Community and provider
            filters do not apply.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={run} disabled={loading}>
            {loading ? "Running…" : "Run report"}
          </button>
          <a
            className={`btn-secondary ${hasResult ? "" : "pointer-events-none opacity-50"}`}
            href={exportUrl("pdf")}
          >
            Export PDF
          </a>
          <a
            className={`btn-secondary ${hasResult ? "" : "pointer-events-none opacity-50"}`}
            href={exportUrl("xlsx")}
          >
            Export Excel
          </a>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      {/* Results */}
      {kind === "city-activity" && city && <CityActivityResult report={city} />}
      {kind === "quarterly" && quarterly && (
        <QuarterlyResult report={quarterly} />
      )}
      {kind === "provider-activity" && providerActivity && (
        <ProviderActivityResult report={providerActivity} />
      )}
      {kind === "lead-source" && leadSource && (
        <LeadSourceResult report={leadSource} />
      )}
      {kind === "site-visits" && siteVisits && (
        <SiteVisitResult report={siteVisits} />
      )}
    </div>
  );
}

function SiteVisitResult({ report }: { report: SiteVisitReport }) {
  return (
    <div className="space-y-4">
      <FilterEcho f={report.filters} />
      <p className="text-sm text-muted">
        {report.totals.projects} project
        {report.totals.projects === 1 ? "" : "s"} · {report.totals.visits} site
        visit{report.totals.visits === 1 ? "" : "s"}
      </p>
      {report.rows.length === 0 ? (
        <p className="text-sm text-muted-2">
          No site visits match these filters.
        </p>
      ) : (
        report.rows.map((r) => (
          <div key={r.projectId} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {r.codename}
                <span className="ml-2 text-xs font-normal text-muted">
                  {STAGE_LABELS[r.stage] ?? r.stage}
                  {r.naicsCode ? ` · NAICS ${r.naicsCode}` : ""}
                  {r.companyLocation ? ` · ${r.companyLocation}` : ""}
                </span>
              </h3>
              <span className="badge bg-surface-2 text-muted">
                {r.visits.length} visit{r.visits.length === 1 ? "" : "s"}
              </span>
            </div>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-2">
                  <th className="py-1">Visit date</th>
                  <th className="py-1">Note</th>
                </tr>
              </thead>
              <tbody>
                {r.visits.map((v, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="mono py-1 text-foreground">{formatDate(v.date)}</td>
                    <td className="py-1 text-muted">{v.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

function ProviderActivityResult({
  report,
}: {
  report: ProviderActivityReport;
}) {
  const dim = report.dimension === "electric" ? "electric" : "water";
  return (
    <div className="space-y-4">
      <FilterEcho f={report.filters} />
      <p className="text-sm text-muted">
        Grouped by {dim} provider · {report.totals.providers} provider
        {report.totals.providers === 1 ? "" : "s"} · {report.totals.projects}{" "}
        project{report.totals.projects === 1 ? "" : "s"} ·{" "}
        {report.totals.submissions} submission
        {report.totals.submissions === 1 ? "" : "s"}
      </p>
      {report.groups.length === 0 ? (
        <p className="text-sm text-muted-2">
          No submissions match these filters.
        </p>
      ) : (
        report.groups.map((g) => (
          <div key={g.providerId ?? "none"} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand">
                {g.providerName}
              </h3>
              <span className="badge bg-surface-2 text-muted">
                {g.projectCount} project{g.projectCount === 1 ? "" : "s"} ·{" "}
                {g.submissionCount} submission{g.submissionCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {g.projects.map((p) => (
                <ProjectBlock key={p.projectId} p={p} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// NAICS as "code — official description" (never the free-text industry blurb).
function naicsText(code: string | null): string | null {
  if (!code) return null;
  const desc = NAICS_BY_CODE[code];
  return desc ? `NAICS ${code} — ${desc}` : `NAICS ${code}`;
}

// One project inside a city/provider report: identity + active date + the
// capex/jobs/wage figures, then the submitted site names. No acreage, no
// per-site status, no narrative.
function ProjectBlock({ p }: { p: CityActivityProject }) {
  const naics = naicsText(p.naicsCode);
  return (
    <div className="rounded-md border border-line bg-surface-2 p-2">
      <p className="text-sm font-semibold text-foreground">
        {p.codename}
        <span className="ml-2 text-xs font-normal text-muted">
          {STAGE_LABELS[p.stage] ?? p.stage}
          {p.rfiReceivedDate ? ` · Active ${formatDate(p.rfiReceivedDate)}` : ""}
        </span>
      </p>
      {naics && <p className="text-xs text-muted">{naics}</p>}
      <div className="mt-1 flex flex-wrap gap-x-6 gap-y-0.5 text-xs text-muted">
        <span>
          Capex:{" "}
          <span className="mono font-medium text-foreground">
            {p.capexTotal != null ? formatCurrency(p.capexTotal) : "—"}
          </span>
        </span>
        <span>
          Jobs:{" "}
          <span className="mono font-medium text-foreground">
            {p.jobs != null ? formatNumber(p.jobs) : "—"}
          </span>
        </span>
        <span>
          Avg wage:{" "}
          <span className="mono font-medium text-foreground">
            {p.avgWage != null ? formatCurrency(p.avgWage) : "—"}
          </span>
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        <span className="text-muted-2">Sites: </span>
        {p.sites.map((s) => s.siteName).join(", ") || "—"}
      </p>
    </div>
  );
}

function FilterEcho({
  f,
}: {
  f: {
    community: string;
    county: string;
    period: string;
    naics: string;
    stage: string;
    electricProvider?: string;
    waterProvider?: string;
  };
}) {
  return (
    <p className="text-xs text-muted">
      {f.community} · {f.county} · {f.period} · NAICS {f.naics} · Stage {f.stage}
      {f.electricProvider ? ` · Electric: ${f.electricProvider}` : ""}
      {f.waterProvider ? ` · Water: ${f.waterProvider}` : ""}
    </p>
  );
}

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function CityActivityResult({ report }: { report: CityActivityReport }) {
  return (
    <div className="space-y-4">
      <FilterEcho f={report.filters} />
      <p className="text-sm text-muted">
        {report.totals.communities} communit
        {report.totals.communities === 1 ? "y" : "ies"} ·{" "}
        {report.totals.projects} project
        {report.totals.projects === 1 ? "" : "s"} · {report.totals.submissions}{" "}
        submission{report.totals.submissions === 1 ? "" : "s"}
      </p>
      {report.communities.length === 0 ? (
        <p className="text-sm text-muted-2">No submissions match these filters.</p>
      ) : (
        report.communities.map((c) => (
          <div key={c.communityId} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand">
                {c.communityName}
              </h3>
              <span className="badge bg-surface-2 text-muted">
                {c.projectCount} project{c.projectCount === 1 ? "" : "s"} ·{" "}
                {c.submissionCount} submission{c.submissionCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {c.projects.map((p) => (
                <ProjectBlock key={p.projectId} p={p} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function QuarterlyResult({ report }: { report: QuarterlyReport }) {
  return (
    <div className="space-y-3">
      <FilterEcho f={report.filters} />
      <div className="card p-4">
        {report.rows.length === 0 ? (
          <p className="text-sm text-muted-2">
            No submissions match these filters.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-2">
                <th className="py-1">Community</th>
                <th className="py-1 text-right">Submissions</th>
                <th className="py-1 text-right">Projects</th>
                <th className="py-1 text-right">Active</th>
                <th className="py-1 text-right">Won</th>
                <th className="py-1 text-right">Lost</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.communityId} className="border-t border-line">
                  <td className="py-1 font-medium text-foreground">
                    {r.communityName}
                  </td>
                  <td className="mono py-1 text-right text-muted">
                    {r.submissions}
                  </td>
                  <td className="mono py-1 text-right text-muted">{r.projects}</td>
                  <td className="mono py-1 text-right text-muted">{r.active}</td>
                  <td className="mono py-1 text-right text-green-700">{r.won}</td>
                  <td className="mono py-1 text-right text-red-600">{r.lost}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line-2 font-semibold">
                <td className="py-1 text-foreground">Total</td>
                <td className="mono py-1 text-right">{report.totals.submissions}</td>
                <td className="mono py-1 text-right">{report.totals.projects}</td>
                <td className="mono py-1 text-right">{report.totals.active}</td>
                <td className="mono py-1 text-right text-green-700">
                  {report.totals.won}
                </td>
                <td className="mono py-1 text-right text-red-600">
                  {report.totals.lost}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LeadSourceResult({ report }: { report: LeadSourceReport }) {
  return (
    <div className="space-y-3">
      <FilterEcho f={report.filters} />
      <div className="card p-4">
        {report.rows.length === 0 ? (
          <p className="text-sm text-muted-2">
            No projects match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-2">
                  <th className="py-1 pr-3">Lead source</th>
                  <th className="py-1 px-2 text-right">Projects</th>
                  <th className="py-1 px-2 text-right">Won</th>
                  <th className="py-1 px-2 text-right">Lost</th>
                  <th className="py-1 px-2 text-right">Active</th>
                  <th className="py-1 px-2 text-right">Win rate</th>
                  <th className="py-1 px-2 text-right">Avg days to submit</th>
                  <th className="py-1 px-2 text-right">Peak jobs</th>
                  <th className="py-1 px-2 text-right">Avg acres</th>
                  <th className="py-1 px-2 text-right">Industries</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.leadSource} className="border-t border-line">
                    <td className="py-1 pr-3 font-medium text-foreground">
                      {r.leadSourceLabel}
                    </td>
                    <td className="mono py-1 px-2 text-right text-muted">
                      {r.projects}
                    </td>
                    <td className="mono py-1 px-2 text-right text-green-700">
                      {r.won}
                    </td>
                    <td className="mono py-1 px-2 text-right text-red-600">{r.lost}</td>
                    <td className="mono py-1 px-2 text-right text-muted">
                      {r.active}
                    </td>
                    <td className="mono py-1 px-2 text-right text-foreground">
                      {pct(r.successRate)}
                    </td>
                    <td className="mono py-1 px-2 text-right text-muted">
                      {r.avgDaysToSubmit == null
                        ? "—"
                        : Math.round(r.avgDaysToSubmit)}
                    </td>
                    <td className="mono py-1 px-2 text-right text-muted">
                      {formatNumber(r.peakJobs)}
                    </td>
                    <td className="mono py-1 px-2 text-right text-muted">
                      {r.avgAcreage == null ? "—" : Math.round(r.avgAcreage)}
                    </td>
                    <td className="mono py-1 px-2 text-right text-muted">
                      {r.industries}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line-2 font-semibold">
                  <td className="py-1 pr-3 text-foreground">Total</td>
                  <td className="mono py-1 px-2 text-right">
                    {report.totals.projects}
                  </td>
                  <td className="mono py-1 px-2 text-right text-green-700">
                    {report.totals.won}
                  </td>
                  <td className="mono py-1 px-2 text-right text-red-600">
                    {report.totals.lost}
                  </td>
                  <td className="mono py-1 px-2 text-right">
                    {report.totals.active}
                  </td>
                  <td className="mono py-1 px-2 text-right">—</td>
                  <td className="mono py-1 px-2 text-right">—</td>
                  <td className="mono py-1 px-2 text-right">
                    {formatNumber(report.totals.peakJobs)}
                  </td>
                  <td className="mono py-1 px-2 text-right">—</td>
                  <td className="mono py-1 px-2 text-right">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
