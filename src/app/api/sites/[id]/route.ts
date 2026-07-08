import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RealEstateTypeEnum = z.enum([
  "INDUSTRIAL_GREENFIELD",
  "BROWNFIELD",
  "SPEC_INDUSTRIAL",
  "MIXED_USE",
  "OFFICE",
]);
const CountyEnum = z.enum(["HAYS", "CALDWELL", "TRAVIS"]);

// Every field editable from the Sites page. All optional — a PATCH only sends
// what changed. Community is nullable (a site can be outside any city limits).
const UpdateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  communityId: z.string().nullable().optional(),
  acreage: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  realEstateType: RealEstateTypeEnum.nullable().optional(),
  county: CountyEnum.nullable().optional(),
  squareFeet: z.number().nullable().optional(),
  pricePerSqFt: z.number().nullable().optional(),
  currentElectricMw: z.number().nullable().optional(),
  projectedElectricMw: z.number().nullable().optional(),
  electricProviderId: z.string().nullable().optional(),
  waterProviderId: z.string().nullable().optional(),
  sewerProviderId: z.string().nullable().optional(),
  gasProviderId: z.string().nullable().optional(),
});

const SITE_INCLUDE = {
  community: true,
  electricProvider: true,
  waterProvider: true,
  sewerProvider: true,
  gasProvider: true,
  _count: { select: { submissions: true } },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  // Undo a soft delete (the "Undo" action on the delete toast).
  if (body && body.restore === true) {
    await prisma.site.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ ok: true });
  }

  const parsed = UpdateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid site", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Normalize empty provider/community ids to null; trim the name if present.
  const data: Record<string, unknown> = { ...d };
  if (d.name !== undefined) data.name = d.name.trim();
  for (const k of [
    "communityId",
    "electricProviderId",
    "waterProviderId",
    "sewerProviderId",
    "gasProviderId",
  ] as const) {
    if (d[k] !== undefined) data[k] = d[k] || null;
  }

  const site = await prisma.site.update({
    where: { id },
    data,
    include: SITE_INCLUDE,
  });
  return NextResponse.json({ site });
}

// Soft delete — hidden from the catalog and new-submission pickers, but the row
// remains so existing submissions still resolve and the delete can be undone.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.site.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
