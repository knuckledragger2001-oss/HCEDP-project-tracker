import { z } from "zod";

// Schema for the structured RFI extraction Claude returns. Everything is
// optional/nullable because RFIs arrive messy and incomplete. This same shape
// is what the review form edits and what the save endpoint accepts.

export const LeadSourceEnum = z.enum([
  "TEXAS_GOVERNORS_OFFICE",
  "OPPORTUNITY_AUSTIN",
  "DIRECT",
  "OTHER",
]);

export const UtilityTypeEnum = z.enum([
  "ELECTRICITY",
  "WATER",
  "WASTEWATER",
  "GAS",
]);

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
// ISO 8601 date string (YYYY-MM-DD) or null.
const nullableDate = z.string().nullable().optional();

export const UtilityDatapointSchema = z.object({
  kind: nullableString, // "day-one" | "peak" | "ramp" | "monthly" | ...
  label: nullableString,
  value: nullableNumber,
  unit: nullableString,
  date: nullableDate,
  rawValue: nullableString,
  flagged: z.boolean().optional().default(false),
  assumptionNote: nullableString,
});

export const UtilityRequirementSchema = z.object({
  type: UtilityTypeEnum,
  normalizedValue: nullableNumber,
  normalizedUnit: nullableString,
  rawValue: nullableString,
  purpose: nullableString,
  alternatives: nullableString,
  notes: nullableString,
  flagged: z.boolean().optional().default(false),
  assumptionNote: nullableString,
  datapoints: z.array(UtilityDatapointSchema).optional().default([]),
});

export const JobPhaseSchema = z.object({
  count: z.number().int(),
  timeframe: z.string(),
});

export const CriticalCriterionSchema = z.object({
  rank: z.number().int(),
  text: z.string(),
});

export const QualitativeNoteSchema = z.object({
  label: z.string(),
  content: z.string(),
});

export const ParseWarningSchema = z.object({
  field: z.string(),
  message: z.string(),
  kind: z.string().optional(), // "assumption" | "conversion" | "missing" | ...
});

export const ParsedProjectSchema = z.object({
  codename: z.string(),

  leadSource: LeadSourceEnum.nullable().optional(),
  leadSourceOther: nullableString,
  sourceContactName: nullableString,
  sourceContactEmail: nullableString,
  submissionDestination: nullableString,

  naicsCode: nullableString,
  industryDescription: nullableString,
  narrative: nullableString,
  projectType: nullableString,

  capexTotal: nullableNumber,
  capexLand: nullableNumber,
  capexBuilding: nullableNumber,
  capexEquipment: nullableNumber,
  financingNotes: nullableString,
  hasFunding: z.boolean().nullable().optional(),

  avgWage: nullableNumber,

  minAcreage: nullableNumber,
  minBuildingSqFt: nullableNumber,
  buildingSizeNeeds: nullableString,
  siteLocationPreferences: z.array(z.string()).optional().default([]),

  environmentalNotes: nullableString,
  transportationNotes: nullableString,
  specialServicesNotes: nullableString,

  requiredDeliverables: z.array(z.string()).optional().default([]),

  rfiReceivedDate: nullableDate,
  responseDueDate: nullableDate,
  responseSubmittedDate: nullableDate,
  siteVisitDate: nullableDate,
  projectedDecisionDate: nullableDate,
  productionStartDate: nullableDate,

  jobPhases: z.array(JobPhaseSchema).optional().default([]),
  criticalCriteria: z.array(CriticalCriterionSchema).optional().default([]),
  utilities: z.array(UtilityRequirementSchema).optional().default([]),
  qualitativeNotes: z.array(QualitativeNoteSchema).optional().default([]),

  parseWarnings: z.array(ParseWarningSchema).optional().default([]),
});

export type ParsedProject = z.infer<typeof ParsedProjectSchema>;

// Attachment metadata the intake endpoint stages and returns with the proposal,
// so the save step can link the already-stored files to the new project.
export const StagedAttachmentSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  storageKey: z.string(),
  kind: z.string().default("attachment"),
});
export type StagedAttachment = z.infer<typeof StagedAttachmentSchema>;

// JSON Schema handed to the Anthropic tool. Derived from the zod schema so the
// two never drift.
export function parsedProjectJsonSchema() {
  return z.toJSONSchema(ParsedProjectSchema, { target: "draft-2020-12" });
}

// Blank proposal used when the parser is unavailable (e.g. no API key) so the
// user can still fill the review form manually.
export function emptyProposal(emailText = ""): ParsedProject {
  return ParsedProjectSchema.parse({
    codename: "",
    narrative: emailText ? emailText.slice(0, 4000) : null,
    siteLocationPreferences: [],
    requiredDeliverables: [],
    jobPhases: [],
    criticalCriteria: [],
    utilities: [],
    qualitativeNotes: [],
    parseWarnings: [],
  });
}
