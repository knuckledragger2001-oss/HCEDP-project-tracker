import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInternal } from "@/lib/auth/session";
import { requireInternalApi } from "@/lib/auth/api";
import { notify } from "@/lib/notifications/notify";
import { formatDate } from "@/lib/format";
import { parseUtcDate } from "@/lib/placer/recurrence";
import { materializeSeries, queueDateFor } from "@/lib/placer/planning";
import { CreatePlanSchema, partnerCityLabel } from "@/lib/placer/schema";

export const runtime = "nodejs";

// POST /api/placer-plans — put a future Placer AI request on the planning
// calendar. Internal staff only. Two shapes:
//
//   • one-off: creates a single PLANNED PlacerRequest, dated on the calendar by
//     eventDate and destined for the live queue on queueOnDate;
//   • recurring: creates a PlacerRequestSeries (the pattern) and immediately
//     materializes its occurrences out to the planning horizon.
export async function POST(req: NextRequest) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;
  const user = gate.user;

  const body = await req.json().catch(() => null);
  const parsed = CreatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  if (d.assignedToId) {
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
  }

  const eventDate = parseUtcDate(d.eventDate);

  // Recurring: create the series and generate its first batch of occurrences.
  if (d.recurrence) {
    if (!eventDate) {
      return NextResponse.json(
        { error: "A repeating plan needs a first date." },
        { status: 400 },
      );
    }
    const r = d.recurrence;
    const series = await prisma.placerRequestSeries.create({
      data: {
        city: d.city,
        placeName: d.placeName,
        locationAddress: d.locationAddress ?? null,
        reportType: d.reportType,
        reportTypeOther: d.reportType === "OTHER" ? d.reportTypeOther ?? null : null,
        purpose: d.purpose ?? null,
        frequency: r.frequency,
        interval: r.interval,
        mode: r.mode,
        dayOfMonth: r.mode === "DAY_OF_MONTH" ? r.dayOfMonth ?? eventDate.getUTCDate() : null,
        weekday: r.mode === "NTH_WEEKDAY" || r.frequency === "WEEKLY"
          ? r.weekday ?? eventDate.getUTCDay()
          : null,
        weekOfMonth: r.mode === "NTH_WEEKDAY" ? r.weekOfMonth ?? 1 : null,
        startDate: eventDate,
        endDate: parseUtcDate(r.endDate),
        leadDays: d.leadDays,
        assignedToId: d.assignedToId || null,
        createdById: user.id,
      },
    });
    const created = await materializeSeries(series);

    if (d.assignedToId) {
      await notify(
        {
          userId: d.assignedToId,
          kind: "REQUEST_ASSIGNED",
          title: `New recurring plan: ${series.placeName}`,
          body: `${partnerCityLabel(series.city)} · you're the standing owner of each occurrence as it's generated.`,
          href: "/placer/calendar",
        },
        user.id,
      );
    }

    return NextResponse.json(
      { seriesId: series.id, occurrencesCreated: created },
      { status: 201 },
    );
  }

  // One-off plan.
  const queueOnDate = d.queueOnDate
    ? parseUtcDate(d.queueOnDate)
    : eventDate
      ? queueDateFor(eventDate, d.leadDays)
      : null;

  const created = await prisma.placerRequest.create({
    data: {
      city: d.city,
      submittedById: user.id,
      placeName: d.placeName,
      locationAddress: d.locationAddress ?? null,
      reportType: d.reportType,
      reportTypeOther: d.reportType === "OTHER" ? d.reportTypeOther ?? null : null,
      purpose: d.purpose ?? null,
      internalNotes: d.internalNotes ?? null,
      dateRangeStart: eventDate,
      dateRangeEnd: parseUtcDate(d.eventEndDate),
      status: "PLANNED",
      queueOnDate,
      assignedToId: d.assignedToId || null,
    },
    select: {
      id: true,
      city: true,
      placeName: true,
      reportType: true,
      reportTypeOther: true,
      dateRangeStart: true,
      dateRangeEnd: true,
      status: true,
      queueOnDate: true,
      assignedToId: true,
      createdAt: true,
    },
  });

  if (d.assignedToId) {
    await notify(
      {
        userId: d.assignedToId,
        kind: "REQUEST_ASSIGNED",
        title: `Planned for you: ${created.placeName}`,
        body: `${partnerCityLabel(created.city)}${
          eventDate ? ` · event ${formatDate(eventDate)}` : ""
        }${queueOnDate ? ` · queues ${formatDate(queueOnDate)}` : ""}`,
        href: "/placer/calendar",
        placerRequestId: created.id,
      },
      user.id,
    );
  }

  return NextResponse.json({ plan: created }, { status: 201 });
}
