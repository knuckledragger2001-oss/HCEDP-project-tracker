import { z } from "zod";
import { formatDate } from "@/lib/format";

// ---------------------------------------------------------------------------
// Placer AI requests — shared enums, labels, colors and validation.
// Mirrors the shape of src/lib/projects/schema.ts + the label maps in
// src/lib/format.ts so the partner submit form, the internal queue board and the
// API all read from one source of truth.
// ---------------------------------------------------------------------------

// --- Partner cities --------------------------------------------------------

export const PARTNER_CITIES = ["SAN_MARCOS", "BUDA", "LOCKHART"] as const;
export const PartnerCityEnum = z.enum(PARTNER_CITIES);
export type PartnerCityValue = (typeof PARTNER_CITIES)[number];

export const PARTNER_CITY_LABELS: Record<PartnerCityValue, string> = {
  SAN_MARCOS: "San Marcos",
  BUDA: "Buda",
  LOCKHART: "Lockhart",
};

export function partnerCityLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PARTNER_CITY_LABELS[value as PartnerCityValue] ?? value;
}

// --- Report type -----------------------------------------------------------

export const REPORT_TYPES = [
  "EVENT_ATTENDANCE",
  "RESTAURANT_VISITORSHIP",
  "RETAIL_FOOT_TRAFFIC",
  "VISITOR_DEMOGRAPHICS",
  "LOCAL_BUSINESS_SUPPORT",
  "OTHER",
] as const;
export const ReportTypeEnum = z.enum(REPORT_TYPES);
export type ReportTypeValue = (typeof REPORT_TYPES)[number];

// Order here defines the dropdown order on the submit form.
export const REPORT_TYPE_LABELS: Record<ReportTypeValue, string> = {
  EVENT_ATTENDANCE: "Event attendance",
  RESTAURANT_VISITORSHIP: "Restaurant visitorship",
  RETAIL_FOOT_TRAFFIC: "Retail / local-business foot traffic",
  VISITOR_DEMOGRAPHICS: "Visitor demographics & origin",
  LOCAL_BUSINESS_SUPPORT: "Local business support",
  OTHER: "Other (describe)",
};

export function reportTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return REPORT_TYPE_LABELS[value as ReportTypeValue] ?? value;
}

// The report type that keeps the free-text "describe" field visible/required.
export const REPORT_TYPE_OTHER_VALUE: ReportTypeValue = "OTHER";

// --- Status (internal queue) ----------------------------------------------

export const RequestStatusEnum = z.enum([
  "SUBMITTED",
  "IN_REVIEW",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
]);
export type RequestStatusValue = z.infer<typeof RequestStatusEnum>;

// Ordered for the board. Terminal outcomes (Completed / Declined) sit at the end.
export const REQUEST_STATUSES: { value: RequestStatusValue; label: string }[] = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DECLINED", label: "Declined" },
];

export const REQUEST_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  REQUEST_STATUSES.map((s) => [s.value, s.label]),
);

// Selecting DECLINED requires a reason (recorded in internalNotes), mirroring the
// pipeline's NO_SUBMISSION contract. Enforced on the API and prompted in the UI.
export const STATUSES_REQUIRING_REASON: RequestStatusValue[] = ["DECLINED"];

// Terminal outcome the partner sees as "done". Setting COMPLETED stamps completedAt.
export const COMPLETED_STATUS: RequestStatusValue = "COMPLETED";

// Tailwind badge classes per status — mirrors format.ts stageBadgeClass.
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "SUBMITTED":
      return "bg-gray-100 text-gray-700";
    case "IN_REVIEW":
      return "bg-amber-100 text-amber-800";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "DECLINED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Accent hex per status — the board card's left bar and column dots.
export function statusColor(status: string): string {
  switch (status) {
    case "SUBMITTED":
      return "#94a3b8"; // slate
    case "IN_REVIEW":
      return "#d9a441"; // amber
    case "IN_PROGRESS":
      return "#6ba7c1"; // brand blue
    case "COMPLETED":
      return "#174c34"; // brand green
    case "DECLINED":
      return "#dc2626"; // red
    default:
      return "#94a3b8";
  }
}

// --- Display helpers -------------------------------------------------------

// Human timeframe from the start/end/note trio. A range shows "start – end", a
// single date just the date, and a free-text note is appended (or stands alone).
export function formatTimeframe(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  note: string | null | undefined,
): string {
  let range = "";
  if (start && end) range = `${formatDate(start)} – ${formatDate(end)}`;
  else if (start) range = formatDate(start);
  else if (end) range = formatDate(end);
  const trimmedNote = note?.trim();
  if (range && trimmedNote) return `${range} · ${trimmedNote}`;
  return range || trimmedNote || "—";
}

// --- Validation ------------------------------------------------------------

// Empty string / null / undefined all normalize to null so optional text and
// date inputs (which submit "") don't fail validation.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

// A YYYY-MM-DD date input, kept as the raw string; the API converts to a UTC
// Date (see toUtcDate in the route). Empty → null.
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

// Body accepted by POST /api/placer-requests. The city and submitter are taken
// from the session, never the body, so a partner can only create for their city.
export const CreatePlacerRequestSchema = z
  .object({
    placeName: z.string().trim().min(1, "Place / location is required."),
    locationAddress: optionalText,
    reportType: ReportTypeEnum,
    reportTypeOther: optionalText,
    dateRangeStart: optionalDate,
    dateRangeEnd: optionalDate,
    timeframeNote: optionalText,
    purpose: optionalText,
    neededByDate: optionalDate,
  })
  .refine(
    (d) => d.reportType !== "OTHER" || (d.reportTypeOther?.trim().length ?? 0) > 0,
    { message: "Describe the report you need.", path: ["reportTypeOther"] },
  );
export type CreatePlacerRequestInput = z.infer<typeof CreatePlacerRequestSchema>;

// Body accepted by PATCH /api/placer-requests/[id] — every field optional so the
// board can send just { status } and the detail page can send a fuller edit.
// Internal-only.
export const UpdatePlacerRequestSchema = z.object({
  status: RequestStatusEnum.optional(),
  // Explicitly nullable so "unassign" (assignedToId: null) is expressible.
  assignedToId: z.string().nullable().optional(),
  internalNotes: optionalText,
  resultNote: optionalText,
  // Reason captured when moving to a status that requires one (DECLINED).
  statusReason: z.string().trim().optional(),
});
export type UpdatePlacerRequestInput = z.infer<typeof UpdatePlacerRequestSchema>;
