import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth/session";
import TasksView, { type TaskRow } from "@/components/tasks/TasksView";
import type { TaskContact } from "@/components/tasks/ArchiveTaskDialog";
import type { StaffOption } from "@/components/placer/PlacerBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Tasks — HCEDP Projects Tracker",
};

// How many remembered CRM contacts to offer as autofill suggestions. The
// handful of regular requestors easily fits; this is just a sane ceiling.
const CONTACT_SUGGESTION_LIMIT = 25;

// Tasks assigned to or raised by the signed-in user. Two lists, one page —
// what's on my plate, and what I've asked others to do.
export default async function TasksPage() {
  const user = await requireInternal();

  const [assignedToMe, createdByMe, staff, contacts, me] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: user.id, deletedAt: null },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { name: true, email: true } },
        placerRequest: { select: { id: true, placeName: true } },
      },
    }),
    prisma.task.findMany({
      where: { createdById: user.id, deletedAt: null, NOT: { assignedToId: user.id } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignedTo: { select: { name: true, email: true } },
        placerRequest: { select: { id: true, placeName: true } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, disabledAt: null, role: { in: ["ADMIN", "USER"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.taskContact.findMany({
      orderBy: { lastUsedAt: "desc" },
      take: CONTACT_SUGGESTION_LIMIT,
      select: { name: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { ccPartner: { select: { email: true } } },
    }),
  ]);

  const toRow = (t: (typeof assignedToMe)[number] | (typeof createdByMe)[number]): TaskRow => ({
    id: t.id,
    title: t.title,
    details: t.details,
    dueDate: t.dueDate?.toISOString() ?? null,
    status: t.status,
    priority: t.priority,
    assignedToId: t.assignedToId,
    assignedToName:
      "assignedTo" in t ? (t.assignedTo?.name ?? t.assignedTo?.email ?? "—") : (user.name ?? user.email),
    createdById: t.createdById,
    createdByName:
      "createdBy" in t ? (t.createdBy?.name ?? t.createdBy?.email ?? "—") : (user.name ?? user.email),
    placerRequestId: t.placerRequestId,
    placerRequestName: t.placerRequest?.placeName ?? null,
    createdAt: t.createdAt.toISOString(),
    archivedAt: t.archivedAt?.toISOString() ?? null,
    archiveContactName: t.archiveContactName,
  });

  const staffOptions: StaffOption[] = staff.map((s) => ({
    id: s.id,
    label: s.name ?? s.email,
  }));

  const contactList: TaskContact[] = contacts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Tasks</h1>
        <p className="mt-1 text-sm text-muted">
          Tasks assigned to you, and tasks you&apos;ve assigned to others.
        </p>
      </div>
      <TasksView
        currentUserId={user.id}
        assignedToMe={assignedToMe.map(toRow)}
        createdByMe={createdByMe.map(toRow)}
        staff={staffOptions}
        contacts={contactList}
        defaultCcEmail={me?.ccPartner?.email ?? null}
      />
    </div>
  );
}
