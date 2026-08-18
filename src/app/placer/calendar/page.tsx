import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth/session";
import { syncPlacerSchedule } from "@/lib/placer/planning";
import { describeRecurrence } from "@/lib/placer/recurrence";
import { patternOf } from "@/lib/placer/planning";
import PlacerCalendar, {
  type CalendarPlan,
  type SeriesSummary,
} from "@/components/placer/calendar/PlacerCalendar";
import type { StaffOption } from "@/components/placer/PlacerBoard";
import type { PartnerCityValue } from "@/lib/placer/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Placer Planning Calendar — HCEDP",
};

// Planning calendar: future Placer AI requests a partner has told us are
// coming, before they're worked. A plan sits here — one-off or generated from a
// recurring series — until its queue date arrives, when it drops into the
// fulfillment board at /placer automatically (see syncPlacerSchedule).
export default async function PlacerCalendarPage() {
  await requireInternal();

  // Extend recurring plans and release anything now due before rendering, so
  // the calendar and the board never show stale state to whoever looks first.
  await syncPlacerSchedule();

  const [plans, series, staff] = await Promise.all([
    prisma.placerRequest.findMany({
      where: { status: "PLANNED", deletedAt: null },
      orderBy: [{ dateRangeStart: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        city: true,
        placeName: true,
        locationAddress: true,
        reportType: true,
        reportTypeOther: true,
        purpose: true,
        dateRangeStart: true,
        dateRangeEnd: true,
        queueOnDate: true,
        assignedToId: true,
        seriesId: true,
        assignedTo: { select: { name: true, email: true } },
      },
    }),
    prisma.placerRequestSeries.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { name: true, email: true } },
        _count: { select: { requests: true } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, disabledAt: null, role: { in: ["ADMIN", "USER"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  const calendarPlans: CalendarPlan[] = plans.map((p) => ({
    id: p.id,
    city: p.city as PartnerCityValue,
    placeName: p.placeName,
    locationAddress: p.locationAddress,
    reportType: p.reportType,
    reportTypeOther: p.reportTypeOther,
    purpose: p.purpose,
    eventDate: p.dateRangeStart?.toISOString() ?? null,
    eventEndDate: p.dateRangeEnd?.toISOString() ?? null,
    queueOnDate: p.queueOnDate?.toISOString() ?? null,
    assignedToId: p.assignedToId,
    assignedToName: p.assignedTo?.name ?? p.assignedTo?.email ?? null,
    seriesId: p.seriesId,
  }));

  const seriesSummaries: SeriesSummary[] = series.map((s) => ({
    id: s.id,
    city: s.city as PartnerCityValue,
    placeName: s.placeName,
    reportType: s.reportType,
    active: s.active,
    leadDays: s.leadDays,
    assignedToId: s.assignedToId,
    assignedToName: s.assignedTo?.name ?? s.assignedTo?.email ?? null,
    description: describeRecurrence(patternOf(s)),
    occurrenceCount: s._count.requests,
  }));

  const staffOptions: StaffOption[] = staff.map((s) => ({
    id: s.id,
    label: s.name ?? s.email,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Placer Planning Calendar
        </h1>
        <p className="mt-1 text-sm text-muted">
          Drop a future request onto the date it should join the queue, or set
          it up to repeat. It becomes a live request automatically when its
          queue date arrives.
        </p>
      </div>
      <PlacerCalendar
        initialPlans={calendarPlans}
        initialSeries={seriesSummaries}
        staff={staffOptions}
      />
    </div>
  );
}
