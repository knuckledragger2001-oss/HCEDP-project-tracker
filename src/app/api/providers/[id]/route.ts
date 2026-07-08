import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ProviderTypeEnum = z.enum(["ELECTRIC", "WATER", "SEWER", "GAS"]);

const UpdateProviderSchema = z.object({
  name: z.string().trim().min(1, "Provider name is required").optional(),
  type: ProviderTypeEnum.optional(),
});

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  try {
    const provider = await prisma.utilityProvider.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ provider });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "A provider with that name already exists for this utility." },
        { status: 409 },
      );
    }
    throw err;
  }
}

// Delete a provider only if no site references it (as electric/water/sewer/gas).
// Otherwise return 409 so the UI can explain why.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const inUse = await prisma.site.count({
    where: {
      OR: [
        { electricProviderId: id },
        { waterProviderId: id },
        { sewerProviderId: id },
        { gasProviderId: id },
      ],
    },
  });
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `Can't delete: this provider is assigned to ${inUse} site${inUse === 1 ? "" : "s"}. Reassign those sites first.`,
      },
      { status: 409 },
    );
  }
  await prisma.utilityProvider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
