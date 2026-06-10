import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PipelineStageEnum } from "@/lib/projects/schema";

export const runtime = "nodejs";

const nullableDate = z.string().nullable().optional();

// Focused update schema for board moves + light field edits.
const UpdateProjectSchema = z.object({
  stage: PipelineStageEnum.optional(),
  stageNote: z.string().optional(),
  codename: z.string().optional(),
  responseSubmittedDate: nullableDate,
  siteVisitDate: nullableDate,
  responseDueDate: nullableDate,
  projectedDecisionDate: nullableDate,
  productionStartDate: nullableDate,
});

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      stageHistory: { orderBy: { changedAt: "asc" } },
      jobPhases: { orderBy: { orderIndex: "asc" } },
      criticalCriteria: { orderBy: { rank: "asc" } },
      qualitativeNotes: true,
      utilities: { include: { datapoints: true } },
      attachments: true,
      submissions: {
        include: { site: { include: { community: true } } },
        orderBy: { submissionDate: "desc" },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { stage: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = parsed.data;
  const stageChanged = d.stage !== undefined && d.stage !== existing.stage;

  const project = await prisma.project.update({
    where: { id },
    data: {
      stage: d.stage,
      codename: d.codename,
      responseSubmittedDate: toDate(d.responseSubmittedDate),
      siteVisitDate: toDate(d.siteVisitDate),
      responseDueDate: toDate(d.responseDueDate),
      projectedDecisionDate: toDate(d.projectedDecisionDate),
      productionStartDate: toDate(d.productionStartDate),
      ...(stageChanged
        ? {
            stageHistory: {
              create: {
                fromStage: existing.stage,
                toStage: d.stage!,
                note: d.stageNote ?? null,
              },
            },
          }
        : {}),
    },
    select: { id: true, stage: true, codename: true },
  });

  return NextResponse.json({ project });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
