import { z } from "zod";
import { ParsedProjectSchema, StagedAttachmentSchema } from "@/lib/anthropic/schema";

export const PipelineStageEnum = z.enum([
  "RFI_RECEIVED",
  "PENDING_INFORMATION",
  "RFI_SUBMITTED",
  "SHORTLISTED",
  "SITE_VISIT",
  "IN_NEGOTIATIONS",
  "WON",
  "LOST",
  "NO_SUBMISSION",
]);
export type PipelineStageValue = z.infer<typeof PipelineStageEnum>;

// Ordered for board rendering. Terminal outcomes (Won / Lost / No Submission)
// sit at the end. "No Submission" is the outcome when we deliberately chose not
// to respond to an RFI; selecting it requires a reason (see noSubmissionReason).
export const PIPELINE_STAGES: { value: PipelineStageValue; label: string }[] = [
  { value: "RFI_RECEIVED", label: "RFI Received" },
  { value: "PENDING_INFORMATION", label: "Pending Information" },
  { value: "RFI_SUBMITTED", label: "RFI Submitted" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "SITE_VISIT", label: "Site Visit" },
  { value: "IN_NEGOTIATIONS", label: "In Negotiations" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "NO_SUBMISSION", label: "No Submission" },
];

// Stages that require a non-empty noSubmissionReason before a project can enter
// them. Enforced on the API (PATCH /api/projects/[id]) and prompted in the UI.
export const STAGES_REQUIRING_REASON: PipelineStageValue[] = ["NO_SUBMISSION"];

// Body accepted by POST /api/projects — the reviewed/edited proposal plus
// intake context (raw email, staged attachments, parser provenance).
export const SaveProjectSchema = ParsedProjectSchema.extend({
  stage: PipelineStageEnum.optional(),
  noSubmissionReason: z.string().nullable().optional(),
  rawEmailText: z.string().nullable().optional(),
  parsedModel: z.string().nullable().optional(),
  attachments: z.array(StagedAttachmentSchema).optional().default([]),
});
export type SaveProjectInput = z.infer<typeof SaveProjectSchema>;
