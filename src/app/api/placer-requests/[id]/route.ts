import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isInternal } from "@/lib/auth/session";
import {
  UpdatePlacerRequestSchema,
  STATUSES_REQUIRING_REASON,
  type RequestStatusValue,
} from "@/lib/placer/schema";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Every mutation here is internal-only: partners submit and read, staff triage.
async function requireInternalApi() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!isInternal(user.role)) {
    return { error: NextResponse.json({ error: "Staff only." }, { status: 403 }) };
  }
  return { user };
}

// PATCH /api/placer-requests/[id] — internal triage: status, assignee, notes,
// result. Any subset of fields; the board sends just { status }.
export async function PATCH(
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

  const body = await req.json().catch(() => null);
  const parsed = UpdatePlacerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const data: Prisma.PlacerRequestUpdateInput = {};

  // Notes baseline: a direct edit (detail page) if the caller sent one, else the
  // current value. A decline reason is appended onto whichever that is, so a
  // simultaneous notes edit + decline never loses the edit.
  const notesBase =
    d.internalNotes !== undefined ? d.internalNotes : existing.internalNotes;
  let notesResult = d.internalNotes !== undefined ? d.internalNotes : undefined;

  if (d.status !== undefined) {
    const status = d.status as RequestStatusValue;
    // Moving to a status that requires a reason (DECLINED) must carry one; it's
    // appended to the internal notes so the "why" is preserved on the record.
    if (STATUSES_REQUIRING_REASON.includes(status)) {
      const reason = d.statusReason?.trim();
      if (!reason) {
        return NextResponse.json(
          { error: "A reason is required to decline a request." },
          { status: 400 },
        );
      }
      const stamped = `Declined: ${reason}`;
      notesResult = notesBase ? `${notesBase}\n${stamped}` : stamped;
    }
    data.status = status;
    // COMPLETED stamps a completion time; leaving it clears it.
    data.completedAt = status === "COMPLETED" ? new Date() : null;
  }

  if (notesResult !== undefined) data.internalNotes = notesResult;

  if (d.assignedToId !== undefined) {
    if (d.assignedToId === null || d.assignedToId === "") {
      data.assignedTo = { disconnect: true };
    } else {
      const assignee = await prisma.user.findUnique({
        where: { id: d.assignedToId },
        select: { role: true, deletedAt: true },
      });
      if (!assignee || assignee.deletedAt || !isInternal(assignee.role as "ADMIN" | "USER" | "PARTNER")) {
        return NextResponse.json(
          { error: "Assignee must be an internal staff member." },
          { status: 400 },
        );
      }
      data.assignedTo = { connect: { id: d.assignedToId } };
    }
  }

  if (d.resultNote !== undefined) data.resultNote = d.resultNote;

  const updated = await prisma.placerRequest.update({
    where: { id },
    data,
    select: { id: true, status: true, assignedToId: true },
  });
  return NextResponse.json({ request: updated });
}

// DELETE /api/placer-requests/[id] — soft delete (restore-from-toast contract).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const { id } = await params;
  await prisma.placerRequest.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
