import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalApi } from "@/lib/auth/api";
import { describeRecurrence } from "@/lib/placer/recurrence";
import { patternOf } from "@/lib/placer/planning";

export const runtime = "nodejs";

// GET /api/placer-series — the recurring plans list shown on the planning
// calendar's sidebar, with a plain-English description of each pattern.
export async function GET() {
  const gate = await requireInternalApi();
  if (gate.error) return gate.error;

  const series = await prisma.placerRequestSeries.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { name: true, email: true } },
      _count: { select: { requests: true } },
    },
  });

  return NextResponse.json({
    series: series.map((s) => ({
      id: s.id,
      city: s.city,
      placeName: s.placeName,
      reportType: s.reportType,
      reportTypeOther: s.reportTypeOther,
      active: s.active,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString() ?? null,
      leadDays: s.leadDays,
      assignedToId: s.assignedToId,
      assignedToName: s.assignedTo?.name ?? s.assignedTo?.email ?? null,
      description: describeRecurrence(patternOf(s)),
      occurrenceCount: s._count.requests,
    })),
  });
}
