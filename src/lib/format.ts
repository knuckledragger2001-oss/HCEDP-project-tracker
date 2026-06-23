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
