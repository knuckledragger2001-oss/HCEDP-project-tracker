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

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  TEXAS_GOVERNORS_OFFICE: "Texas Governor's Office",
  OPPORTUNITY_AUSTIN: "Opportunity Austin",
  DIRECT: "Direct",
  OTHER: "Other",
};

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
    case "WON":
      return "bg-green-100 text-green-800";
    case "LOST":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
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
