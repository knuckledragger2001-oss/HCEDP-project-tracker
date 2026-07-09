import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { leadSourceLabel } from "@/lib/format";
import { NAICS_BY_CODE } from "@/lib/naics";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { describeFilters, type ReportFilters, type ReportFilterLabels } from "./data";

// Stages a project can only be in once we actually submitted a response. A
// project sitting in RFI Received or Pending Information has not been submitted;
// No Submission means we deliberately passed.
const SUBMITTED_STAGES: PipelineStageValue[] = [
  "RFI_SUBMITTED",
  "SHORTLISTED",
  "SITE_VISIT",
  "IN_NEGOTIATIONS",
  "WON",
  "LOST",
];

const STAGE_ORDER = new Map(PIPELINE_STAGES.map((s, i) => [s.value, i]));

// The three outcomes. They are mutually exclusive and are NOT ordered relative
// to one another, so they must never be compared with STAGE_ORDER.
const TERMINAL_STAGES: PipelineStageValue[] = ["WON", "LOST", "NO_SUBMISSION"];
const isTerminal = (stage: PipelineStageValue) => TERMINAL_STAGES.includes(stage);

export interface DashboardRates {
  /** Projects won ÷ projects we submitted a response for. Our close rate. */
  winRateOfSubmitted: number | null;
  /** Projects won ÷ every RFI received. Passing on an RFI counts against this. */
  winRateOfReceived: number | null;
  received: number;
  submitted: number;
  won: number;
  lost: number;
  noSubmission: number;
  /** Still moving through the pipeline — neither won, lost, nor passed on. */
  open: number;
}

export interface MonthPoint {
  /** YYYY-MM */
  month: string;
  label: string;
  received: number;
}

export interface SankeyPayload {
  nodes: { name: string }[];
  /** `value` is the count of distinct projects that made the move. */
  links: { source: number; target: number; value: number }[];
  /** Projects whose stage history doubled back at some point. Their progression
   *  is charted along its furthest linear path, so the diagram shows how far
   *  each project got rather than every step it took. */
  projectsWithBackwardMoves: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
}

export interface DashboardSummary {
  capexTotal: number;
  capexAverage: number | null;
  avgWage: number | null;
  jobsTotal: number;
  /** Averaged over the projects that actually reported jobs, not over every
   *  project — otherwise projects whose RFI was silent on headcount would drag
   *  the figure toward zero. */
  jobsAverage: number | null;
  acreageTotal: number;
  siteVisits: number;
  submissions: number;
}

export interface DashboardReport {
  kind: "dashboard";
  filters: ReportFilterLabels;
  rates: DashboardRates;
  rfisByMonth: MonthPoint[];
  sankey: SankeyPayload;
  byIndustry: BreakdownRow[];
  byLeadSource: BreakdownRow[];
  summary: DashboardSummary;
}

// The dashboard filters projects directly (on rfiReceivedDate), unlike the
// submission-centric reports in data.ts which filter on submissionDate.
function projectWhere(f: ReportFilters): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = { archivedAt: null, deletedAt: null };

  if (f.from || f.to) {
    where.rfiReceivedDate = {};
    if (f.from) where.rfiReceivedDate.gte = f.from;
    if (f.to) where.rfiReceivedDate.lte = f.to;
  }
  if (f.naicsCode) where.naicsCode = f.naicsCode;
  if (f.stage) where.stage = f.stage as Prisma.ProjectWhereInput["stage"];

  // Community and provider are attributes of a submitted *site*, so constrain to
  // projects that submitted at least one site matching them.
  const siteWhere: Prisma.SiteWhereInput = {};
  if (f.communityId) siteWhere.communityId = f.communityId;
  if (f.electricProviderId) siteWhere.electricProviderId = f.electricProviderId;
  if (f.waterProviderId) siteWhere.waterProviderId = f.waterProviderId;
  if (Object.keys(siteWhere).length > 0) {
    where.submissions = { some: { site: siteWhere } };
  }

  return where;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Every month between the first and last RFI, so a quiet month reads as a zero
// rather than vanishing and compressing the x-axis.
function monthSeries(dates: Date[]): MonthPoint[] {
  if (dates.length === 0) return [];
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(monthKey(d), (counts.get(monthKey(d)) ?? 0) + 1);

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const cursor = new Date(
    Date.UTC(sorted[0].getUTCFullYear(), sorted[0].getUTCMonth(), 1),
  );
  const last = sorted[sorted.length - 1];
  const end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1);

  const out: MonthPoint[] = [];
  while (cursor.getTime() <= end) {
    const key = monthKey(cursor);
    out.push({
      month: key,
      label: `${MONTH_LABELS[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(2)}`,
      received: counts.get(key) ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

// Aggregate stage history into Sankey nodes + links.
//
// Each project is charted along a single linear path: the sequence of stages at
// which it reached a new furthest point. A project that was pushed back to
// Pending Information and then advanced again contributes one clean run, not a
// loop — real projects progress, and the doubling-back is bookkeeping noise
// rather than something a stakeholder needs to see. (A Sankey cannot draw a
// cycle in any case; Recharts' layout would not terminate.)
//
// The path ends at the project's *current* outcome, if it has one. Outcomes are
// taken from the project row rather than from history, so the terminal nodes
// total exactly what the Won / Lost / No Submission figures above the chart say
// — a project once marked Won and later reopened is counted where it is now,
// not where it has been.
//
// A link's value is therefore a count of distinct projects.
function buildSankey(
  projects: { id: string; stage: PipelineStageValue }[],
  // Must arrive ordered by changedAt ascending.
  events: { projectId: string; toStage: PipelineStageValue }[],
): SankeyPayload {
  const historyByProject = new Map<string, PipelineStageValue[]>();
  for (const e of events) {
    const list = historyByProject.get(e.projectId) ?? [];
    list.push(e.toStage);
    historyByProject.set(e.projectId, list);
  }

  const linkCounts = new Map<string, number>();
  const bump = (from: number, to: number) => {
    const key = `${from}>${to}`;
    linkCounts.set(key, (linkCounts.get(key) ?? 0) + 1);
  };

  let projectsWithBackwardMoves = 0;

  for (const project of projects) {
    const history = historyByProject.get(project.id) ?? [];
    let furthest: number | null = null;
    let doubledBack = false;

    for (const stage of history) {
      // Outcomes are handled below, off the project's current stage. Comparing
      // them by index would make Won → Lost look like forward progress.
      if (isTerminal(stage)) continue;
      const index = STAGE_ORDER.get(stage);
      if (index === undefined) continue;

      if (furthest === null) {
        furthest = index;
        continue;
      }
      if (index > furthest) {
        bump(furthest, index);
        furthest = index;
      } else if (index < furthest) {
        doubledBack = true;
      }
    }

    // A project with no recorded history still entered at RFI Received.
    if (furthest === null) furthest = 0;
    if (doubledBack) projectsWithBackwardMoves++;

    if (isTerminal(project.stage)) {
      const outcome = STAGE_ORDER.get(project.stage);
      if (outcome !== undefined) bump(furthest, outcome);
    }
  }

  // Emit only the stages that actually appear in a link. Recharts' Sankey lays
  // out by walking links from each node; an unreferenced node has no depth and
  // renders as a stray box at the origin. Indices are remapped accordingly.
  const used = new Set<number>();
  for (const key of linkCounts.keys()) {
    const [source, target] = key.split(">").map(Number);
    used.add(source);
    used.add(target);
  }
  const ordered = [...used].sort((a, b) => a - b);
  const remap = new Map(ordered.map((stageIndex, i) => [stageIndex, i]));

  const nodes = ordered.map((i) => ({ name: PIPELINE_STAGES[i].label }));
  const links = [...linkCounts.entries()]
    .map(([key, value]) => {
      const [source, target] = key.split(">").map(Number);
      return { source: remap.get(source)!, target: remap.get(target)!, value };
    })
    .sort((a, b) => a.source - b.source || a.target - b.target);

  return { nodes, links, projectsWithBackwardMoves };
}

function topBreakdown(
  rows: { key: string | null; label: string }[],
  limit: number,
): BreakdownRow[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    const key = r.key ?? "__none__";
    const entry = counts.get(key) ?? { label: r.label, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function dashboardReport(f: ReportFilters): Promise<DashboardReport> {
  const where = projectWhere(f);

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      stage: true,
      naicsCode: true,
      industryDescription: true,
      leadSource: true,
      capexTotal: true,
      avgWage: true,
      minAcreage: true,
      rfiReceivedDate: true,
      jobPhases: { select: { count: true } },
      _count: { select: { siteVisits: true, submissions: true } },
    },
  });

  const received = projects.length;
  const won = projects.filter((p) => p.stage === "WON").length;
  const lost = projects.filter((p) => p.stage === "LOST").length;
  const noSubmission = projects.filter((p) => p.stage === "NO_SUBMISSION").length;
  const submitted = projects.filter((p) =>
    SUBMITTED_STAGES.includes(p.stage as PipelineStageValue),
  ).length;

  const rates: DashboardRates = {
    winRateOfSubmitted: rate(won, submitted),
    winRateOfReceived: rate(won, received),
    received,
    submitted,
    won,
    lost,
    noSubmission,
    open: received - won - lost - noSubmission,
  };

  const rfisByMonth = monthSeries(
    projects
      .map((p) => p.rfiReceivedDate)
      .filter((d): d is Date => d !== null),
  );

  // Ordered ascending: buildSankey walks each project's history in time order to
  // find how far it got.
  const events = await prisma.projectStageEvent.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: { projectId: true, toStage: true },
    orderBy: { changedAt: "asc" },
  });
  const sankey = buildSankey(
    projects.map((p) => ({ id: p.id, stage: p.stage })),
    events,
  );

  const byIndustry = topBreakdown(
    projects.map((p) => ({
      key: p.naicsCode,
      label: p.naicsCode
        ? (NAICS_BY_CODE[p.naicsCode] ?? p.industryDescription ?? p.naicsCode)
        : "Not specified",
    })),
    8,
  );

  const byLeadSource = topBreakdown(
    projects.map((p) => ({ key: p.leadSource, label: leadSourceLabel(p.leadSource) })),
    10,
  );

  const projectJobs = projects.map((p) =>
    p.jobPhases.reduce((sum, j) => sum + j.count, 0),
  );
  const jobsTotal = projectJobs.reduce((a, b) => a + b, 0);
  const projectsReportingJobs = projectJobs.filter((n) => n > 0).length;

  const capexValues = projects
    .map((p) => (p.capexTotal ? Number(p.capexTotal) : null))
    .filter((n): n is number => n !== null);
  const wageValues = projects
    .map((p) => (p.avgWage ? Number(p.avgWage) : null))
    .filter((n): n is number => n !== null);

  const summary: DashboardSummary = {
    capexTotal: capexValues.reduce((a, b) => a + b, 0),
    capexAverage:
      capexValues.length > 0
        ? capexValues.reduce((a, b) => a + b, 0) / capexValues.length
        : null,
    // A plain mean of each project's average wage. Weighting by headcount would
    // need a wage per job phase, which the RFIs do not give us.
    avgWage:
      wageValues.length > 0
        ? wageValues.reduce((a, b) => a + b, 0) / wageValues.length
        : null,
    jobsTotal,
    jobsAverage: projectsReportingJobs > 0 ? jobsTotal / projectsReportingJobs : null,
    acreageTotal: projects.reduce((sum, p) => sum + (p.minAcreage ?? 0), 0),
    siteVisits: projects.reduce((sum, p) => sum + p._count.siteVisits, 0),
    submissions: projects.reduce((sum, p) => sum + p._count.submissions, 0),
  };

  return {
    kind: "dashboard",
    filters: await describeFilters(f),
    rates,
    rfisByMonth,
    sankey,
    byIndustry,
    byLeadSource,
    summary,
  };
}
