import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Filters shared by both partner reports. All optional; absent = no constraint.
export interface ReportFilters {
  communityId?: string | null;
  from?: Date | null; // inclusive lower bound on submissionDate
  to?: Date | null; // inclusive upper bound on submissionDate
  naicsCode?: string | null;
  stage?: string | null; // PipelineStage value
}

export interface ReportFilterLabels {
  community: string;
  period: string;
  naics: string;
  stage: string;
}

// Build the Prisma `where` for Submission rows that satisfy the filters.
function submissionWhere(f: ReportFilters): Prisma.SubmissionWhereInput {
  const where: Prisma.SubmissionWhereInput = {};

  if (f.from || f.to) {
    where.submissionDate = {};
    if (f.from) where.submissionDate.gte = f.from;
    if (f.to) where.submissionDate.lte = f.to;
  }
  if (f.communityId) {
    where.site = { communityId: f.communityId };
  }
  // Archived projects are excluded from all reporting.
  const projectWhere: Prisma.ProjectWhereInput = { archivedAt: null };
  if (f.naicsCode) projectWhere.naicsCode = f.naicsCode;
  if (f.stage) projectWhere.stage = f.stage as Prisma.ProjectWhereInput["stage"];
  where.project = projectWhere;

  return where;
}

// Human-readable echo of the applied filters, for report headers.
export async function describeFilters(
  f: ReportFilters,
): Promise<ReportFilterLabels> {
  let community = "All communities";
  if (f.communityId) {
    const c = await prisma.community.findUnique({
      where: { id: f.communityId },
      select: { name: true },
    });
    community = c?.name ?? "Unknown community";
  }

  let period = "All dates";
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (f.from && f.to) period = `${fmt(f.from)} – ${fmt(f.to)}`;
  else if (f.from) period = `From ${fmt(f.from)}`;
  else if (f.to) period = `Through ${fmt(f.to)}`;

  return {
    community,
    period,
    naics: f.naicsCode ? f.naicsCode : "All",
    stage: f.stage ? f.stage.replace(/_/g, " ") : "All",
  };
}

// ---------------------------------------------------------------------------
// Report 1 — City Activity
// Projects that submitted at least one site in a community, grouped by
// community then by project, with the submitted sites listed under each.
// ---------------------------------------------------------------------------

export interface CityActivitySite {
  siteName: string;
  acreage: number | null;
  submissionDate: string; // ISO
  status: string;
  outcomeNote: string | null;
}
export interface CityActivityProject {
  projectId: string;
  codename: string;
  stage: string;
  naicsCode: string | null;
  industryDescription: string | null;
  sites: CityActivitySite[];
}
export interface CityActivityCommunity {
  communityId: string;
  communityName: string;
  projectCount: number;
  submissionCount: number;
  projects: CityActivityProject[];
}
export interface CityActivityReport {
  kind: "city-activity";
  filters: ReportFilterLabels;
  communities: CityActivityCommunity[];
  totals: { communities: number; projects: number; submissions: number };
}

export async function cityActivityReport(
  f: ReportFilters,
): Promise<CityActivityReport> {
  const submissions = await prisma.submission.findMany({
    where: submissionWhere(f),
    orderBy: [
      { site: { community: { order: "asc" } } },
      { project: { codename: "asc" } },
      { submissionDate: "desc" },
    ],
    include: {
      project: {
        select: {
          id: true,
          codename: true,
          stage: true,
          naicsCode: true,
          industryDescription: true,
        },
      },
      site: {
        select: {
          name: true,
          acreage: true,
          community: { select: { id: true, name: true, order: true } },
        },
      },
    },
  });

  // community -> project -> sites
  const communities = new Map<
    string,
    {
      order: number;
      name: string;
      projects: Map<string, CityActivityProject>;
      submissionCount: number;
    }
  >();

  for (const s of submissions) {
    const c = s.site.community;
    let cEntry = communities.get(c.id);
    if (!cEntry) {
      cEntry = {
        order: c.order,
        name: c.name,
        projects: new Map(),
        submissionCount: 0,
      };
      communities.set(c.id, cEntry);
    }
    cEntry.submissionCount += 1;

    let pEntry = cEntry.projects.get(s.project.id);
    if (!pEntry) {
      pEntry = {
        projectId: s.project.id,
        codename: s.project.codename,
        stage: s.project.stage,
        naicsCode: s.project.naicsCode,
        industryDescription: s.project.industryDescription,
        sites: [],
      };
      cEntry.projects.set(s.project.id, pEntry);
    }
    pEntry.sites.push({
      siteName: s.site.name,
      acreage: s.site.acreage,
      submissionDate: s.submissionDate.toISOString(),
      status: s.status,
      outcomeNote: s.outcomeNote,
    });
  }

  const communityRows: CityActivityCommunity[] = [...communities.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id, c]) => ({
      communityId: id,
      communityName: c.name,
      projectCount: c.projects.size,
      submissionCount: c.submissionCount,
      projects: [...c.projects.values()],
    }));

  return {
    kind: "city-activity",
    filters: await describeFilters(f),
    communities: communityRows,
    totals: {
      communities: communityRows.length,
      projects: communityRows.reduce((n, c) => n + c.projectCount, 0),
      submissions: submissions.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Report 2 — Quarterly Submission Summary
// Per-community counts: submissions, distinct projects, and win/loss outcomes.
// ---------------------------------------------------------------------------

export interface QuarterlyRow {
  communityId: string;
  communityName: string;
  submissions: number;
  projects: number;
  won: number;
  lost: number;
  active: number; // neither won nor lost
}
export interface QuarterlyReport {
  kind: "quarterly-summary";
  filters: ReportFilterLabels;
  rows: QuarterlyRow[];
  totals: Omit<QuarterlyRow, "communityId" | "communityName">;
}

const WON_STATUSES = new Set(["WON"]);
const LOST_STATUSES = new Set(["LOST", "WITHDRAWN"]);

export async function quarterlySummaryReport(
  f: ReportFilters,
): Promise<QuarterlyReport> {
  const submissions = await prisma.submission.findMany({
    where: submissionWhere(f),
    include: {
      site: {
        select: {
          community: { select: { id: true, name: true, order: true } },
        },
      },
    },
  });

  const map = new Map<
    string,
    {
      order: number;
      name: string;
      submissions: number;
      projects: Set<string>;
      won: number;
      lost: number;
      active: number;
    }
  >();

  for (const s of submissions) {
    const c = s.site.community;
    let entry = map.get(c.id);
    if (!entry) {
      entry = {
        order: c.order,
        name: c.name,
        submissions: 0,
        projects: new Set(),
        won: 0,
        lost: 0,
        active: 0,
      };
      map.set(c.id, entry);
    }
    entry.submissions += 1;
    entry.projects.add(s.projectId);
    if (WON_STATUSES.has(s.status)) entry.won += 1;
    else if (LOST_STATUSES.has(s.status)) entry.lost += 1;
    else entry.active += 1;
  }

  const rows: QuarterlyRow[] = [...map.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id, e]) => ({
      communityId: id,
      communityName: e.name,
      submissions: e.submissions,
      projects: e.projects.size,
      won: e.won,
      lost: e.lost,
      active: e.active,
    }));

  const totals = rows.reduce(
    (acc, r) => ({
      submissions: acc.submissions + r.submissions,
      projects: acc.projects + r.projects,
      won: acc.won + r.won,
      lost: acc.lost + r.lost,
      active: acc.active + r.active,
    }),
    { submissions: 0, projects: 0, won: 0, lost: 0, active: 0 },
  );

  return {
    kind: "quarterly-summary",
    filters: await describeFilters(f),
    rows,
    totals,
  };
}

// Parse query-string filters into a typed ReportFilters.
export function parseFilters(params: URLSearchParams): ReportFilters {
  const communityId = params.get("communityId");
  const naicsCode = params.get("naics");
  const stage = params.get("stage");
  const fromStr = params.get("from");
  const toStr = params.get("to");
  const quarter = params.get("quarter"); // format: YYYY-Qn

  let from: Date | null = fromStr ? new Date(fromStr) : null;
  let to: Date | null = toStr ? new Date(toStr) : null;

  if (quarter) {
    const m = /^(\d{4})-Q([1-4])$/.exec(quarter);
    if (m) {
      const year = Number(m[1]);
      const q = Number(m[2]);
      const startMonth = (q - 1) * 3;
      from = new Date(Date.UTC(year, startMonth, 1));
      to = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
    }
  }
  // Make `to` inclusive of the whole day when only a date was given.
  if (to && toStr && !quarter) {
    to = new Date(`${toStr}T23:59:59.999Z`);
  }

  return {
    communityId: communityId || null,
    naicsCode: naicsCode || null,
    stage: stage || null,
    from: from && !isNaN(from.getTime()) ? from : null,
    to: to && !isNaN(to.getTime()) ? to : null,
  };
}
