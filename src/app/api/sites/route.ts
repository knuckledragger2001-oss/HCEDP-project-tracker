import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const communityId = req.nextUrl.searchParams.get("communityId") ?? undefined;
  const sites = await prisma.site.findMany({
    where: communityId ? { communityId } : undefined,
    orderBy: [{ community: { order: "asc" } }, { name: "asc" }],
    include: { community: true, _count: { select: { submissions: true } } },
  });
  return NextResponse.json({ sites });
}

const CreateSiteSchema = z.object({
  name: z.string().min(1, "Site name is required"),
  communityId: z.string().min(1, "Community is required"),
  acreage: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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
  const site = await prisma.site.create({
    data: {
      name: parsed.data.name.trim(),
      communityId: parsed.data.communityId,
      acreage: parsed.data.acreage ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    },
    include: { community: true },
  });
  return NextResponse.json({ site }, { status: 201 });
}
