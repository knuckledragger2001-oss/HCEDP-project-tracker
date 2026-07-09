import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CreateLeadSchema } from "@/lib/leads/schema";
import { normalizeLocation } from "@/lib/location/normalize";

export const runtime = "nodejs";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Same raw + normalized location treatment the project create path applies,
  // so a converted lead's location groups in reports exactly as an RFI's would.
  const locationRaw = d.companyLocationRaw?.trim() || null;
  const location = locationRaw
    ? normalizeLocation(locationRaw)
    : { city: null, state: null, country: null };

  const lead = await prisma.lead.create({
    data: {
      codename: d.codename?.trim() || null,
      companyName: d.companyName?.trim() || null,

      leadSource: d.leadSource ?? "DIRECT_OTHER",
      leadSourceOther: d.leadSourceOther || null,

      contactName: d.contactName || null,
      contactEmail: d.contactEmail || null,
      contactPhone: d.contactPhone || null,

      companyLocationRaw: locationRaw,
      companyCity: location.city,
      companyState: location.state,
      companyCountry: location.country,

      naicsCode: d.naicsCode || null,
      industryDescription: d.industryDescription || null,

      estimatedCapex: d.estimatedCapex ?? null,
      estimatedJobs: d.estimatedJobs ?? null,

      minAcreage: d.minAcreage ?? null,
      minBuildingSqFt: d.minBuildingSqFt ?? null,

      notes: d.notes || null,
      nextFollowUpDate: toDate(d.nextFollowUpDate),
    },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
