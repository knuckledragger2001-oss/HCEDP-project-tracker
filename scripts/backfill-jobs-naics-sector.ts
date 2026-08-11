/**
 * One-off backfill for the 2026-08 batch update. For every live project:
 *   - sets `jobs` to the highest JobPhase.count (phased jobs are retired in
 *     favor of a single peak number, but existing phase rows are kept).
 *   - sets `naicsSector` to the canonical 2-digit sector derived from naicsCode.
 *
 * Idempotent and non-destructive: only writes a field when it is currently null
 * and a value can be derived. Re-running changes nothing. Existing JobPhase rows
 * are left untouched.
 *
 * Usage: npx tsx scripts/backfill-jobs-naics-sector.ts
 */
import { PrismaClient } from "@prisma/client";
import { toNaicsSector } from "../src/lib/naics";

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      codename: true,
      jobs: true,
      naicsCode: true,
      naicsSector: true,
      jobPhases: { select: { count: true } },
    },
  });

  let jobsSet = 0;
  let sectorSet = 0;

  for (const p of projects) {
    const data: { jobs?: number; naicsSector?: string } = {};

    if (p.jobs == null && p.jobPhases.length > 0) {
      const max = Math.max(...p.jobPhases.map((j) => j.count));
      if (Number.isFinite(max)) {
        data.jobs = max;
        jobsSet++;
      }
    }

    if (!p.naicsSector) {
      const sector = toNaicsSector(p.naicsCode);
      if (sector) {
        data.naicsSector = sector;
        sectorSet++;
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.project.update({ where: { id: p.id }, data });
    }
  }

  console.log(
    `Backfill complete over ${projects.length} live projects: ` +
      `jobs set on ${jobsSet}, naicsSector set on ${sectorSet}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
