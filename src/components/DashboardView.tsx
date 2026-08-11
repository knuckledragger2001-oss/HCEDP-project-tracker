"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PIPELINE_STAGES } from "@/lib/projects/schema";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { DashboardReport } from "@/lib/reports/dashboard";

interface CommunityLite {
  id: string;
  name: string;
}

const BRAND = "#174c34";
const ACCENT = "#6ba7c1";

// Distinct enough to tell eight slices apart, harmonized with the brand greens.
const PIE_COLORS = [
  "#174c34", "#2f6b4f", "#6ba7c1", "#d9a441",
  "#8b5cf6", "#0d9488", "#dc2626", "#64748b",
];

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

function percent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function Tile({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="card p-3">
      <p
        className={`font-semibold tabular-nums ${emphasis ? "text-2xl text-brand" : "text-lg text-foreground"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-10 text-center text-xs text-gray-400">{children}</p>
  );
}

// Recharts' default Sankey node is an unlabelled rectangle, which makes the
// diagram unreadable. This draws the node plus its stage name, always to the
// right of the bar — the chart's right margin reserves room for the terminal
// column's labels.
//
// Props arrive from Recharts, which clones this element with the computed
// geometry — hence the defaults rather than required props.
interface SankeyNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { name: string; value: number };
}

function SankeyNode({ x = 0, y = 0, width = 0, height = 0, payload }: SankeyNodeProps) {
  if (!payload) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={BRAND} rx={2} />
      <text
        x={x + width + 6}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={11}
        fill="#374151"
      >
        {payload.name}
        <tspan fill="#9ca3af"> {payload.value}</tspan>
      </text>
    </g>
  );
}

export default function DashboardView({
  communities,
}: {
  communities: CommunityLite[];
}) {
  const [communityId, setCommunityId] = useState("");
  const [stage, setStage] = useState("");
  const [quarter, setQuarter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (communityId) p.set("communityId", communityId);
    if (stage) p.set("stage", stage);
    if (quarter) {
      p.set("quarter", quarter);
    } else {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    return p;
  }, [communityId, stage, quarter, from, to]);
  const queryString = query.toString();

  // Both the result and any failure are tagged with the query that produced
  // them. Filters can be changed faster than the server answers, and a slow
  // response for an old filter would otherwise overwrite a fast one for the
  // current filter. Tagging also means "is this stale?" is derived rather than
  // tracked in a separate loading flag set from inside the effect.
  const [result, setResult] = useState<{
    query: string;
    report: DashboardReport;
  } | null>(null);
  const [failure, setFailure] = useState<{ query: string; message: string } | null>(
    null,
  );

  // Unlike the Reports page (where you pick a report, then press Run), the
  // dashboard is the whole point of the page, so it loads immediately and
  // refreshes whenever a filter changes.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/reports/dashboard?${queryString}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load the dashboard.");
        setResult({ query: queryString, report: await res.json() });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({
          query: queryString,
          message: e instanceof Error ? e.message : "Could not load the dashboard.",
        });
      });
    return () => controller.abort();
  }, [queryString]);

  const report = result?.report ?? null;
  const error = failure?.query === queryString ? failure.message : null;
  // Showing figures that no longer match the filters would be a lie, so dim them
  // until the answer for the current filters lands.
  const stale = result?.query !== queryString;

  const rates = report?.rates;
  const summary = report?.summary;

  const outcomeData = useMemo(() => {
    if (!rates) return [];
    return [
      { name: "Won", value: rates.won, color: "#174c34" },
      { name: "Lost", value: rates.lost, color: "#dc2626" },
      { name: "No submission", value: rates.noSubmission, color: "#64748b" },
      { name: "Still open", value: rates.open, color: "#6ba7c1" },
    ].filter((d) => d.value > 0);
  }, [rates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted">
            Pipeline roll-up for stakeholder and investor meetings.
          </p>
        </div>
        <a
          className="btn-secondary"
          href={`/api/reports/dashboard?${query.toString()}&format=pdf`}
        >
          Export PDF
        </a>
      </div>

      <div className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="label">Community</span>
          <select
            className="input"
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
          >
            <option value="">All communities</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Stage</span>
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
        </label>
        <label className="block">
          <span className="label">Quarter</span>
          <select
            className="input"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
          >
            <option value="">Custom range</option>
            {quarterOptions().map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">From</span>
          <input
            type="date"
            className="input"
            value={from}
            disabled={!!quarter}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">To</span>
          <input
            type="date"
            className="input"
            value={to}
            disabled={!!quarter}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!report && !error && (
        <p className="py-16 text-center text-sm text-muted">Loading…</p>
      )}

      {report && rates && summary && (
        <div className={stale ? "space-y-4 opacity-60" : "space-y-4"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Shortlist rate (of submitted)"
              value={percent(rates.shortlistRate)}
              hint={`${rates.shortlisted} of ${rates.submitted} submitted`}
              emphasis
            />
            <Tile
              label="Site visit rate (of submitted)"
              value={percent(rates.siteVisitRate)}
              hint={`${rates.siteVisited} of ${rates.submitted} submitted`}
              emphasis
            />
            <Tile label="RFIs received" value={formatNumber(rates.received)} />
            <Tile
              label="Responses submitted"
              value={formatNumber(rates.submitted)}
              hint={`${rates.noSubmission} passed on`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total capex" value={formatCurrency(summary.capexTotal)} />
            <Tile label="Average capex" value={formatCurrency(summary.capexAverage)} />
            <Tile label="Total jobs" value={formatNumber(summary.jobsTotal)} />
            <Tile
              label="Average jobs per project"
              value={
                summary.jobsAverage === null
                  ? "—"
                  : summary.jobsAverage.toLocaleString("en-US", {
                      maximumFractionDigits: 1,
                    })
              }
              hint="Across projects that reported jobs"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Average wage" value={formatCurrency(summary.avgWage)} />
            <Tile label="Acreage sought" value={formatNumber(summary.acreageTotal)} />
            <Tile label="Site submissions" value={formatNumber(summary.submissions)} />
            <Tile label="Site visits" value={formatNumber(summary.siteVisits)} />
          </div>

          <Panel
            title="RFIs received by month"
            description="Every month in range, including quiet ones."
          >
            {report.rfisByMonth.length === 0 ? (
              <Empty>No RFIs in this period.</Empty>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={report.rfisByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(23,76,52,0.06)" }}
                    formatter={(value) => [String(value), "RFIs"]}
                  />
                  <Bar dataKey="received" fill={BRAND} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Outcomes" description="Where this period's projects ended up.">
              {outcomeData.length === 0 ? (
                <Empty>No projects in this period.</Empty>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      label={(e: { name?: string; value?: number }) =>
                        `${e.name}: ${e.value}`
                      }
                      labelLine={false}
                    >
                      {outcomeData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Lead source" description="Where this period's projects came from.">
              {report.byLeadSource.length === 0 ? (
                <Empty>No projects in this period.</Empty>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={report.byLeadSource} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={140}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                    />
                    <Tooltip formatter={(value) => [String(value), "Projects"]} />
                    <Bar dataKey="count" fill={ACCENT} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <Panel
            title="Projects by status"
            description="Current pipeline stage of every project in range."
          >
            {report.byStatus.every((s) => s.count === 0) ? (
              <Empty>No projects in this period.</Empty>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={report.byStatus} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={130}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(23,76,52,0.06)" }}
                    formatter={(value) => [String(value), "Projects"]}
                  />
                  <Bar dataKey="count" fill={BRAND} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel
            title="Stage progression"
            description="How far each project got. A project that moved backwards and then advanced again is drawn as one clean run along its furthest path."
          >
            {report.sankey.links.length === 0 ? (
              <Empty>No stage movements in this period.</Empty>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={360}>
                  <Sankey
                    data={report.sankey}
                    nodePadding={26}
                    nodeWidth={12}
                    margin={{ top: 10, right: 130, bottom: 10, left: 10 }}
                    link={{ stroke: ACCENT, strokeOpacity: 0.28 }}
                    node={<SankeyNode />}
                  >
                    <Tooltip />
                  </Sankey>
                </ResponsiveContainer>
                {report.sankey.projectsWithBackwardMoves > 0 && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    {report.sankey.projectsWithBackwardMoves} project
                    {report.sankey.projectsWithBackwardMoves === 1 ? "" : "s"} moved
                    backwards at some point (for example, Shortlisted back to Pending
                    Information). Only the furthest path reached is drawn.
                  </p>
                )}
              </>
            )}
          </Panel>

          <Panel
            title="Top industries"
            description="By 2-digit NAICS sector. Up to eight."
          >
            {report.byIndustry.length === 0 ? (
              <Empty>No projects in this period.</Empty>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-[260px_1fr]">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={report.byIndustry}
                      dataKey="count"
                      nameKey="label"
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {report.byIndustry.map((d, i) => (
                        <Cell key={d.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [String(value), "Projects"]} />
                  </PieChart>
                </ResponsiveContainer>
                {/* NAICS descriptions are far too long for slice labels, so the
                    key sits beside the chart rather than on it. */}
                <ul className="space-y-1">
                  {report.byIndustry.map((d, i) => (
                    <li key={d.key} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="truncate text-foreground" title={d.label}>
                        {d.label}
                      </span>
                      <span className="ml-auto shrink-0 tabular-nums text-muted">
                        {d.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
