import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { SaveProjectInput } from "./schema";
import { normalizeLocation } from "@/lib/location/normalize";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Build the nested Prisma create from a reviewed proposal and persist it,
// recording the initial stage event in the same transaction.
export async function createProjectFromProposal(input: SaveProjectInput) {
  const stage = input.stage ?? "RFI_RECEIVED";

  const locationRaw = input.companyLocationRaw?.trim() || null;
  const location = locationRaw
    ? normalizeLocation(locationRaw)
    : { city: null, state: null, country: null };

  const data: Prisma.ProjectCreateInput = {
    codename: input.codename?.trim() || "Untitled Project",
    stage,

    leadSource: input.leadSource ?? "OTHER",
    leadSourceOther: input.leadSourceOther ?? null,
    sourceContactName: input.sourceContactName ?? null,
    sourceContactEmail: input.sourceContactEmail ?? null,
    submissionDestination: input.submissionDestination ?? null,

    companyLocationRaw: locationRaw,
    companyCity: location.city,
    companyState: location.state,
    companyCountry: location.country,

    naicsCode: input.naicsCode ?? null,
    industryDescription: input.industryDescription ?? null,
    narrative: input.narrative ?? null,
    projectType: input.projectType ?? null,

    capexTotal: input.capexTotal ?? null,
    capexLand: input.capexLand ?? null,
    capexBuilding: input.capexBuilding ?? null,
    capexEquipment: input.capexEquipment ?? null,
    financingNotes: input.financingNotes ?? null,
    hasFunding: input.hasFunding ?? null,

    avgWage: input.avgWage ?? null,

    minAcreage: input.minAcreage ?? null,
    minBuildingSqFt: input.minBuildingSqFt ?? null,
    buildingSizeNeeds: input.buildingSizeNeeds ?? null,
    siteLocationPreferences: input.siteLocationPreferences ?? [],

    environmentalNotes: input.environmentalNotes ?? null,
    transportationNotes: input.transportationNotes ?? null,
    specialServicesNotes: input.specialServicesNotes ?? null,

    requiredDeliverables: input.requiredDeliverables ?? [],

    rfiReceivedDate: toDate(input.rfiReceivedDate) ?? new Date(),
    responseDueDate: toDate(input.responseDueDate),
    responseSubmittedDate: toDate(input.responseSubmittedDate),
    siteVisitDate: toDate(input.siteVisitDate),
    projectedDecisionDate: toDate(input.projectedDecisionDate),
    productionStartDate: toDate(input.productionStartDate),

    rawEmailText: input.rawEmailText ?? null,
    parsedModel: input.parsedModel ?? null,
    parsedAt: input.parsedModel ? new Date() : null,
    parseWarnings: (input.parseWarnings ?? []) as Prisma.InputJsonValue,

    stageHistory: {
      create: [{ toStage: stage, note: "Project created" }],
    },

    jobPhases: {
      create: (input.jobPhases ?? []).map((j, i) => ({
        count: j.count,
        timeframe: j.timeframe,
        orderIndex: i,
      })),
    },

    criticalCriteria: {
      create: (input.criticalCriteria ?? []).map((c, i) => ({
        rank: c.rank ?? i + 1,
        text: c.text,
      })),
    },

    qualitativeNotes: {
      create: (input.qualitativeNotes ?? []).map((q) => ({
        label: q.label,
        content: q.content,
      })),
    },

    utilities: {
      create: (input.utilities ?? []).map((u) => ({
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
          create: (u.datapoints ?? []).map((d) => ({
            kind: d.kind ?? null,
            label: d.label ?? null,
            value: d.value ?? null,
            unit: d.unit ?? null,
            date: toDate(d.date),
            rawValue: d.rawValue ?? null,
            flagged: d.flagged ?? false,
            assumptionNote: d.assumptionNote ?? null,
          })),
        },
      })),
    },

    attachments: {
      create: (input.attachments ?? []).map((a) => ({
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storageKey: a.storageKey,
        kind: a.kind ?? "attachment",
      })),
    },
  };

  return prisma.project.create({ data, select: { id: true, codename: true } });
}
