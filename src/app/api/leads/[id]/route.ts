import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  UpdateLeadSchema,
  LEAD_STAGES_REQUIRING_REASON,
  LEAD_STAGE_CONVERTED,
  NAME_REQUIRED_MESSAGE,
  hasUsableName,
} from "@/lib/leads/schema";
import { normalizeLocation } from "@/lib/location/normalize";

export const runtime = "nodejs";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  // Undo a soft delete (the "Undo" action on the delete toast).
  if (body && body.restore === true) {
    await prisma.lead.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ ok: true });
  }

  const parsed = UpdateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // CONVERTED means "a project exists for this lead", which only the convert
  // endpoint can make true. Accepting it here would leave a lead claiming a
  // conversion that never produced a project.
  if (d.stage === LEAD_STAGE_CONVERTED) {
    return NextResponse.json(
      { error: "Use the Convert action to move a lead to Converted." },
      { status: 400 },
    );
  }

  const existing = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    select: {
      stage: true,
      deadReason: true,
      convertedProjectId: true,
      codename: true,
      companyName: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // A converted lead is a historical record: editing it would silently diverge
  // from the project it created.
  if (existing.convertedProjectId) {
    return NextResponse.json(
      { error: "This lead has been converted and can no longer be edited." },
      { status: 409 },
    );
  }

  // A PATCH may clear the codename, but only if the row keeps a company name to
  // be known by (and vice versa). Check the merged result, not the request.
  const merged = {
    codename: d.codename !== undefined ? d.codename : existing.codename,
    companyName: d.companyName !== undefined ? d.companyName : existing.companyName,
  };
  if (!hasUsableName(merged)) {
    return NextResponse.json({ error: NAME_REQUIRED_MESSAGE }, { status: 400 });
  }

  // Entering DEAD requires a reason. Accept one already on the row (a stage-only
  // PATCH re-entering DEAD) or one supplied in this request.
  if (d.stage && LEAD_STAGES_REQUIRING_REASON.includes(d.stage)) {
    const reason = (d.deadReason ?? existing.deadReason)?.trim();
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to mark a lead dead." },
        { status: 400 },
      );
    }
  }

  const data: Record<string, unknown> = {};

  for (const key of [
    "stage",
    "leadSource",
    "estimatedCapex",
    "estimatedJobs",
    "minAcreage",
    "minBuildingSqFt",
  ] as const) {
    if (d[key] !== undefined) data[key] = d[key];
  }

  // Empty strings from the form mean "cleared", not "unchanged". Trim first, so
  // a field holding only spaces clears rather than passing the name check.
  for (const key of [
    "codename",
    "companyName",
    "leadSourceOther",
    "contactName",
    "contactEmail",
    "contactPhone",
    "naicsCode",
    "industryDescription",
    "notes",
    "deadReason",
  ] as const) {
    if (d[key] !== undefined) data[key] = d[key]?.trim() || null;
  }

  if (d.nextFollowUpDate !== undefined) {
    data.nextFollowUpDate = toDate(d.nextFollowUpDate);
  }

  // Re-normalize whenever the raw location changes, so city/state/country never
  // drift from the text they were derived from.
  if (d.companyLocationRaw !== undefined) {
    const raw = d.companyLocationRaw?.trim() || null;
    const loc = raw
      ? normalizeLocation(raw)
      : { city: null, state: null, country: null };
    data.companyLocationRaw = raw;
    data.companyCity = loc.city;
    data.companyState = loc.state;
    data.companyCountry = loc.country;
  }

  const lead = await prisma.lead.update({ where: { id }, data });
  return NextResponse.json({ lead });
}

// Soft delete — hidden from the board, but the row remains so the delete can be
// undone from the toast that appears immediately after.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
