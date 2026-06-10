import ExcelJS from "exceljs";
import {
  type CityActivityReport,
  type LeadSourceReport,
  type ProviderActivityReport,
  type QuarterlyReport,
  type ReportFilterLabels,
} from "@/lib/reports/data";
import { STAGE_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/format";

const BRAND = "FF2F6B4F";

function writeFilterBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  filters: ReportFilterLabels,
) {
  ws.addRow([title]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([`Community: ${filters.community}`]);
  ws.addRow([`Period: ${filters.period}`]);
  ws.addRow([`NAICS: ${filters.naics}`]);
  ws.addRow([`Stage: ${filters.stage}`]);
  ws.addRow([]);
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND },
    };
  });
}

export async function cityActivityXlsx(
  report: CityActivityReport,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HCEDP Projects Tracker";
  const ws = wb.addWorksheet("City Activity");

  writeFilterBlock(ws, "City Activity Report", report.filters);

  const headerRow = ws.addRow([
    "Community",
    "Project",
    "Stage",
    "NAICS",
    "Industry",
    "Site",
    "Acreage",
    "Submitted",
    "Status",
    "Outcome",
  ]);
  styleHeader(headerRow);

  for (const c of report.communities) {
    for (const p of c.projects) {
      for (const s of p.sites) {
        ws.addRow([
          c.communityName,
          p.codename,
          STAGE_LABELS[p.stage] ?? p.stage,
          p.naicsCode ?? "",
          p.industryDescription ?? "",
          s.siteName,
          s.acreage ?? "",
          new Date(s.submissionDate),
          SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
          s.outcomeNote ?? "",
        ]);
      }
    }
  }

  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 50);
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function providerActivityXlsx(
  report: ProviderActivityReport,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HCEDP Projects Tracker";
  const dimLabel = report.dimension === "electric" ? "Electric" : "Water";
  const ws = wb.addWorksheet(`${dimLabel} Provider Activity`);

  writeFilterBlock(ws, `${dimLabel} Provider Activity`, report.filters);

  const headerRow = ws.addRow([
    `${dimLabel} Provider`,
    "Project",
    "Stage",
    "NAICS",
    "Industry",
    "Site",
    "Acreage",
    "Submitted",
    "Status",
    "Outcome",
  ]);
  styleHeader(headerRow);

  for (const g of report.groups) {
    for (const p of g.projects) {
      for (const s of p.sites) {
        ws.addRow([
          g.providerName,
          p.codename,
          STAGE_LABELS[p.stage] ?? p.stage,
          p.naicsCode ?? "",
          p.industryDescription ?? "",
          s.siteName,
          s.acreage ?? "",
          new Date(s.submissionDate),
          SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
          s.outcomeNote ?? "",
        ]);
      }
    }
  }

  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 50);
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function quarterlyXlsx(report: QuarterlyReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HCEDP Projects Tracker";
  const ws = wb.addWorksheet("Quarterly Summary");

  writeFilterBlock(ws, "Quarterly Submission Summary", report.filters);

  const headerRow = ws.addRow([
    "Community",
    "Submissions",
    "Projects",
    "Active",
    "Won",
    "Lost",
  ]);
  styleHeader(headerRow);

  for (const r of report.rows) {
    ws.addRow([
      r.communityName,
      r.submissions,
      r.projects,
      r.active,
      r.won,
      r.lost,
    ]);
  }
  const totalRow = ws.addRow([
    "Total",
    report.totals.submissions,
    report.totals.projects,
    report.totals.active,
    report.totals.won,
    report.totals.lost,
  ]);
  totalRow.font = { bold: true };

  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = max + 2;
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}
function days(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)}`;
}

export async function leadSourceXlsx(report: LeadSourceReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HCEDP Projects Tracker";
  const ws = wb.addWorksheet("Lead Source Summary");

  writeFilterBlock(ws, "Lead Source Summary", report.filters);

  const headerRow = ws.addRow([
    "Lead Source",
    "Projects",
    "Won",
    "Lost",
    "Active",
    "Win Rate",
    "Avg Days to Submit",
    "Peak Jobs",
    "Avg Acreage",
    "Industries",
  ]);
  styleHeader(headerRow);

  for (const r of report.rows) {
    ws.addRow([
      r.leadSourceLabel,
      r.projects,
      r.won,
      r.lost,
      r.active,
      pct(r.successRate),
      days(r.avgDaysToSubmit),
      r.peakJobs,
      r.avgAcreage == null ? "" : Math.round(r.avgAcreage),
      r.industries,
    ]);
  }
  const totalRow = ws.addRow([
    "Total",
    report.totals.projects,
    report.totals.won,
    report.totals.lost,
    report.totals.active,
    "",
    "",
    report.totals.peakJobs,
    "",
    "",
  ]);
  totalRow.font = { bold: true };

  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = max + 2;
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
