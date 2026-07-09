import { z } from "zod";
import { LeadSourceEnum } from "@/lib/anthropic/schema";

export const LeadStageEnum = z.enum([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "DEAD",
]);
export type LeadStageValue = z.infer<typeof LeadStageEnum>;

// Ordered for board rendering. The two terminal stages sit at the end.
export const LEAD_STAGES: { value: LeadStageValue; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "CONVERTED", label: "Converted" },
  { value: "DEAD", label: "Dead" },
];

// CONVERTED is a side effect of POST /api/leads/[id]/convert, never a stage the
// user drags a card into — converting has to create a project, and a bare stage
// change cannot. The board refuses the drop and the API rejects the PATCH.
export const LEAD_STAGE_CONVERTED: LeadStageValue = "CONVERTED";

// DEAD requires a non-empty deadReason, mirroring NO_SUBMISSION on the project
// pipeline. Enforced in PATCH /api/leads/[id] and prompted for in the UI.
export const LEAD_STAGES_REQUIRING_REASON: LeadStageValue[] = ["DEAD"];

export function leadStageColor(stage: LeadStageValue | string): string {
  switch (stage) {
    case "NEW":
      return "#94a3b8"; // slate
    case "CONTACTED":
      return "#d9a441"; // amber
    case "QUALIFIED":
      return "#6ba7c1"; // brand blue
    case "CONVERTED":
      return "#174c34"; // brand green
    case "DEAD":
      return "#dc2626"; // red
    default:
      return "#94a3b8";
  }
}

export function leadStageBadgeClass(stage: LeadStageValue | string): string {
  switch (stage) {
    case "NEW":
      return "bg-gray-100 text-gray-700";
    case "CONTACTED":
      return "bg-amber-100 text-amber-800";
    case "QUALIFIED":
      return "bg-blue-100 text-blue-800";
    case "CONVERTED":
      return "bg-green-100 text-green-800";
    case "DEAD":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

// What to call a lead on a card, in a toast, or in a confirm dialog. Codename
// wins when there is one; otherwise the company stands in for it. Callers must
// guarantee at least one is present — see hasUsableName.
export function leadDisplayName(lead: {
  codename?: string | null;
  companyName?: string | null;
}): string {
  return lead.codename?.trim() || lead.companyName?.trim() || "Untitled lead";
}

// A lead needs something to be called. Everything else can arrive later.
export function hasUsableName(lead: {
  codename?: string | null;
  companyName?: string | null;
}): boolean {
  return Boolean(lead.codename?.trim() || lead.companyName?.trim());
}

export const NAME_REQUIRED_MESSAGE = "Enter a codename or a company name.";

// Fields a user can type on the lead form. Nothing is required on its own — a
// lead often starts as little more than a company name and a hunch — but a lead
// must carry either a codename or a company name.
const LeadFieldsSchema = z.object({
  codename: nullableString,
  companyName: nullableString,

  leadSource: LeadSourceEnum.optional(),
  leadSourceOther: nullableString,

  contactName: nullableString,
  contactEmail: z.union([z.email(), z.literal("")]).nullable().optional(),
  contactPhone: nullableString,

  companyLocationRaw: nullableString,

  naicsCode: nullableString,
  industryDescription: nullableString,

  estimatedCapex: nullableNumber,
  estimatedJobs: z.number().int().nullable().optional(),

  minAcreage: nullableNumber,
  minBuildingSqFt: nullableNumber,

  notes: nullableString,
  // ISO date string (YYYY-MM-DD) or null.
  nextFollowUpDate: nullableString,
});

export const CreateLeadSchema = LeadFieldsSchema.refine(hasUsableName, {
  message: NAME_REQUIRED_MESSAGE,
  path: ["codename"],
});
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

// A PATCH sends only what changed, so every field is optional. `stage` and
// `deadReason` are accepted here (the board's drag handler sends them) but
// `convertedProjectId` / `convertedAt` are not — those are set only by convert.
//
// The name rule can't be checked here: a PATCH that clears the codename is fine
// as long as the stored row has a company name. The route re-checks the merged
// result against the existing row.
export const UpdateLeadSchema = LeadFieldsSchema.partial().extend({
  stage: LeadStageEnum.optional(),
  deadReason: nullableString,
});
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
