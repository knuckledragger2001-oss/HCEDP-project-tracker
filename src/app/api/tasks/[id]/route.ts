import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInternal } from "@/lib/auth/session";
import { requireInternalApi } from "@/lib/auth/api";
import { notify, clearTaskReminders } from "@/lib/notifications/notify";
import { formatDate } from "@/lib/format";
import { parseUtcDate } from "@/lib/placer/recurrence";
import { UpdateTaskSchema } from "@/lib/tasks/schema";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// PATCH /api/tasks/[id] — tick a ping off, reassign it, or edit it. Both the
// assignee and the person who raised it can change a ping; nobody else needs to.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;
  const user = gate.user;

  const { id } = await params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ping not found." }, { status: 404 });
  }
  if (existing.assignedToId !== user.id && existing.createdById !== user.id) {
    return NextResponse.json(
      { error: "Only the assignee or the person who sent this ping can change it." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);

  // Undo a soft delete (the "Undo" action on the delete toast).
  if (body && body.restore === true) {
    await prisma.task.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ ok: true });
  }
  if (existing.deletedAt) {
    return NextResponse.json({ error: "Ping not found." }, { status: 404 });
  }

  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const data: Prisma.TaskUpdateInput = {};

  if (d.title !== undefined) data.title = d.title;
  if (d.details !== undefined) data.details = d.details;
  if (d.priority !== undefined) data.priority = d.priority;

  // A moved due date resets the reminders, so the new date gets its own pings.
  let dueDateMoved = false;
  if (d.dueDate !== undefined) {
    const next = parseUtcDate(d.dueDate);
    dueDateMoved = next?.getTime() !== existing.dueDate?.getTime();
    data.dueDate = next;
  }

  if (d.status !== undefined) {
    data.status = d.status;
    data.completedAt = d.status === "DONE" ? new Date() : null;
    // Reopening a ping should start its reminders over.
    if (d.status === "OPEN") dueDateMoved = true;
  }

  let reassignedTo: string | null = null;
  if (d.assignedToId !== undefined && d.assignedToId !== existing.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: d.assignedToId },
      select: { id: true, role: true, deletedAt: true, disabledAt: true },
    });
    if (
      !assignee ||
      assignee.deletedAt ||
      assignee.disabledAt ||
      !isInternal(assignee.role)
    ) {
      return NextResponse.json(
        { error: "Pings can only go to internal staff." },
        { status: 400 },
      );
    }
    data.assignedTo = { connect: { id: assignee.id } };
    reassignedTo = assignee.id;
    dueDateMoved = true;
  }

  const updated = await prisma.task.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      priority: true,
      assignedToId: true,
      completedAt: true,
    },
  });

  if (dueDateMoved) await clearTaskReminders(id);

  if (reassignedTo) {
    await notify(
      {
        userId: reassignedTo,
        kind: "TASK_ASSIGNED",
        title: `${user.name ?? user.email} pinged you: ${updated.title}`,
        body: updated.dueDate ? `Due ${formatDate(updated.dueDate)}.` : null,
        href: "/tasks",
        taskId: id,
      },
      user.id,
    );
  }

  // Tell whoever raised the ping that it's done — that's the whole point of
  // having asked someone.
  if (d.status === "DONE" && existing.status !== "DONE") {
    await notify(
      {
        userId: existing.createdById,
        kind: "TASK_COMPLETED",
        title: `Done: ${updated.title}`,
        body: `${user.name ?? user.email} completed the ping you sent.`,
        href: "/tasks",
        taskId: id,
      },
      user.id,
    );
  }

  return NextResponse.json({
    task: {
      ...updated,
      dueDate: updated.dueDate?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
    },
  });
}

// DELETE /api/tasks/[id] — soft delete, same restore-from-toast contract as the
// rest of the app. Only the person who sent the ping can withdraw it.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const { id } = await params;
  const existing = await prisma.task.findUnique({
    where: { id },
    select: { createdById: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Ping not found." }, { status: 404 });
  }
  if (existing.createdById !== gate.user.id) {
    return NextResponse.json(
      { error: "Only the person who sent this ping can delete it." },
      { status: 403 },
    );
  }

  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
