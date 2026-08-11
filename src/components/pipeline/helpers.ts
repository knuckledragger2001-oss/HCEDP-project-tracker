import type { PipelineStageValue } from "@/lib/projects/schema";

export interface BoardProject {
  id: string;
  codename: string;
  stage: PipelineStageValue;
  naicsCode: string | null;
  industryDescription: string | null;
  jobs: number | null;
  minAcreage: number | null;
  minBuildingSqFt: number | null;
  capexTotal: string | null;
  rfiReceivedDate: string | null;
  responseDueDate: string | null;
  responseSubmittedDate: string | null;
  siteVisitDate: string | null;
  archived: boolean;
  submissionCount: number;
}

export type DateMode = "all" | "month" | "quarter" | "fy" | "custom";
export type ArchiveMode = "active" | "archived" | "all";

// Flags an overdue / imminent response due date, but only while the project is
// still awaiting a response (RFI Received or Pending Information). Returns
// "overdue" once the due date has passed, "soon" within one calendar day.
export function dueUrgency(p: BoardProject): "overdue" | "soon" | null {
  if (p.stage !== "RFI_RECEIVED" && p.stage !== "PENDING_INFORMATION") return null;
  if (!p.responseDueDate) return null;
  const due = new Date(p.responseDueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "soon";
  return null;
}

// Returns the most contextually relevant date label + value for a given stage.
export function stageDate(p: BoardProject): { label: string; date: string } | null {
  switch (p.stage) {
    case "RFI_RECEIVED":
    case "PENDING_INFORMATION":
      return p.responseDueDate ? { label: "Due", date: p.responseDueDate } : null;
    case "RFI_SUBMITTED":
    case "SHORTLISTED":
      if (p.responseSubmittedDate) return { label: "Submitted", date: p.responseSubmittedDate };
      if (p.responseDueDate) return { label: "Due", date: p.responseDueDate };
      return null;
    case "SITE_VISIT":
    case "IN_NEGOTIATIONS":
      if (p.siteVisitDate) return { label: "Site visit", date: p.siteVisitDate };
      if (p.responseSubmittedDate) return { label: "Submitted", date: p.responseSubmittedDate };
      return null;
    default:
      return null;
  }
}

export function periodBounds(
  mode: DateMode,
  customStart: string,
  customEnd: string,
): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (mode) {
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    case "quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), qStartMonth, 1), end: null };
    }
    case "fy":
      return {
        start:
          now.getMonth() >= 9
            ? new Date(now.getFullYear(), 9, 1)
            : new Date(now.getFullYear() - 1, 9, 1),
        end: null,
      };
    case "custom":
      return {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(customEnd + "T23:59:59") : null,
      };
    default:
      return { start: null, end: null };
  }
}
