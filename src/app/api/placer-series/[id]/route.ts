import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInternal } from "@/lib/auth/session";
import { requireInternalApi } from "@/lib/auth/api";
import { parseUtcDate } from "@/lib/placer/recurrence";
import { regenerateSeries } from "@/lib/placer/planning";
import { UpdateSeriesSchema } from "@/lib/placer/schema";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// PATCH /api/placer-series/[id] — edit a recurring plan. Pausing (active:
// false) just stops future generation; already-generated occurrences stay on
// the calendar untouched. Changing the pattern-affecting fields (lead time,
// end date) or reactivating regenerates future, unreleased occurrences so the
// calendar reflects the new pattern.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const { id } = await params;
  const existing = await prisma.placerRequestSeries.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Plan series not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateSeriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const data: Prisma.PlacerRequestSeriesUpdateInput = {};

  if (d.placeName !== undefined) data.placeName = d.placeName;
  if (d.purpose !== undefined) data.purpose = d.purpose;
  if (d.leadDays !== undefined) data.leadDays = d.leadDays;
  if (d.endDate !== undefined) data.endDate = parseUtcDate(d.endDate);
  if (d.active !== undefined) data.active = d.active;

  if (d.assignedToId !== undefined) {
    if (!d.assignedToId) {
      data.assignedTo = { disconnect: true };
    } else {
      const assignee = await prisma.user.findUnique({
        where: { id: d.assignedToId },
        select: { role: true, deletedAt: true, disabledAt: true },
      });
      if (
        !assignee ||
        assignee.deletedAt ||
        assignee.disabledAt ||
        !isInternal(assignee.role)
      ) {
        return NextResponse.json(
          { error: "The owner of a plan must be internal staff." },
          { status: 400 },
        );
      }
      data.assignedTo = { connect: { id: d.assignedToId } };
    }
  }

  await prisma.placerRequestSeries.update({ where: { id }, data });

  // Anything that changes the pattern going forward needs a rebuild of the
  // future, unreleased occurrences. A simple pause doesn't.
  const patternChanged =
    d.leadDays !== undefined || d.endDate !== undefined || d.assignedToId !== undefined;
  if (patternChanged || d.active === true) {
    await regenerateSeries(id);
  } else if (d.active === false) {
    // Nothing to regenerate — just stop generating.
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/placer-series/[id] — retire a recurring plan. Already-generated
// occurrences (planned or already released into the queue) are left standing;
// only future, unreleased ones are removed along with the pattern.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const { id } = await params;
  const existing = await prisma.placerRequestSeries.findUnique({
    where: { id },
    select: { deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Plan series not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.placerRequest.deleteMany({
      where: { seriesId: id, status: "PLANNED", releasedAt: null },
    }),
    prisma.placerRequestSeries.update({ where: { id }, data: { deletedAt: new Date(), active: false } }),
  ]);

  return NextResponse.json({ ok: true });
}
