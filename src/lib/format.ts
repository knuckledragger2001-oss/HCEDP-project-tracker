import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";

export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.label]),
);

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  SITE_VISIT: "Site Visit",
  WON: "Won",
  LOST: "Lost",
  WITHDRAWN: "Withdrawn",
};

// Order here defines the dropdown order everywhere lead source is chosen. These
// are the only options offered for new/edited records.
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  TEXAS_GOVERNORS_OFFICE: "Governor's Office",
  OPPORTUNITY_AUSTIN: "Opportunity Austin",
  DIRECT_COMPANY: "Direct - Company",
  DIRECT_REGIONAL_PARTNERS: "Direct - Regional Partners",
  DIRECT_SITE_SELECTOR: "Direct - Site Selector",
  DIRECT_BROKER: "Direct - Broker",
  DIRECT_MARKETING_TRIP: "Direct - HCEDP Marketing Trip",
  DIRECT_OTHER: "Direct - Other",
};

// Retired enum values kept only so existing rows display sensibly. Not offered
// in the dropdown. See prisma/schema.prisma LeadSource.
const LEGACY_LEAD_SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Direct (legacy)",
  OTHER: "Other (legacy)",
};

// Human label for any lead-source value, current or legacy.
export function leadSourceLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LEAD_SOURCE_LABELS[value] ?? LEGACY_LEAD_SOURCE_LABELS[value] ?? value;
}

// True for the retired values (used to fold a legacy option into an edit
// dropdown so the current value stays visible and selectable).
export function isLegacyLeadSource(value: string | null | undefined): boolean {
  return !!value && value in LEGACY_LEAD_SOURCE_LABELS;
}

// The lead source that keeps the free-text "other" note field visible.
export const LEAD_SOURCE_OTHER_VALUE = "DIRECT_OTHER";

// Tri-state requirement (existing building, rail). Order defines dropdown order.
export const REQUIREMENT_PREFERENCE_LABELS: Record<string, string> = {
  YES: "Yes",
  NO: "No",
  PREFERRED: "Preferred",
};

export const REAL_ESTATE_TYPE_LABELS: Record<string, string> = {
  INDUSTRIAL_GREENFIELD: "Industrial Greenfield",
  BROWNFIELD: "Brownfield",
  SPEC_INDUSTRIAL: "Spec Industrial",
  MIXED_USE: "Mixed Use",
  OFFICE: "Office",
};

export const REAL_ESTATE_TYPES = Object.keys(REAL_ESTATE_TYPE_LABELS);

export function stageBadgeClass(stage: PipelineStageValue | string): string {
  switch (stage) {
    case "RFI_RECEIVED":
      return "bg-gray-100 text-gray-700";
    case "PENDING_INFORMATION":
      return "bg-amber-100 text-amber-800";
    case "RFI_SUBMITTED":
      return "bg-blue-100 text-blue-800";
    case "SHORTLISTED":
      return "bg-indigo-100 text-indigo-800";
    case "SITE_VISIT":
      return "bg-purple-100 text-purple-800";
    case "IN_NEGOTIATIONS":
      return "bg-teal-100 text-teal-800";
    case "WON":
      return "bg-green-100 text-green-800";
    case "LOST":
      return "bg-red-100 text-red-700";
    case "NO_SUBMISSION":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Accent hex per stage — used for the board card's left bar and column dots so
// each stage reads as visually distinct at a glance. Harmonized with the brand.
export function stageColor(stage: PipelineStageValue | string): string {
  switch (stage) {
    case "RFI_RECEIVED":
      return "#94a3b8"; // slate
    case "PENDING_INFORMATION":
      return "#d9a441"; // amber
    case "RFI_SUBMITTED":
      return "#6ba7c1"; // brand blue
    case "SHORTLISTED":
      return "#6366f1"; // indigo
    case "SITE_VISIT":
      return "#8b5cf6"; // violet
    case "IN_NEGOTIATIONS":
      return "#0d9488"; // teal
    case "WON":
      return "#174c34"; // brand green
    case "LOST":
      return "#dc2626"; // red
    case "NO_SUBMISSION":
      return "#64748b"; // slate-600
    default:
      return "#94a3b8";
  }
}

export function formatCurrency(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(
  value: number | string | null | undefined,
  opts?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", opts).format(n);
}

// Formats a DATE-ONLY value (rfiReceivedDate, responseDueDate, submissionDate,
// siteVisitDate, utility datapoint date, …). These are calendar dates with no
// meaningful time-of-day: they enter via <input type="date"> ("YYYY-MM-DD") and
// are stored as UTC midnight (see toDate in lib/projects/create.ts). We must
// therefore render them in UTC — otherwise a viewer/server west of UTC (e.g.
// US Central) sees the previous day ("Oct 8" → "Oct 7"). This matches how
// toDateInputValue (toISOString) and quarterOf (getUTC*) already interpret them.
// For real timestamps (createdAt, changedAt, lastLoginAt) use formatTimestamp.
export function formatDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Formats a true point-in-time (createdAt, changedAt, lastLoginAt) as its
// calendar date in the local zone. Unlike formatDate these carry a real
// time-of-day, so forcing UTC would misreport a late-evening event as the next
// day; the viewer's/server's own zone is the intended reading.
export function formatTimestamp(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// For <input type="date"> values (YYYY-MM-DD).
export function toDateInputValue(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function quarterOf(date: Date): { year: number; quarter: number } {
  return { year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1 };
}
