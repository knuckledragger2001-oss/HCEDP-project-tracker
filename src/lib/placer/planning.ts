import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { notify, runReminderSweep } from "@/lib/notifications/notify";
import {
  PLAN_HORIZON_MONTHS,
  partnerCityLabel,
} from "@/lib/placer/schema";
import {
  addUtcDays,
  addUtcMonths,
  daysBetween,
  occurrencesBetween,
  startOfUtcDay,
  todayUtc,
  type RecurrencePattern,
} from "@/lib/placer/recurrence";
import type { PlacerRequestSeries, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Planning: turning recurring plans into dated occurrences, and dated
// occurrences into live queue entries.
// ---------------------------------------------------------------------------
// A planned request is an ordinary PlacerRequest with status PLANNED:
//
//   dateRangeStart  the event being measured (what the calendar draws)
//   queueOnDate     the day it should become a live, worked request
//   seriesId        set when a recurring plan generated it
//
// Two jobs keep that model true over time — materializeAllSeries() extends
// recurring plans out to the horizon, and releaseDuePlannedRequests() flips
// anything whose queue date has arrived into SUBMITTED. Neither needs a
// scheduler: syncPlacerSchedule() runs both (throttled, and idempotent either
// way) from the pages that care.

/** The recurrence pattern of a stored series, in the shape recurrence.ts wants. */
export function patternOf(series: PlacerRequestSeries): RecurrencePattern {
  return {
    frequency: series.frequency,
    interval: series.interval,
    mode: series.mode,
    dayOfMonth: series.dayOfMonth,
    weekday: series.weekday,
    weekOfMonth: series.weekOfMonth,
    startDate: series.startDate,
    endDate: series.endDate,
  };
}

/** How far out occurrences are generated. */
function horizon(): Date {
  return addUtcMonths(todayUtc(), PLAN_HORIZON_MONTHS);
}

/**
 * Creates the PLANNED requests a series still owes, up to the horizon. Safe to
 * call repeatedly: occurrences are unique per (series, occurrenceDate), so
 * anything already generated — including one a person has since edited, moved or
 * deleted — is left exactly as it is.
 */
export async function materializeSeries(
  series: PlacerRequestSeries,
  through: Date = horizon(),
): Promise<number> {
  if (!series.active || series.deletedAt) return 0;

  const dates = occurrencesBetween(patternOf(series), series.startDate, through);
  if (dates.length === 0) {
    await prisma.placerRequestSeries.update({
      where: { id: series.id },
      data: { generatedThrough: through },
    });
    return 0;
  }

  const rows: Prisma.PlacerRequestCreateManyInput[] = dates.map((occurrence) => ({
    city: series.city,
    submittedById: series.createdById,
    placeName: series.placeName,
    locationAddress: series.locationAddress,
    reportType: series.reportType,
    reportTypeOther: series.reportTypeOther,
    purpose: series.purpose,
    dateRangeStart: occurrence,
    status: "PLANNED" as const,
    queueOnDate: addUtcDays(occurrence, series.leadDays),
    assignedToId: series.assignedToId,
    seriesId: series.id,
    occurrenceDate: occurrence,
  }));

  // skipDuplicates leans on the (seriesId, occurrenceDate) unique index, so a
  // concurrent generator run can't double-create an occurrence.
  const created = await prisma.placerRequest.createMany({
    data: rows,
    skipDuplicates: true,
  });
  await prisma.placerRequestSeries.update({
    where: { id: series.id },
    data: { generatedThrough: through },
  });
  return created.count;
}

/** Extends every active recurring plan out to the horizon. */
export async function materializeAllSeries(): Promise<number> {
  const through = horizon();
  const all = await prisma.placerRequestSeries.findMany({
    where: { active: true, deletedAt: null },
  });
  let created = 0;
  for (const series of all) {
    created += await materializeSeries(series, through);
  }
  return created;
}

/**
 * Rebuilds a series' future occurrences after its pattern or lead time changed:
 * unreleased occurrences from today forward are dropped and regenerated.
 * Anything already in the queue (released) or in the past is left alone —
 * history doesn't get rewritten.
 */
export async function regenerateSeries(seriesId: string): Promise<void> {
  const series = await prisma.placerRequestSeries.findUnique({
    where: { id: seriesId },
  });
  if (!series || series.deletedAt) return;

  await prisma.placerRequest.deleteMany({
    where: {
      seriesId,
      status: "PLANNED",
      releasedAt: null,
      occurrenceDate: { gte: todayUtc() },
    },
  });
  await prisma.placerRequestSeries.update({
    where: { id: seriesId },
    data: { generatedThrough: null },
  });
  if (series.active) {
    await materializeSeries({ ...series, generatedThrough: null });
  }
}

/**
 * Moves every planned request whose queue date has arrived into the live queue
 * and pings whoever owns it. Idempotent twice over: the update only matches rows
 * still PLANNED, and the notification is skipped if this request has already
 * announced itself.
 */
export async function releaseDuePlannedRequests(): Promise<number> {
  const due = await prisma.placerRequest.findMany({
    where: {
      status: "PLANNED",
      deletedAt: null,
      queueOnDate: { not: null, lte: todayUtc() },
    },
    select: { id: true },
  });
  if (due.length === 0) return 0;

  let released = 0;
  for (const { id } of due) {
    if (await releaseOne(id)) released++;
  }
  return released;
}

/** Releases one planned request early, by hand, from the calendar. */
export async function releasePlan(id: string, actorId?: string): Promise<boolean> {
  return releaseOne(id, actorId);
}

async function releaseOne(id: string, actorId?: string): Promise<boolean> {
  const updated = await prisma.placerRequest.updateMany({
    where: { id, status: "PLANNED", deletedAt: null },
    data: { status: "SUBMITTED", releasedAt: new Date() },
  });
  if (updated.count === 0) return false;

  const request = await prisma.placerRequest.findUnique({
    where: { id },
    select: {
      id: true,
      placeName: true,
      city: true,
      assignedToId: true,
      submittedById: true,
      neededByDate: true,
      dateRangeStart: true,
    },
  });
  if (!request) return true;

  // Tell the person who will actually work it; failing an assignee, whoever
  // planned it. A manual release doesn't ping the person who clicked it.
  const owner = request.assignedToId ?? request.submittedById;
  const alreadyAnnounced = await prisma.notification.count({
    where: { placerRequestId: id, kind: "REQUEST_RELEASED" },
  });
  if (owner && alreadyAnnounced === 0) {
    await notify(
      {
        userId: owner,
        kind: "REQUEST_RELEASED",
        title: `Now in the queue: ${request.placeName}`,
        body: `${partnerCityLabel(request.city)}${
          request.dateRangeStart
            ? ` · event ${formatDate(request.dateRangeStart)}`
            : ""
        }. A planned request reached its queue date.`,
        href: `/placer/${id}`,
        placerRequestId: id,
      },
      actorId,
    );
  }
  return true;
}

// Process-local throttle, same contract as the reminder sweep: skipping a run is
// always safe because both jobs are idempotent and date-driven.
let lastSyncAt = 0;
const SYNC_INTERVAL_MS = 60_000;

/**
 * The one call the Placer surfaces make on load: extend recurring plans, release
 * anything due, and raise due-date reminders. Cheap (all indexed), throttled,
 * and safe to call from anywhere.
 */
export async function syncPlacerSchedule(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) {
    await runReminderSweep();
    return;
  }
  lastSyncAt = now;
  await materializeAllSeries();
  await releaseDuePlannedRequests();
  await runReminderSweep(force);
}

/**
 * The queue date implied by an event date and a lead time, e.g. a parade on the
 * 6th with the default 7-day lead queues on the 13th.
 */
export function queueDateFor(eventDate: Date, leadDays: number): Date {
  return addUtcDays(startOfUtcDay(eventDate), leadDays);
}

/** Lead days implied by an existing event/queue date pair, for editing. */
export function leadDaysBetween(eventDate: Date, queueOnDate: Date): number {
  return daysBetween(eventDate, queueOnDate);
}
