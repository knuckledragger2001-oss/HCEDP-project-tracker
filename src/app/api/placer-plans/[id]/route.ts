import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInternal } from "@/lib/auth/session";
import { requireInternalApi } from "@/lib/auth/api";
import { notify, clearRequestReminders } from "@/lib/notifications/notify";
import { formatDate } from "@/lib/format";
import { parseUtcDate, daysBetween } from "@/lib/placer/recurrence";
import { releasePlan } from "@/lib/placer/planning";
import { UpdatePlanSchema, partnerCityLabel } from "@/lib/placer/schema";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// PATCH /api/placer-plans/[id] — edit a single planned occurrence, drag it to a
// new date on the calendar, or release it into the queue early.
//
// Dragging an event to a new day sends only { eventDate }: the request's
// queueOnDate shifts by the same number of days, so the lead time the planner
// chose (e.g. "7 days after the event") is preserved rather than reset.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;
  const user = gate.user;

  const { id } = await params;
  const existing = await prisma.placerRequest.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }
  if (existing.status !== "PLANNED") {
    return NextResponse.json(
      { error: "This request is already in the queue." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Release: flip straight to SUBMITTED and stop — nothing else in the body
  // matters once that happens.
  if (d.release) {
    const ok = await releasePlan(id, user.id);
    if (!ok) {
      return NextResponse.json({ error: "Could not release this plan." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, released: true });
  }

  const data: Prisma.PlacerRequestUpdateInput = {};
  if (d.placeName !== undefined) data.placeName = d.placeName;
  if (d.locationAddress !== undefined) data.locationAddress = d.locationAddress;
  if (d.reportType !== undefined) data.reportType = d.reportType;
  if (d.reportTypeOther !== undefined) data.reportTypeOther = d.reportTypeOther;
  if (d.purpose !== undefined) data.purpose = d.purpose;
  if (d.internalNotes !== undefined) data.internalNotes = d.internalNotes;
  if (d.eventEndDate !== undefined) data.dateRangeEnd = parseUtcDate(d.eventEndDate);
  if (d.neededByDate !== undefined) data.neededByDate = parseUtcDate(d.neededByDate);

  // Moving the event date carries queueOnDate along by the same offset, unless
  // the caller also sent an explicit new queueOnDate.
  if (d.eventDate !== undefined) {
    const nextEvent = parseUtcDate(d.eventDate);
    data.dateRangeStart = nextEvent;
    if (d.queueOnDate === undefined && nextEvent && existing.dateRangeStart && existing.queueOnDate) {
      const shift = daysBetween(existing.dateRangeStart, nextEvent);
      data.queueOnDate = new Date(existing.queueOnDate.getTime() + shift * 86_400_000);
    }
  }
  if (d.queueOnDate !== undefined) data.queueOnDate = parseUtcDate(d.queueOnDate);

  let reassignedTo: string | null = null;
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
      reassignedTo = d.assignedToId;
    }
  }

  const updated = await prisma.placerRequest.update({
    where: { id },
    data,
    select: {
      id: true,
      placeName: true,
      city: true,
      dateRangeStart: true,
      dateRangeEnd: true,
      queueOnDate: true,
      assignedToId: true,
    },
  });

  if (d.neededByDate !== undefined) await clearRequestReminders(id);

  if (reassignedTo && reassignedTo !== existing.assignedToId) {
    await notify(
      {
        userId: reassignedTo,
        kind: "REQUEST_ASSIGNED",
        title: `Planned for you: ${updated.placeName}`,
        body: `${partnerCityLabel(updated.city)}${
          updated.dateRangeStart ? ` · event ${formatDate(updated.dateRangeStart)}` : ""
        }${updated.queueOnDate ? ` · queues ${formatDate(updated.queueOnDate)}` : ""}`,
        href: "/placer/calendar",
        placerRequestId: id,
      },
      user.id,
    );
  }

  return NextResponse.json({
    plan: {
      ...updated,
      dateRangeStart: updated.dateRangeStart?.toISOString() ?? null,
      dateRangeEnd: updated.dateRangeEnd?.toISOString() ?? null,
      queueOnDate: updated.queueOnDate?.toISOString() ?? null,
    },
  });
}

// DELETE /api/placer-plans/[id] — remove a planned occurrence from the
// calendar. If it belongs to a series, only this one occurrence is removed; the
// series keeps generating future ones.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const { id } = await params;
  const existing = await prisma.placerRequest.findUnique({
    where: { id },
    select: { status: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }
  if (existing.status !== "PLANNED") {
    return NextResponse.json(
      { error: "This request is already in the queue." },
      { status: 400 },
    );
  }

  await prisma.placerRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
