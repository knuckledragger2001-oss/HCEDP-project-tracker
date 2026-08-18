import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalApi } from "@/lib/auth/api";
import { ArchiveTaskSchema } from "@/lib/tasks/schema";

export const runtime = "nodejs";

// POST /api/tasks/[id]/archive — record that a completed task's correspondence
// was emailed to the CRM archive address, and remember the contact for next
// time (see TaskContact). The actual email is composed and sent client-side via
// a mailto link (ArchiveTaskDialog) — this just logs it and updates the shared
// contact list; it never sends mail itself.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const { id } = await params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  if (existing.status !== "DONE") {
    return NextResponse.json(
      { error: "Only a completed task can be archived to the CRM." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ArchiveTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid contact", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const { contactName, contactEmail } = parsed.data;

  const [updated, contact] = await prisma.$transaction([
    prisma.task.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archiveContactName: contactName,
        archiveContactEmail: contactEmail,
      },
      select: { id: true, archivedAt: true, archiveContactName: true, archiveContactEmail: true },
    }),
    prisma.taskContact.upsert({
      where: { email: contactEmail },
      update: { name: contactName, useCount: { increment: 1 }, lastUsedAt: new Date() },
      create: { name: contactName, email: contactEmail },
    }),
  ]);

  return NextResponse.json({
    task: {
      id: updated.id,
      archivedAt: updated.archivedAt!.toISOString(),
      archiveContactName: updated.archiveContactName,
      archiveContactEmail: updated.archiveContactEmail,
    },
    contact: { name: contact.name, email: contact.email },
  });
}
