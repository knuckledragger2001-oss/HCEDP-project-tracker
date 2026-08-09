import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth/session";
import PlacerBoard, {
  type QueueRequest,
  type StaffOption,
} from "@/components/placer/PlacerBoard";
import type { PartnerCityValue, RequestStatusValue } from "@/lib/placer/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Placer Requests — HCEDP Projects Tracker",
};

// Internal fulfillment queue: every partner city's Placer AI requests, as a
// drag-between-status board. Internal staff only.
export default async function PlacerQueuePage() {
  await requireInternal();

  const [requests, staff] = await Promise.all([
    prisma.placerRequest.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        city: true,
        placeName: true,
        reportType: true,
        reportTypeOther: true,
        dateRangeStart: true,
        dateRangeEnd: true,
        timeframeNote: true,
        status: true,
        assignedToId: true,
        neededByDate: true,
        createdAt: true,
        submittedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, disabledAt: null, role: { in: ["ADMIN", "USER"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  const data: QueueRequest[] = requests.map((r) => ({
    id: r.id,
    city: r.city as PartnerCityValue,
    placeName: r.placeName,
    reportType: r.reportType,
    reportTypeOther: r.reportTypeOther,
    dateRangeStart: r.dateRangeStart?.toISOString() ?? null,
    dateRangeEnd: r.dateRangeEnd?.toISOString() ?? null,
    timeframeNote: r.timeframeNote,
    status: r.status as RequestStatusValue,
    assignedToId: r.assignedToId,
    submittedByName: r.submittedBy?.name ?? r.submittedBy?.email ?? "—",
    neededByDate: r.neededByDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const staffOptions: StaffOption[] = staff.map((s) => ({
    id: s.id,
    label: s.name ?? s.email,
  }));

  const openCount = data.filter(
    (r) => r.status !== "COMPLETED" && r.status !== "DECLINED",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Placer AI Requests
          </h1>
          <p className="text-sm text-gray-500">
            {openCount} open · drag a card to change status, or open one to add
            notes and results.
          </p>
        </div>
      </div>
      <PlacerBoard initialRequests={data} staff={staffOptions} />
    </div>
  );
}
