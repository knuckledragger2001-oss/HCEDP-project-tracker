import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalApi } from "@/lib/auth/api";
import { ArchiveRequestSchema } from "@/lib/placer/schema";

export const runtime = "nodejs";

// POST /api/placer-requests/[id]/archive — record that a completed request's
// correspondence was emailed to the CRM archive address, and remember the
// contact for next time (see CrmContact). The actual email is composed and
// sent client-side via a mailto link (ArchiveRequestDialog) — this just logs
// it and updates the shared contact list; it never sends mail itself.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const { id } = await params;
  const existing = await prisma.placerRequest.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (existing.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Only a completed request can be archived to the CRM." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ArchiveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid contact", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const { contactName, contactEmail } = parsed.data;

  const [updated, contact] = await prisma.$transaction([
    prisma.placerRequest.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archiveContactName: contactName,
        archiveContactEmail: contactEmail,
      },
      select: { id: true, archivedAt: true, archiveContactName: true, archiveContactEmail: true },
    }),
    prisma.crmContact.upsert({
      where: { email: contactEmail },
      update: { name: contactName, useCount: { increment: 1 }, lastUsedAt: new Date() },
      create: { name: contactName, email: contactEmail },
    }),
  ]);

  return NextResponse.json({
    request: {
      id: updated.id,
      archivedAt: updated.archivedAt!.toISOString(),
      archiveContactName: updated.archiveContactName,
      archiveContactEmail: updated.archiveContactEmail,
    },
    contact: { name: contact.name, email: contact.email },
  });
}
