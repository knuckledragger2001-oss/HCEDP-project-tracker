import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isInternal } from "@/lib/auth/session";
import {
  CreatePlacerRequestSchema,
  CreatePlacerRequestInternalSchema,
  PartnerCityEnum,
} from "@/lib/placer/schema";

export const runtime = "nodejs";

// A date-only input ("YYYY-MM-DD") stored as UTC midnight, matching how the rest
// of the app treats calendar dates (see src/lib/format.ts formatDate).
function toUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

// POST /api/placer-requests — create a Placer AI request. Two callers:
//   • a partner self-submits (city + submitter come from the session, never the
//     body, so a city can only ever create requests for itself);
//   • internal staff manually log a request received outside the portal, picking
//     the city and optionally the stage it's already at.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  // Internal staff path: manual entry for seeding requests we've already
  // received. Staff choose the city and starting status; the submitter is
  // stamped as the staff member so the queue shows who logged it.
  if (isInternal(user.role)) {
    const parsed = CreatePlacerRequestInternalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: z.treeifyError(parsed.error) },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const status = d.status ?? "SUBMITTED";

    const created = await prisma.placerRequest.create({
      data: {
        city: d.city,
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
        status,
        // COMPLETED at creation (seeding an already-delivered request) stamps a
        // completion time, mirroring the PATCH contract.
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
      select: {
        id: true,
        city: true,
        placeName: true,
        reportType: true,
        reportTypeOther: true,
        dateRangeStart: true,
        dateRangeEnd: true,
        timeframeNote: true,
        purpose: true,
        status: true,
        assignedToId: true,
        neededByDate: true,
        createdAt: true,
      },
    });

    // Shaped to match the board's QueueRequest so it can be inserted in place
    // without a full reload. Staff are entering this by hand, so there's no
    // partner login to suggest as the CRM contact, and it can't be archived yet.
    return NextResponse.json(
      {
        request: {
          ...created,
          dateRangeStart: created.dateRangeStart?.toISOString() ?? null,
          dateRangeEnd: created.dateRangeEnd?.toISOString() ?? null,
          neededByDate: created.neededByDate?.toISOString() ?? null,
          createdAt: created.createdAt.toISOString(),
          submittedByName: user.name ?? user.email,
          suggestedContact: null,
          archivedAt: null,
          archiveContactName: null,
        },
      },
      { status: 201 },
    );
  }

  // Partner path.
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
