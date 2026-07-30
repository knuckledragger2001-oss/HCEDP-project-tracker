/**
 * Batch importer for MASTER FY26.xlsx -> HCEDP tracker.
 *
 * Reads the clean import.json produced by extract_fy26.py and writes Projects +
 * SiteVisits via Prisma. Mirrors src/lib/projects/create.ts so imported rows are
 * shaped exactly like app-entered ones, and reuses the app's normalizeLocation.
 *
 * Safety properties (matter most for the eventual prod run):
 *   1. Every imported project is tagged parsedModel = IMPORT_MARKER. On re-run
 *      the script deletes only its own prior imports (cascading to children),
 *      never touching staff-entered data. So it is idempotent + reversible.
 *   2. A codename already used by a NON-import project is skipped and reported,
 *      never duplicated or overwritten.
 *
 * NOT wrapped in one interactive transaction on purpose: over a high-latency
 * (prod / Railway) connection, 130+ nested creates in a single transaction blow
 * past Prisma's transaction timeout (P2028). Each project.create is its own
 * short atomic nested write instead; property (1) makes a partial run safe to
 * simply re-run.
 *
 * Usage:
 *   npx tsx scripts/import-fy26-tracker.ts <import.json> [--limit N] [--dry]
 *     --limit N : only import the first N projects
 *     --dry     : report what would happen; write nothing
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { normalizeLocation } from "../src/lib/location/normalize";

const IMPORT_MARKER = "xlsx-import:MASTER-FY26";

// Spreadsheet codenames that are the SAME project as an existing prod record
// filed under a different codename (prod prefixes some with "Project "). Confirmed
// with Daniel 2026-07-29. Skipped like any other already-exists match, but ONLY
// when the aliased prod record is actually present — so a clean/empty DB still
// imports them normally.
const KNOWN_EXISTING_ALIASES: Record<string, string> = {
  "Mockingbird Call": "Project Mockingbird Call",
  "Royal Tea": "Project Royal Tea",
};

const prisma = new PrismaClient();

type ImportProject = {
  codename: string;
  stage: string;
  leadSource: string;
  sourceContactName: string | null;
  sourceContactEmail: string | null;
  companyLocationRaw: string | null;
  naicsCode: string | null;
  industryDescription: string | null;
  projectType: string | null;
  capexTotal: number | null;
  minBuildingSqFt: number | null;
  minAcreage: number | null;
  buildingSizeNeeds: string | null;
  railPreference: string | null;
  existingBuildingPreference: string | null;
  transportationNotes: string | null;
  rfiReceivedDate: string | null;
  responseSubmittedDate: string | null;
  narrative: string | null;
  noSubmissionReason: string | null;
  archived: boolean;
  jobPhases: { count: number; timeframe: string }[];
  utilities: {
    type: string;
    rawValue: string;
    normalizedValue: number | null;
    normalizedUnit: string | null;
    flagged: boolean;
    assumptionNote: string | null;
    datapoints: {
      kind: string | null; label: string | null; value: number | null;
      unit: string | null; date: string | null; rawValue: string | null;
      flagged: boolean; assumptionNote: string | null;
    }[];
  }[];
  qualitativeNotes: { label: string; content: string }[];
};
type ImportVisit = { codename: string; visitDate: string; note: string | null };

const toDate = (s: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

async function main() {
  const args = process.argv.slice(2);
  const jsonPath = args.find((a) => !a.startsWith("--")) ?? "import.json";
  const limitArg = args.find((a) => a.startsWith("--limit"));
  const limit = limitArg ? Number(limitArg.split(/[=\s]/)[1] ?? args[args.indexOf(limitArg) + 1]) : Infinity;
  const dry = args.includes("--dry");

  const data = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
    projects: ImportProject[]; visits: ImportVisit[];
  };
  const projects = data.projects.slice(0, limit);
  const wantedCodenames = new Set(projects.map((p) => p.codename));
  const visits = data.visits.filter((v) => wantedCodenames.has(v.codename));

  console.log(`Loaded ${data.projects.length} projects / ${data.visits.length} visits from ${jsonPath}`);
  if (limit !== Infinity) console.log(`--limit ${limit}: importing first ${projects.length} projects`);
  if (dry) console.log("--dry: reporting only, writing nothing");

  // (1) Clear our own prior import (idempotent re-run). Cascades to children.
  const removed = dry
    ? { count: 0 }
    : await prisma.project.deleteMany({ where: { parsedModel: IMPORT_MARKER } });

  // (2) Guard against colliding with any existing project. Step (1) already
  // removed our own prior-import rows, so any *live* project left with a wanted
  // codename is foreign (staff-entered or AI-parsed) and must be left alone.
  // NOTE: do not filter on parsedModel — hand-entered projects have
  // parsedModel = NULL, and `{ not: MARKER }` silently drops NULL rows (SQL:
  // NULL <> 'x' is UNKNOWN), which would let those collide-and-duplicate.
  const aliasTargets = Object.values(KNOWN_EXISTING_ALIASES);
  const existing = await prisma.project.findMany({
    where: { codename: { in: [...wantedCodenames, ...aliasTargets] }, deletedAt: null },
    select: { codename: true },
  });
  const existingNames = new Set(existing.map((e) => e.codename));
  const conflicts = new Set<string>();
  for (const cn of wantedCodenames) {
    if (existingNames.has(cn)) conflicts.add(cn); // same codename already in DB
    const alias = KNOWN_EXISTING_ALIASES[cn];
    if (alias && existingNames.has(alias)) conflicts.add(cn); // same project, prod's codename
  }

  let created = 0;
  const skipped: string[] = [];
  const now = new Date();

  for (const p of projects) {
    if (conflicts.has(p.codename)) { skipped.push(p.codename); continue; }
    if (dry) { created++; continue; }

    const loc = p.companyLocationRaw
      ? normalizeLocation(p.companyLocationRaw)
      : { city: null, state: null, country: null };

    const projectData: Prisma.ProjectCreateInput = {
      codename: p.codename,
      stage: p.stage as Prisma.ProjectCreateInput["stage"],
      leadSource: p.leadSource as Prisma.ProjectCreateInput["leadSource"],
      sourceContactName: p.sourceContactName,
      sourceContactEmail: p.sourceContactEmail,
      companyLocationRaw: p.companyLocationRaw,
      companyCity: loc.city,
      companyState: loc.state,
      companyCountry: loc.country,
      naicsCode: p.naicsCode,
      industryDescription: p.industryDescription,
      narrative: p.narrative,
      projectType: p.projectType,
      capexTotal: p.capexTotal ?? null,
      minAcreage: p.minAcreage ?? null,
      minBuildingSqFt: p.minBuildingSqFt ?? null,
      buildingSizeNeeds: p.buildingSizeNeeds,
      existingBuildingPreference: (p.existingBuildingPreference as Prisma.ProjectCreateInput["existingBuildingPreference"]) ?? null,
      railPreference: (p.railPreference as Prisma.ProjectCreateInput["railPreference"]) ?? null,
      transportationNotes: p.transportationNotes,
      noSubmissionReason: p.noSubmissionReason,
      rfiReceivedDate: toDate(p.rfiReceivedDate),
      responseSubmittedDate: toDate(p.responseSubmittedDate),
      archivedAt: p.archived ? now : null,
      parsedModel: IMPORT_MARKER,
      parsedAt: now,
      stageHistory: { create: [{ toStage: p.stage as Prisma.ProjectCreateInput["stage"], note: "Imported from FY26 master tracker" }] },
      jobPhases: { create: p.jobPhases.map((j, i) => ({ count: j.count, timeframe: j.timeframe, orderIndex: i })) },
      utilities: {
        create: p.utilities.map((u) => ({
          type: u.type as Prisma.UtilityRequirementCreateWithoutProjectInput["type"],
          rawValue: u.rawValue,
          normalizedValue: u.normalizedValue,
          normalizedUnit: u.normalizedUnit,
          flagged: u.flagged,
          assumptionNote: u.assumptionNote,
          datapoints: {
            create: u.datapoints.map((d) => ({
              kind: d.kind, label: d.label, value: d.value, unit: d.unit,
              date: toDate(d.date), rawValue: d.rawValue,
              flagged: d.flagged, assumptionNote: d.assumptionNote,
            })),
          },
        })),
      },
      qualitativeNotes: { create: p.qualitativeNotes.map((q) => ({ label: q.label, content: q.content })) },
    };

    await prisma.project.create({ data: projectData, select: { id: true } });
    created++;
  }

  // (3) Site visits, matched to the imported projects by codename.
  let visitsCreated = 0;
  const visitsUnmatched: string[] = [];
  if (!dry) {
    const idByCodename = new Map(
      (await prisma.project.findMany({
        where: { parsedModel: IMPORT_MARKER },
        select: { id: true, codename: true },
      })).map((r) => [r.codename, r.id]),
    );
    const perProject = new Map<string, number>();
    for (const v of visits) {
      const pid = idByCodename.get(v.codename);
      if (!pid) { visitsUnmatched.push(v.codename); continue; }
      const idx = perProject.get(pid) ?? 0;
      perProject.set(pid, idx + 1);
      const d = toDate(v.visitDate);
      if (!d) { visitsUnmatched.push(v.codename); continue; }
      await prisma.siteVisit.create({ data: { projectId: pid, visitDate: d, note: v.note, orderIndex: idx } });
      visitsCreated++;
    }
  }

  console.log("\n=== Import summary ===");
  console.log(`Removed prior import rows: ${removed.count}`);
  console.log(`Projects created:          ${created}`);
  console.log(`Projects skipped (codename already exists): ${skipped.length}`, skipped);
  console.log(`Site visits created:       ${visitsCreated}`);
  console.log(`Site visits unmatched:     ${visitsUnmatched.length}`, [...new Set(visitsUnmatched)]);
  if (dry) console.log("\n(--dry) nothing written.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
