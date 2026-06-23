import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PipelineStageEnum } from "@/lib/projects/schema";
import { normalizeLocation } from "@/lib/location/normalize";
import {
  LeadSourceEnum,
  JobPhaseSchema,
  CriticalCriterionSchema,
  QualitativeNoteSchema,
  UtilityRequirementSchema,
} from "@/lib/anthropic/schema";

export const runtime = "nodejs";

const nullableDate = z.string().nullable().optional();
const nStr = z.string().nullable().optional();
const nNum = z.number().nullable().optional();

// Update schema for board moves, light edits, and the "apply RFI update" flow.
const UpdateProjectSchema = z.object({
  stage: PipelineStageEnum.optional(),
  stageNote: z.string().optional(),
  noSubmissionReason: nStr,
  archived: z.boolean().optional(),

  codename: z.string().optional(),
  leadSource: LeadSourceEnum.optional(),
  leadSourceOther: nStr,
  sourceContactName: nStr,
  sourceContactEmail: nStr,
  submissionDestination: nStr,
  naicsCode: nStr,
  industryDescription: nStr,
  narrative: nStr,
  projectType: nStr,
  buildingSizeNeeds: nStr,
  financingNotes: nStr,
  environmentalNotes: nStr,
  transportationNotes: nStr,
  specialServicesNotes: nStr,

  capexTotal: nNum,
  capexLand: nNum,
  capexBuilding: nNum,
  capexEquipment: nNum,
  avgWage: nNum,
  minAcreage: nNum,
  minBuildingSqFt: nNum,
  hasFunding: z.boolean().nullable().optional(),

  siteLocationPreferences: z.array(z.string()).optional(),
  requiredDeliverables: z.array(z.string()).optional(),

  companyLocationRaw: nStr,

  // Relational collections — when present, replace the whole set.
  jobPhases: z.array(JobPhaseSchema).optional(),
  criticalCriteria: z.array(CriticalCriterionSchema).optional(),
  qualitativeNotes: z.array(QualitativeNoteSchema).optional(),
  utilities: z.array(UtilityRequirementSchema).optional(),
  siteVisits: z
    .array(z.object({ date: z.string(), note: z.string().nullable().optional() }))
    .optional(),

  rfiReceivedDate: nullableDate,
  responseSubmittedDate: nullableDate,
  siteVisitDate: nullableDate,
  responseDueDate: nullableDate,
  projectedDecisionDate: nullableDate,
  productionStartDate: nullableDate,
});

// Scalar string/number/bool fields copied straight through when present.
const PASSTHROUGH = [
  "codename",
  "leadSource",
  "leadSourceOther",
  "sourceContactName",
  "sourceContactEmail",
  "submissionDestination",
  "naicsCode",
  "industryDescription",
  "narrative",
  "projectType",
  "buildingSizeNeeds",
  "financingNotes",
  "environmentalNotes",
  "transportationNotes",
  "specialServicesNotes",
  "capexTotal",
  "capexLand",
  "capexBuilding",
  "capexEquipment",
  "avgWage",
  "minAcreage",
  "minBuildingSqFt",
  "hasFunding",
  "noSubmissionReason",
  "siteLocationPreferences",
  "requiredDeliverables",
] as const;

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
    select: { stage: true, responseSubmittedDate: true, noSubmissionReason: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = parsed.data;
  const stageChanged = d.stage !== undefined && d.stage !== existing.stage;

  // Moving into "No Submission" requires a reason — either supplied in this
  // request or already recorded on the project.
  if (stageChanged && d.stage === "NO_SUBMISSION") {
    const reason = d.noSubmissionReason ?? existing.noSubmissionReason;
    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "A reason is required to move a project to No Submission." },
        { status: 400 },
      );
    }
  }

  // Auto-stamp response submitted date when stage first moves to RFI_SUBMITTED.
  const autoStampSubmitted =
    stageChanged &&
    d.stage === "RFI_SUBMITTED" &&
    d.responseSubmittedDate === undefined &&
    existing.responseSubmittedDate === null;

  // Copy through only the scalar fields that were actually provided.
  const data: Record<string, unknown> = {};
  for (const key of PASSTHROUGH) {
    if (d[key] !== undefined) data[key] = d[key];
  }
  if (d.stage !== undefined) data.stage = d.stage;
  if (d.archived !== undefined) {
    data.archivedAt = d.archived ? new Date() : null;
  }
  // Dates: only set when the key was present in the payload.
  const dateKeys = [
    "rfiReceivedDate",
    "responseSubmittedDate",
    "siteVisitDate",
    "responseDueDate",
    "projectedDecisionDate",
    "productionStartDate",
  ] as const;
  for (const key of dateKeys) {
    if (d[key] !== undefined) data[key] = toDate(d[key]);
  }
  if (autoStampSubmitted) data.responseSubmittedDate = new Date();
  if (stageChanged) {
    data.stageHistory = {
      create: {
        fromStage: existing.stage,
        toStage: d.stage!,
        note: d.stageNote ?? null,
      },
    };
  }

  // Relational collections: replace the whole set when provided.
  if (d.jobPhases !== undefined) {
    data.jobPhases = {
      deleteMany: {},
      create: d.jobPhases.map((j, i) => ({
        count: j.count,
        timeframe: j.timeframe,
        orderIndex: i,
      })),
    };
  }
  if (d.criticalCriteria !== undefined) {
    data.criticalCriteria = {
      deleteMany: {},
      create: d.criticalCriteria.map((c, i) => ({
        rank: c.rank ?? i + 1,
        text: c.text,
      })),
    };
  }
  if (d.qualitativeNotes !== undefined) {
    data.qualitativeNotes = {
      deleteMany: {},
      create: d.qualitativeNotes.map((q) => ({
        label: q.label,
        content: q.content,
      })),
    };
  }
  if (d.utilities !== undefined) {
    data.utilities = {
      deleteMany: {},
      create: d.utilities.map((u) => ({
        type: u.type,
        normalizedValue: u.normalizedValue ?? null,
        normalizedUnit: u.normalizedUnit ?? null,
        rawValue: u.rawValue ?? null,
        purpose: u.purpose ?? null,
        alternatives: u.alternatives ?? null,
        notes: u.notes ?? null,
        flagged: u.flagged ?? false,
        assumptionNote: u.assumptionNote ?? null,
        datapoints: {
          create: (u.datapoints ?? []).map((dp) => ({
            kind: dp.kind ?? null,
            label: dp.label ?? null,
            value: dp.value ?? null,
            unit: dp.unit ?? null,
            date: toDate(dp.date),
            rawValue: dp.rawValue ?? null,
            flagged: dp.flagged ?? false,
            assumptionNote: dp.assumptionNote ?? null,
          })),
        },
      })),
    };
  }

  // Site visits: replace the whole set when provided, and keep the legacy
  // single siteVisitDate in sync (earliest visit) for board/stage date logic.
  if (d.siteVisits !== undefined) {
    const visits = d.siteVisits
      .map((v) => ({ date: toDate(v.date), note: v.note ?? null }))
      .filter((v): v is { date: Date; note: string | null } => v.date != null);
    data.siteVisits = {
      deleteMany: {},
      create: visits.map((v, i) => ({
        visitDate: v.date,
        note: v.note,
        orderIndex: i,
      })),
    };
    data.siteVisitDate = visits.length
      ? new Date(Math.min(...visits.map((v) => v.date.getTime())))
      : null;
  }

  // Company location: store the raw text and the normalized parts so reports
  // can group by state/country.
  if (d.companyLocationRaw !== undefined) {
    const raw = d.companyLocationRaw?.trim() || null;
    const norm = raw ? normalizeLocation(raw) : { city: null, state: null, country: null };
    data.companyLocationRaw = raw;
    data.companyCity = norm.city;
    data.companyState = norm.state;
    data.companyCountry = norm.country;
  }

  const project = await prisma.project.update({
    where: { id },
    data,
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
