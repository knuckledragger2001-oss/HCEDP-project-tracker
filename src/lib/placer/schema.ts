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
  "PLANNED",
  "SUBMITTED",
  "IN_REVIEW",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
]);
export type RequestStatusValue = z.infer<typeof RequestStatusEnum>;

// A request we know is coming but haven't queued yet. It lives on the planning
// calendar (/placer/calendar) rather than the queue board, and becomes SUBMITTED
// on its queueOnDate. Deliberately NOT part of REQUEST_STATUSES so it never
// appears as a board column or as a status anyone can drag a live request into.
export const PLANNED_STATUS: RequestStatusValue = "PLANNED";

// Ordered for the board. Terminal outcomes (Completed / Declined) sit at the end.
export const REQUEST_STATUSES: { value: RequestStatusValue; label: string }[] = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DECLINED", label: "Declined" },
];

// Labels cover every status, planned included, so a badge always has a name.
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  ...Object.fromEntries(REQUEST_STATUSES.map((s) => [s.value, s.label])),
};

// Selecting DECLINED requires a reason (recorded in internalNotes), mirroring the
// pipeline's NO_SUBMISSION contract. Enforced on the API and prompted in the UI.
export const STATUSES_REQUIRING_REASON: RequestStatusValue[] = ["DECLINED"];

// Terminal outcome the partner sees as "done". Setting COMPLETED stamps completedAt.
export const COMPLETED_STATUS: RequestStatusValue = "COMPLETED";

// Tailwind badge classes per status — mirrors format.ts stageBadgeClass.
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "PLANNED":
      return "bg-indigo-100 text-indigo-800";
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
    case "PLANNED":
      return "#6366f1"; // indigo — planned, not yet in the queue
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

// The request body common to both create paths (partner self-submit and internal
// manual entry). City, submitter and status are added per-path, not here.
const createRequestFields = {
  placeName: z.string().trim().min(1, "Place / location is required."),
  locationAddress: optionalText,
  reportType: ReportTypeEnum,
  reportTypeOther: optionalText,
  dateRangeStart: optionalDate,
  dateRangeEnd: optionalDate,
  timeframeNote: optionalText,
  purpose: optionalText,
  neededByDate: optionalDate,
} as const;

// OTHER must carry a free-text description of the report — shared by both create
// schemas so the rule can't drift between the partner form and the staff form.
const otherRequiresDescription = (d: { reportType: string; reportTypeOther?: string | null }) =>
  d.reportType !== "OTHER" || (d.reportTypeOther?.trim().length ?? 0) > 0;
const otherDescriptionError = {
  message: "Describe the report you need.",
  path: ["reportTypeOther"],
};

// Body accepted by POST /api/placer-requests from a partner. The city and
// submitter are taken from the session, never the body, so a partner can only
// create for their own city.
export const CreatePlacerRequestSchema = z
  .object(createRequestFields)
  .refine(otherRequiresDescription, otherDescriptionError);
export type CreatePlacerRequestInput = z.infer<typeof CreatePlacerRequestSchema>;

// Body accepted by POST /api/placer-requests from internal staff manually
// logging a request that came in outside the portal (phone, email, or before a
// city had a login). Staff choose the city and, optionally, the stage the
// request is already at, so an existing backlog can be seeded where it really
// stands. The submitter is stamped as the staff member entering it.
export const CreatePlacerRequestInternalSchema = z
  .object({
    ...createRequestFields,
    city: PartnerCityEnum,
    status: RequestStatusEnum.optional(),
  })
  .refine(otherRequiresDescription, otherDescriptionError);
export type CreatePlacerRequestInternalInput = z.infer<
  typeof CreatePlacerRequestInternalSchema
>;

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

// --- Planning: the calendar and recurring plans ------------------------------
// A "plan" is a Placer request we know is coming: a partner has told us they'll
// want it (a parade, a festival, a standing monthly report). It is stored as a
// PLANNED PlacerRequest whose dateRangeStart is the event date, and drops into
// the live queue on its queueOnDate. See src/lib/placer/planning.ts.

// Placer data for an event is typically available about a week afterwards, so a
// plan queues that many days after the event unless the planner says otherwise.
export const DEFAULT_LEAD_DAYS = 7;

// How far ahead recurring plans are materialized into dated occurrences. Kept
// modest so the calendar stays readable and a paused/edited series doesn't leave
// years of stale rows behind.
export const PLAN_HORIZON_MONTHS = 12;

export const RecurrenceEnum = z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]);
export type RecurrenceValue = z.infer<typeof RecurrenceEnum>;

export const RECURRENCE_OPTIONS: { value: RecurrenceValue; label: string }[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annually" },
];

export const RECURRENCE_LABELS: Record<string, string> = Object.fromEntries(
  RECURRENCE_OPTIONS.map((r) => [r.value, r.label]),
);

export const RecurrenceModeEnum = z.enum(["DAY_OF_MONTH", "NTH_WEEKDAY"]);
export type RecurrenceModeValue = z.infer<typeof RecurrenceModeEnum>;

// The recurrence pattern as the plan dialog sends it. startDate isn't here: the
// plan's event date is always the anchor, so the first occurrence is the date
// the user picked on the calendar.
export const RecurrenceInputSchema = z.object({
  frequency: RecurrenceEnum,
  interval: z.coerce.number().int().min(1).max(52).default(1),
  mode: RecurrenceModeEnum.default("DAY_OF_MONTH"),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  weekday: z.coerce.number().int().min(0).max(6).nullable().optional(),
  // 1–4, or -1 for "last".
  weekOfMonth: z.coerce
    .number()
    .int()
    .refine((v) => v === -1 || (v >= 1 && v <= 4), "Pick a week of the month")
    .nullable()
    .optional(),
  endDate: optionalDate,
});
export type RecurrenceInput = z.infer<typeof RecurrenceInputSchema>;

// Body accepted by POST /api/placer-plans. Internal staff only. An event date is
// optional: a plan with no date sits in the calendar's backlog until someone
// drags it onto a day. A recurrence requires one (it's the anchor of the pattern).
export const CreatePlanSchema = z
  .object({
    city: PartnerCityEnum,
    placeName: z.string().trim().min(1, "Name the event or report."),
    locationAddress: optionalText,
    reportType: ReportTypeEnum,
    reportTypeOther: optionalText,
    purpose: optionalText,
    internalNotes: optionalText,
    /** The event / period being measured. Stored as dateRangeStart. */
    eventDate: optionalDate,
    /** Optional end of a multi-day event. Stored as dateRangeEnd. */
    eventEndDate: optionalDate,
    /** Days after the event before it should hit the queue. */
    leadDays: z.coerce.number().int().min(0).max(365).default(DEFAULT_LEAD_DAYS),
    /** Explicit queue date; overrides leadDays when set. */
    queueOnDate: optionalDate,
    assignedToId: z.string().nullable().optional(),
    recurrence: RecurrenceInputSchema.nullable().optional(),
  })
  .refine(otherRequiresDescription, otherDescriptionError)
  .refine((d) => !d.recurrence || !!d.eventDate, {
    message: "A repeating plan needs a first date.",
    path: ["eventDate"],
  });
export type CreatePlanInput = z.infer<typeof CreatePlanSchema>;

// Body accepted by PATCH /api/placer-plans/[id] — editing or dragging a single
// planned occurrence. Moving the event date on the calendar sends only
// { eventDate }, and the API shifts queueOnDate by the same number of days so the
// lead time the planner chose is preserved. Sending { release: true } drops the
// plan into the live queue immediately, whatever its queue date says.
export const UpdatePlanSchema = z.object({
  placeName: z.string().trim().min(1).optional(),
  locationAddress: optionalText,
  reportType: ReportTypeEnum.optional(),
  reportTypeOther: optionalText,
  purpose: optionalText,
  internalNotes: optionalText,
  eventDate: optionalDate,
  eventEndDate: optionalDate,
  queueOnDate: optionalDate,
  neededByDate: optionalDate,
  assignedToId: z.string().nullable().optional(),
  release: z.boolean().optional(),
});
export type UpdatePlanInput = z.infer<typeof UpdatePlanSchema>;

// Body accepted by PATCH /api/placer-series/[id]. Pausing (active: false) stops
// new occurrences without touching the ones already on the calendar; editing the
// pattern regenerates future, unreleased occurrences.
export const UpdateSeriesSchema = z.object({
  active: z.boolean().optional(),
  endDate: optionalDate,
  leadDays: z.coerce.number().int().min(0).max(365).optional(),
  assignedToId: z.string().nullable().optional(),
  placeName: z.string().trim().min(1).optional(),
  purpose: optionalText,
});
export type UpdateSeriesInput = z.infer<typeof UpdateSeriesSchema>;
