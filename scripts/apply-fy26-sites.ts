/**
 * Applies the reviewed site plan (from build_site_plan.py) to whatever database
 * DATABASE_URL points at: creates the approved NEW sites and the project<->site
 * Submissions, matching projects by codename and sites by name.
 *
 * Idempotent: a NEW site is only created if no live site already has that name,
 * and submissions use createMany({ skipDuplicates }) against the unique
 * [projectId, siteId]. Re-running adds nothing new.
 *
 * Usage: npx tsx scripts/apply-fy26-sites.ts <site-plan.json>
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const MARKER = "xlsx-import:MASTER-FY26";
const prisma = new PrismaClient();

type Plan = { new_sites: string[]; submissions: { codename: string; site: string }[] };

async function main() {
  const planPath = process.argv[2] ?? "site-plan.json";
  const plan = JSON.parse(readFileSync(planPath, "utf-8")) as Plan;

  // (1) Existing live sites, name(lower) -> id.
  const existing = await prisma.site.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const siteByName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s.id]));

  // (2) Create the approved NEW sites that don't already exist by name.
  let sitesCreated = 0;
  for (const name of plan.new_sites) {
    const key = name.trim().toLowerCase();
    if (siteByName.has(key)) continue;
    const site = await prisma.site.create({
      data: { name: name.trim(), attributes: { source: MARKER } },
      select: { id: true },
    });
    siteByName.set(key, site.id);
    sitesCreated++;
  }

  // (3) Imported projects, codename -> { id, submittedDate }.
  const projects = await prisma.project.findMany({
    where: { parsedModel: MARKER, deletedAt: null },
    select: { id: true, codename: true, responseSubmittedDate: true, rfiReceivedDate: true },
  });
  const projByCode = new Map(projects.map((p) => [p.codename, p]));

  // (4) Build submission rows; skip ones whose project (skipped/aliased) or site
  // (dropped) isn't present.
  const rows: {
    projectId: string; siteId: string; status: "SUBMITTED"; submissionDate: Date;
  }[] = [];
  let noProject = 0, noSite = 0;
  const seen = new Set<string>();
  for (const s of plan.submissions) {
    const proj = projByCode.get(s.codename);
    if (!proj) { noProject++; continue; }
    const siteId = siteByName.get(s.site.trim().toLowerCase());
    if (!siteId) { noSite++; continue; }
    const dedupe = `${proj.id}:${siteId}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    rows.push({
      projectId: proj.id,
      siteId,
      status: "SUBMITTED",
      submissionDate: proj.responseSubmittedDate ?? proj.rfiReceivedDate ?? new Date(),
    });
  }

  const created = await prisma.submission.createMany({ data: rows, skipDuplicates: true });

  console.log("=== Site plan applied ===");
  console.log(`New sites created:        ${sitesCreated} (of ${plan.new_sites.length} in plan)`);
  console.log(`Submission rows prepared: ${rows.length}`);
  console.log(`Submissions created:      ${created.count} (skipDuplicates)`);
  console.log(`Skipped — no imported project: ${noProject}`);
  console.log(`Skipped — site not in plan:    ${noSite}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
