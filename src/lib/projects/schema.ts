import { z } from "zod";
import { ParsedProjectSchema, StagedAttachmentSchema } from "@/lib/anthropic/schema";

export const PipelineStageEnum = z.enum([
  "RFI_RECEIVED",
  "PENDING_INFORMATION",
  "RFI_SUBMITTED",
  "SHORTLISTED",
  "SITE_VISIT",
  "WON",
  "LOST",
]);
export type PipelineStageValue = z.infer<typeof PipelineStageEnum>;

// Ordered for board rendering.
export const PIPELINE_STAGES: { value: PipelineStageValue; label: string }[] = [
  { value: "RFI_RECEIVED", label: "RFI Received" },
  { value: "PENDING_INFORMATION", label: "Pending Information" },
  { value: "RFI_SUBMITTED", label: "RFI Submitted" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "SITE_VISIT", label: "Site Visit" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

// Body accepted by POST /api/projects — the reviewed/edited proposal plus
// intake context (raw email, staged attachments, parser provenance).
export const SaveProjectSchema = ParsedProjectSchema.extend({
  stage: PipelineStageEnum.optional(),
  rawEmailText: z.string().nullable().optional(),
  parsedModel: z.string().nullable().optional(),
  attachments: z.array(StagedAttachmentSchema).optional().default([]),
});
export type SaveProjectInput = z.infer<typeof SaveProjectSchema>;
