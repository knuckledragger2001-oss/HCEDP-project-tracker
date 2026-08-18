import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { partnerCityLabel } from "@/lib/placer/schema";
import { todayUtc, addUtcDays } from "@/lib/placer/recurrence";
import type { NotificationKind } from "@prisma/client";

// ---------------------------------------------------------------------------
// In-app notifications — the bell in the top bar.
// ---------------------------------------------------------------------------
// Everything here is in-app only; nothing is emailed or pushed. Two ways a
// notification is written:
//
//   • immediately, when something is assigned (a ping, a Placer request handed
//     to someone, a planned request dropping into the queue);
//   • by the reminder sweep, which turns due dates into pings as they approach
//     and again once they pass.
//
// The sweep is deliberately not a cron job — this app has no scheduler. It runs
// on the cheap, indexed paths people already hit (the bell's poll, the Placer
// board, the planning calendar), and every notification it can write is deduped
// against what already exists, so running it a hundred times a day is harmless.

/** How many days ahead of a due date the first reminder fires. */
export const DUE_SOON_DAYS = 2;

/** How many notifications the bell shows at once. */
export const BELL_LIMIT = 30;

export interface NotificationInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  taskId?: string | null;
  placerRequestId?: string | null;
}

/**
 * Writes one notification. Never notifies a user about their own action — a
 * person who assigns themselves a task doesn't need to be told.
 */
export async function notify(
  input: NotificationInput,
  actorId?: string | null,
): Promise<void> {
  if (actorId && actorId === input.userId) return;
  await prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      taskId: input.taskId ?? null,
      placerRequestId: input.placerRequestId ?? null,
    },
  });
}

/** Unread count for the bell's badge. */
export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export interface BellNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

/** The most recent notifications for a user, newest first. */
export async function listNotifications(
  userId: string,
  limit = BELL_LIMIT,
): Promise<BellNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));
}

/**
 * Drops the due-date reminders for a task so the next sweep can raise them
 * again. Called when a task's due date moves or it is reopened — otherwise the
 * already-sent reminder would suppress the new one forever.
 */
export async function clearTaskReminders(taskId: string): Promise<void> {
  await prisma.notification.deleteMany({
    where: { taskId, kind: { in: ["TASK_DUE_SOON", "TASK_OVERDUE"] } },
  });
}

/** Same, for a Placer request whose needed-by date moved. */
export async function clearRequestReminders(placerRequestId: string): Promise<void> {
  await prisma.notification.deleteMany({
    where: {
      placerRequestId,
      kind: { in: ["REQUEST_DUE_SOON", "REQUEST_OVERDUE"] },
    },
  });
}

// Process-local throttle. Correctness never depends on it (every write below is
// deduped), it just keeps a busy page from re-running the sweep on every poll.
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Turns approaching and passed due dates into notifications: open pings, and
 * open Placer requests with an assignee and a needed-by date. Idempotent — a
 * given (kind, subject) pair is only ever written once, so it is safe to call
 * from any request path.
 */
export async function runReminderSweep(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  const today = todayUtc();
  const soon = addUtcDays(today, DUE_SOON_DAYS);

  await Promise.all([sweepTasks(today, soon), sweepRequests(today, soon)]);
}

async function sweepTasks(today: Date, soon: Date): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: "OPEN",
      dueDate: { not: null, lte: soon },
    },
    select: { id: true, title: true, dueDate: true, assignedToId: true },
  });
  if (tasks.length === 0) return;

  const already = await prisma.notification.findMany({
    where: {
      taskId: { in: tasks.map((t) => t.id) },
      kind: { in: ["TASK_DUE_SOON", "TASK_OVERDUE"] },
    },
    select: { taskId: true, kind: true },
  });
  const seen = new Set(already.map((n) => `${n.kind}:${n.taskId}`));

  const rows = tasks.flatMap((t) => {
    const due = t.dueDate!;
    const overdue = due < today;
    const kind: NotificationKind = overdue ? "TASK_OVERDUE" : "TASK_DUE_SOON";
    if (seen.has(`${kind}:${t.id}`)) return [];
    return [
      {
        userId: t.assignedToId,
        kind,
        title: overdue ? `Overdue: ${t.title}` : `Due soon: ${t.title}`,
        body: overdue
          ? `Was due ${formatDate(due)}.`
          : `Due ${formatDate(due)}.`,
        href: "/tasks",
        taskId: t.id,
      },
    ];
  });
  if (rows.length > 0) await prisma.notification.createMany({ data: rows });
}

async function sweepRequests(today: Date, soon: Date): Promise<void> {
  const requests = await prisma.placerRequest.findMany({
    where: {
      deletedAt: null,
      status: { in: ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"] },
      assignedToId: { not: null },
      neededByDate: { not: null, lte: soon },
    },
    select: {
      id: true,
      placeName: true,
      city: true,
      neededByDate: true,
      assignedToId: true,
    },
  });
  if (requests.length === 0) return;

  const already = await prisma.notification.findMany({
    where: {
      placerRequestId: { in: requests.map((r) => r.id) },
      kind: { in: ["REQUEST_DUE_SOON", "REQUEST_OVERDUE"] },
    },
    select: { placerRequestId: true, kind: true },
  });
  const seen = new Set(
    already.map((n) => `${n.kind}:${n.placerRequestId}`),
  );

  const rows = requests.flatMap((r) => {
    const due = r.neededByDate!;
    const overdue = due < today;
    const kind: NotificationKind = overdue
      ? "REQUEST_OVERDUE"
      : "REQUEST_DUE_SOON";
    if (seen.has(`${kind}:${r.id}`)) return [];
    return [
      {
        userId: r.assignedToId!,
        kind,
        title: overdue
          ? `Overdue request: ${r.placeName}`
          : `Request due soon: ${r.placeName}`,
        body: `${partnerCityLabel(r.city)} · needed ${formatDate(due)}.`,
        href: `/placer/${r.id}`,
        placerRequestId: r.id,
      },
    ];
  });
  if (rows.length > 0) await prisma.notification.createMany({ data: rows });
}
