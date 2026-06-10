import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const communities = await prisma.community.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { sites: true } } },
  });
  return NextResponse.json({ communities });
}

const CreateCommunitySchema = z.object({
  name: z.string().trim().min(1, "Community name is required"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateCommunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid community", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  // Append after the existing communities in display order.
  const last = await prisma.community.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  try {
    const community = await prisma.community.create({
      data: { name: parsed.data.name, order },
      include: { _count: { select: { sites: true } } },
    });
    return NextResponse.json({ community }, { status: 201 });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A community with that name already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
}
