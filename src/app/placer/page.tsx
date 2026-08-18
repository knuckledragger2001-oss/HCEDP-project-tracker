import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth/session";
import PlacerBoard, {
  type QueueRequest,
  type StaffOption,
} from "@/components/placer/PlacerBoard";
import type { CrmContact } from "@/components/placer/ArchiveRequestDialog";
import type { PartnerCityValue, RequestStatusValue } from "@/lib/placer/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Placer Requests — HCEDP Projects Tracker",
};

// How many remembered CRM contacts to offer as autofill suggestions. The
// handful of regular requestors easily fits; this is just a sane ceiling.
const CONTACT_SUGGESTION_LIMIT = 25;

// Internal fulfillment queue: every partner city's Placer AI requests, as a
// drag-between-status board. Internal staff only.
export default async function PlacerQueuePage() {
  const user = await requireInternal();

  const [requests, staff, contacts, me] = await Promise.all([
    prisma.placerRequest.findMany({
      // PLANNED requests live on the planning calendar (/placer/calendar), not
      // the fulfillment board — they haven't reached the queue yet.
      where: { deletedAt: null, status: { not: "PLANNED" } },
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
        purpose: true,
        status: true,
        assignedToId: true,
        neededByDate: true,
        createdAt: true,
        archivedAt: true,
        archiveContactName: true,
        submittedBy: { select: { name: true, email: true, role: true } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, disabledAt: null, role: { in: ["ADMIN", "USER"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.crmContact.findMany({
      orderBy: { lastUsedAt: "desc" },
      take: CONTACT_SUGGESTION_LIMIT,
      select: { name: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { ccPartner: { select: { email: true } } },
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
    purpose: r.purpose,
    status: r.status as RequestStatusValue,
    assignedToId: r.assignedToId,
    submittedByName: r.submittedBy?.name ?? r.submittedBy?.email ?? "—",
    // A partner login submitted this themselves → their own login is the real
    // city contact, so it's a strong "Archive to CRM" default (staff-logged
    // requests aren't, since the "submitter" there is just whoever typed it in).
    suggestedContact:
      r.submittedBy?.role === "PARTNER" && r.submittedBy.email
        ? { name: r.submittedBy.name ?? r.submittedBy.email, email: r.submittedBy.email }
        : null,
    neededByDate: r.neededByDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    archivedAt: r.archivedAt?.toISOString() ?? null,
    archiveContactName: r.archiveContactName,
  }));

  const staffOptions: StaffOption[] = staff.map((s) => ({
    id: s.id,
    label: s.name ?? s.email,
  }));

  const contactList: CrmContact[] = contacts;

  const openCount = data.filter(
    (r) => r.status !== "COMPLETED" && r.status !== "DECLINED",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Placer AI Requests
          </h1>
          <p className="text-sm text-muted">
            {openCount} open · drag a card to change status, or open one to add
            notes and results.
          </p>
        </div>
      </div>
      <PlacerBoard
        initialRequests={data}
        staff={staffOptions}
        contacts={contactList}
        defaultCcEmail={me?.ccPartner?.email ?? null}
      />
    </div>
  );
}
