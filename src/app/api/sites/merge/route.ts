import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Merge one or more duplicate sites into a single "keeper". Every submission on
// a merged site is re-pointed at the keeper; a submission that would collide
// with one the keeper already has for the same project (the unique
// [projectId, siteId]) is dropped as the true duplicate. The merged sites are
// then soft-deleted, so they vanish from the catalog and pickers but the rows
// survive (restorable, like an ordinary site delete).
const MergeSchema = z.object({
  keepId: z.string().min(1),
  mergeIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = MergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid merge request", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const { keepId } = parsed.data;
  // The keeper can't also be one of the sites being merged away.
  const mergeIds = [...new Set(parsed.data.mergeIds)].filter((id) => id !== keepId);
  if (mergeIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one other site to merge into the one you keep." },
      { status: 400 },
    );
  }

  const ids = [keepId, ...mergeIds];
  const sites = await prisma.site.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, name: true },
  });
  if (sites.length !== ids.length) {
    return NextResponse.json(
      { error: "One or more of the selected sites no longer exists." },
      { status: 404 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Projects the keeper is already submitted for — these define collisions.
    const keepSubs = await tx.submission.findMany({
      where: { siteId: keepId },
      select: { projectId: true },
    });
    const keepProjects = new Set(keepSubs.map((s) => s.projectId));

    const mergeSubs = await tx.submission.findMany({
      where: { siteId: { in: mergeIds } },
      select: { id: true, projectId: true },
    });

    const moveIds: string[] = [];
    const dropIds: string[] = [];
    for (const s of mergeSubs) {
      if (keepProjects.has(s.projectId)) {
        dropIds.push(s.id); // keeper already has this project — this is the dup
      } else {
        moveIds.push(s.id);
        keepProjects.add(s.projectId); // guard against two merged sites, same project
      }
    }

    if (dropIds.length) {
      await tx.submission.deleteMany({ where: { id: { in: dropIds } } });
    }
    if (moveIds.length) {
      await tx.submission.updateMany({
        where: { id: { in: moveIds } },
        data: { siteId: keepId },
      });
    }
    await tx.site.updateMany({
      where: { id: { in: mergeIds } },
      data: { deletedAt: new Date() },
    });

    const keep = await tx.site.findUniqueOrThrow({
      where: { id: keepId },
      select: { id: true, name: true, _count: { select: { submissions: true } } },
    });
    return { keep, moved: moveIds.length, dropped: dropIds.length };
  });

  return NextResponse.json({
    keepId,
    mergedIds: mergeIds,
    keepName: result.keep.name,
    submissionCount: result.keep._count.submissions,
    moved: result.moved,
    dropped: result.dropped,
  });
}
