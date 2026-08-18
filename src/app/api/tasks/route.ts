import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isInternal } from "@/lib/auth/session";
import { requireInternalApi } from "@/lib/auth/api";
import { notify } from "@/lib/notifications/notify";
import { formatDate } from "@/lib/format";
import { parseUtcDate } from "@/lib/placer/recurrence";
import { CreateTaskSchema } from "@/lib/tasks/schema";

export const runtime = "nodejs";

// POST /api/tasks — create a task assigned to a teammate. The assignee is
// notified immediately (unless they assigned it to themselves), and again by
// the reminder sweep as the due date approaches and once it passes.
export async function POST(req: NextRequest) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;
  const user = gate.user;

  const body = await req.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const assignee = await prisma.user.findUnique({
    where: { id: d.assignedToId },
    select: { id: true, name: true, email: true, role: true, deletedAt: true, disabledAt: true },
  });
  if (
    !assignee ||
    assignee.deletedAt ||
    assignee.disabledAt ||
    !isInternal(assignee.role)
  ) {
    return NextResponse.json(
      { error: "Tasks can only be assigned to internal staff." },
      { status: 400 },
    );
  }

  // A task can hang off a Placer request; anything else stands on its own.
  let placerRequestId: string | null = null;
  if (d.placerRequestId) {
    const request = await prisma.placerRequest.findUnique({
      where: { id: d.placerRequestId },
      select: { id: true, deletedAt: true },
    });
    if (!request || request.deletedAt) {
      return NextResponse.json({ error: "Request not found." }, { status: 400 });
    }
    placerRequestId = request.id;
  }

  const dueDate = parseUtcDate(d.dueDate);

  const task = await prisma.task.create({
    data: {
      title: d.title,
      details: d.details ?? null,
      dueDate,
      priority: d.priority,
      assignedToId: assignee.id,
      createdById: user.id,
      placerRequestId,
    },
    select: {
      id: true,
      title: true,
      details: true,
      dueDate: true,
      status: true,
      priority: true,
      assignedToId: true,
      createdById: true,
      placerRequestId: true,
      createdAt: true,
    },
  });

  await notify(
    {
      userId: assignee.id,
      kind: "TASK_ASSIGNED",
      title: `${user.name ?? user.email} assigned you: ${task.title}`,
      body: dueDate ? `Due ${formatDate(dueDate)}.` : null,
      href: "/tasks",
      taskId: task.id,
    },
    user.id,
  );

  return NextResponse.json(
    {
      task: {
        ...task,
        dueDate: task.dueDate?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        assignedToName: assignee.name ?? assignee.email,
        createdByName: user.name ?? user.email,
        placerRequestName: null,
      },
    },
    { status: 201 },
  );
}
