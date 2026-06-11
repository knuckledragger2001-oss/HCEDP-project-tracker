import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const communityId = req.nextUrl.searchParams.get("communityId") ?? undefined;
  const sites = await prisma.site.findMany({
    where: communityId ? { communityId } : undefined,
    orderBy: [{ community: { order: "asc" } }, { name: "asc" }],
    include: {
      community: true,
      electricProvider: true,
      waterProvider: true,
      sewerProvider: true,
      _count: { select: { submissions: true } },
    },
  });
  return NextResponse.json({ sites });
}

const RealEstateTypeEnum = z.enum([
  "INDUSTRIAL_GREENFIELD",
  "BROWNFIELD",
  "SPEC_INDUSTRIAL",
  "MIXED_USE",
  "OFFICE",
]);

const CountyEnum = z.enum(["HAYS", "CALDWELL", "TRAVIS"]);

const CreateSiteSchema = z.object({
  name: z.string().min(1, "Site name is required"),
  communityId: z.string().min(1, "Community is required"),
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
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid site", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const site = await prisma.site.create({
    data: {
      name: d.name.trim(),
      communityId: d.communityId,
      acreage: d.acreage ?? null,
      address: d.address ?? null,
      notes: d.notes ?? null,
      realEstateType: d.realEstateType ?? null,
      county: d.county ?? null,
      squareFeet: d.squareFeet ?? null,
      pricePerSqFt: d.pricePerSqFt ?? null,
      currentElectricMw: d.currentElectricMw ?? null,
      projectedElectricMw: d.projectedElectricMw ?? null,
      electricProviderId: d.electricProviderId || null,
      waterProviderId: d.waterProviderId || null,
      sewerProviderId: d.sewerProviderId || null,
    },
    include: {
      community: true,
      electricProvider: true,
      waterProvider: true,
      sewerProvider: true,
    },
  });
  return NextResponse.json({ site }, { status: 201 });
}
