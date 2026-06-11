import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ProviderTypeEnum = z.enum(["ELECTRIC", "WATER", "SEWER"]);
type ProviderType = "ELECTRIC" | "WATER" | "SEWER";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") as ProviderType | null;
  const validTypes: ProviderType[] = ["ELECTRIC", "WATER", "SEWER"];
  const providers = await prisma.utilityProvider.findMany({
    where: type && validTypes.includes(type) ? { type } : undefined,
    orderBy: [{ type: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ providers });
}

const CreateProviderSchema = z.object({
  name: z.string().trim().min(1, "Provider name is required"),
  type: ProviderTypeEnum,
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  // Append after existing providers of the same type.
  const last = await prisma.utilityProvider.findFirst({
    where: { type: parsed.data.type },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  try {
    const provider = await prisma.utilityProvider.create({
      data: { name: parsed.data.name, type: parsed.data.type, order },
    });
    return NextResponse.json({ provider }, { status: 201 });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A provider with that name already exists for this utility." },
        { status: 409 },
      );
    }
    throw err;
  }
}
