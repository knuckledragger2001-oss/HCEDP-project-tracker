import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import {
  CreatePlacerRequestSchema,
  PartnerCityEnum,
} from "@/lib/placer/schema";

export const runtime = "nodejs";

// A date-only input ("YYYY-MM-DD") stored as UTC midnight, matching how the rest
// of the app treats calendar dates (see src/lib/format.ts formatDate).
function toUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

// POST /api/placer-requests — a partner submits a new Placer AI request. The
// city and submitter come from the session, never the body, so a city can only
// ever create requests for itself.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "PARTNER") {
    return NextResponse.json(
      { error: "Only partner logins can submit requests." },
      { status: 403 },
    );
  }
  const city = PartnerCityEnum.safeParse(user.partnerCity);
  if (!city.success) {
    return NextResponse.json(
      { error: "This login has no city assigned. Contact HCEDP." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreatePlacerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const request = await prisma.placerRequest.create({
    data: {
      city: city.data,
      submittedById: user.id,
      placeName: d.placeName,
      locationAddress: d.locationAddress ?? null,
      reportType: d.reportType,
      reportTypeOther: d.reportType === "OTHER" ? d.reportTypeOther ?? null : null,
      dateRangeStart: toUtcDate(d.dateRangeStart),
      dateRangeEnd: toUtcDate(d.dateRangeEnd),
      timeframeNote: d.timeframeNote ?? null,
      purpose: d.purpose ?? null,
      neededByDate: toUtcDate(d.neededByDate),
    },
    select: { id: true },
  });

  return NextResponse.json({ id: request.id }, { status: 201 });
}
