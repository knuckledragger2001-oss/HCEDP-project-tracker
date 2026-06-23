import { spawn } from "node:child_process";
import path from "node:path";
import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import {
  type CityActivityReport,
  type LeadSourceReport,
  type ProviderActivityReport,
  type QuarterlyReport,
  type SiteVisitReport,
  type ReportFilterLabels,
} from "@/lib/reports/data";
import { STAGE_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/format";

// pdfmake's PDFKit/fontkit font loading breaks when bundled by Next/Turbopack
// (its __dirname-relative reads are rewritten to a numeric module id). So the
// layout is built here as a plain serializable document definition, then handed
// to scripts/pdf-render.cjs — a separate Node process that loads pdfmake from
// real node_modules and emits the PDF bytes. See that file for details.
const RENDERER = path.join(process.cwd(), "scripts", "pdf-render.cjs");

async function toBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  const generated = new Date().toLocaleString("en-US");
  const payload = JSON.stringify({ docDefinition, generated });

  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(process.execPath, [RENDERER], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(out));
      } else {
        reject(
          new Error(
            `pdf-render exited with code ${code}: ${Buffer.concat(err).toString()}`,
          ),
        );
      }
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}

const BRAND = "#2f6b4f";

function header(title: string, filters: ReportFilterLabels): Content[] {
  return [
    { text: "HCEDP Projects Tracker", style: "kicker" },
    { text: title, style: "h1" },
    {
      style: "filters",
      columns: [
        { text: `Community: ${filters.community}` },
        { text: `Period: ${filters.period}` },
        { text: `NAICS: ${filters.naics}` },
        { text: `Stage: ${filters.stage}` },
      ],
    },
    {
      canvas: [
        { type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 1, lineColor: BRAND },
      ],
      margin: [0, 4, 0, 10] as [number, number, number, number],
    },
  ];
}

const styles: StyleDictionary = {
  kicker: { fontSize: 8, color: BRAND, bold: true, characterSpacing: 1 },
  h1: { fontSize: 18, bold: true, margin: [0, 2, 0, 6] as [number, number, number, number] },
  filters: { fontSize: 8, color: "#555", margin: [0, 0, 0, 2] as [number, number, number, number] },
  community: {
    fontSize: 13,
    bold: true,
    color: BRAND,
    margin: [0, 10, 0, 4] as [number, number, number, number],
  },
  project: { fontSize: 11, bold: true, margin: [0, 6, 0, 2] as [number, number, number, number] },
  meta: { fontSize: 8, color: "#666", margin: [0, 0, 0, 2] as [number, number, number, number] },
  th: { bold: true, fontSize: 8, color: "#444", fillColor: "#f3f4f6" },
  td: { fontSize: 8 },
  empty: { fontSize: 9, italics: true, color: "#888" },
};

export async function cityActivityPdf(
  report: CityActivityReport,
): Promise<Buffer> {
  const content: Content[] = [...header("City Activity Report", report.filters)];

  if (report.communities.length === 0) {
    content.push({ text: "No submissions match these filters.", style: "empty" });
  }

  for (const c of report.communities) {
    content.push({
      text: `${c.communityName}  ·  ${c.projectCount} project${c.projectCount === 1 ? "" : "s"}, ${c.submissionCount} submission${c.submissionCount === 1 ? "" : "s"}`,
      style: "community",
    });
    for (const p of c.projects) {
      content.push({ text: p.codename, style: "project" });
      const metaParts = [
        STAGE_LABELS[p.stage] ?? p.stage,
        p.naicsCode ? `NAICS ${p.naicsCode}` : null,
        p.industryDescription,
      ].filter(Boolean);
      content.push({ text: metaParts.join("  ·  "), style: "meta" });
      content.push({
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "*"],
          body: [
            [
              { text: "Site", style: "th" },
              { text: "Acreage", style: "th" },
              { text: "Submitted", style: "th" },
              { text: "Status", style: "th" },
            ],
            ...p.sites.map((s) => [
              { text: s.siteName, style: "td" },
              {
                text: s.acreage != null ? `${s.acreage} ac` : "—",
                style: "td",
              },
              {
                text: new Date(s.submissionDate).toLocaleDateString("en-US"),
                style: "td",
              },
              {
                text: SUBMISSION_STATUS_LABELS[s.status] ?? s.status,
                style: "td",
              },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 2, 0, 4] as [number, number, number, number],
      });
    }
  }

  return toBuffer({
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
    defaultStyle: { font: "Roboto", fontSize: 9 },
  });
}

export async function providerActivityPdf(
  report: ProviderActivityReport,
): Promise<Buffer> {
  const dimLabel = report.dimension === "electric" ? "Electric" : "Water";
  const content: Content[] = [
    ...header(`${dimLabel} Provider Activity`, report.filters),
  ];

  if (report.groups.length === 0) {
    content.push({ text: "No submissions match these filters.", style: "empty" });
  }

  for (const g of report.groups) {
    content.push({
      text: `${g.providerName}  ·  ${g.projectCount} project${g.projectCount === 1 ? "" : "s"}, ${g.submissionCount} submission${g.submissionCount === 1 ? "" : "s"}`,
      style: "community",
    });
    for (const p of g.projects) {
      content.push({ text: p.codename, style: "project" });
      const metaParts = [
        STAGE_LABELS[p.stage] ?? p.stage,
        p.naicsCode ? `NAICS ${p.naicsCode}` : null,
        p.industryDescription,
      ].filter(Boolean);
      content.push({ text: metaParts.join("  ·  "), style: "meta" });
      content.push({
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "*"],
          body: [
            [
              { text: "Site", style: "th" },
              { text: "Acreage", style: "th" },
              { text: "Submitted", style: "th" },
              { text: "Status", style: "th" },
            ],
            ...p.sites.map((s) => [
              { text: s.siteName, style: "td" },
              { text: s.acreage != null ? `${s.acreage} ac` : "—", style: "td" },
              {
                text: new Date(s.submissionDate).toLocaleDateString("en-US"),
                style: "td",
              },
              { text: SUBMISSION_STATUS_LABELS[s.status] ?? s.status, style: "td" },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 2, 0, 4] as [number, number, number, number],
      });
    }
  }

  return toBuffer({
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
    defaultStyle: { font: "Roboto", fontSize: 9 },
  });
}

export async function leadSourcePdf(
  report: LeadSourceReport,
): Promise<Buffer> {
  const pct = (v: number | null) =>
    v == null ? "—" : `${Math.round(v * 100)}%`;
  const days = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);
  const acre = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);
  const cell = (text: string, total = false): TableCell => ({
    text,
    style: total ? undefined : "td",
    alignment: "right",
    bold: total ? true : undefined,
    fontSize: total ? 8 : undefined,
  });

  const body: TableCell[][] = [
    [
      { text: "Lead Source", style: "th" },
      { text: "Projects", style: "th", alignment: "right" },
      { text: "Won", style: "th", alignment: "right" },
      { text: "Lost", style: "th", alignment: "right" },
      { text: "Active", style: "th", alignment: "right" },
      { text: "Win Rate", style: "th", alignment: "right" },
      { text: "Avg Days", style: "th", alignment: "right" },
      { text: "Peak Jobs", style: "th", alignment: "right" },
      { text: "Avg Acres", style: "th", alignment: "right" },
      { text: "Industries", style: "th", alignment: "right" },
    ],
    ...report.rows.map((r): TableCell[] => [
      { text: r.leadSourceLabel, style: "td" },
      cell(String(r.projects)),
      cell(String(r.won)),
      cell(String(r.lost)),
      cell(String(r.active)),
      cell(pct(r.successRate)),
      cell(days(r.avgDaysToSubmit)),
      cell(String(r.peakJobs)),
      cell(acre(r.avgAcreage)),
      cell(String(r.industries)),
    ]),
    [
      { text: "Total", bold: true, fontSize: 8 },
      cell(String(report.totals.projects), true),
      cell(String(report.totals.won), true),
      cell(String(report.totals.lost), true),
      cell(String(report.totals.active), true),
      cell("", true),
      cell("", true),
      cell(String(report.totals.peakJobs), true),
      cell("", true),
      cell("", true),
    ],
  ];

  const content: Content[] = [
    ...header("Lead Source Summary", report.filters),
  ];
  if (report.rows.length === 0) {
    content.push({ text: "No projects match these filters.", style: "empty" });
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
        body,
      },
      layout: "lightHorizontalLines",
    });
  }

  return toBuffer({
    pageMargins: [30, 40, 30, 40],
    pageOrientation: "landscape",
    content,
    styles,
    defaultStyle: { font: "Roboto", fontSize: 9 },
  });
}

export async function siteVisitPdf(report: SiteVisitReport): Promise<Buffer> {
  const content: Content[] = [
    ...header("Site Visit Activity", report.filters),
  ];
  content.push({
    text: `${report.totals.projects} project${report.totals.projects === 1 ? "" : "s"} · ${report.totals.visits} site visit${report.totals.visits === 1 ? "" : "s"}`,
    style: "meta",
  });

  if (report.rows.length === 0) {
    content.push({
      text: "No site visits match these filters.",
      style: "empty",
    });
  }

  for (const r of report.rows) {
    content.push({ text: r.codename, style: "project" });
    const metaParts = [
      STAGE_LABELS[r.stage] ?? r.stage,
      r.naicsCode ? `NAICS ${r.naicsCode}` : null,
      r.companyLocation,
    ].filter(Boolean);
    content.push({ text: metaParts.join("  ·  "), style: "meta" });
    content.push({
      table: {
        headerRows: 1,
        widths: ["auto", "*"],
        body: [
          [
            { text: "Visit date", style: "th" },
            { text: "Note", style: "th" },
          ],
          ...r.visits.map((v): TableCell[] => [
            {
              text: new Date(v.date).toLocaleDateString("en-US"),
              style: "td",
            },
            { text: v.note ?? "—", style: "td" },
          ]),
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 2, 0, 4] as [number, number, number, number],
    });
  }

  return toBuffer({
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
    defaultStyle: { font: "Roboto", fontSize: 9 },
  });
}

export async function quarterlyPdf(report: QuarterlyReport): Promise<Buffer> {
  // Right-aligned numeric cell.
  const n = (value: number, total = false): TableCell => ({
    text: String(value),
    style: total ? undefined : "td",
    alignment: "right",
    bold: total ? true : undefined,
    fontSize: total ? 8 : undefined,
  });

  const body: TableCell[][] = [
    [
      { text: "Community", style: "th" },
      { text: "Submissions", style: "th", alignment: "right" },
      { text: "Projects", style: "th", alignment: "right" },
      { text: "Active", style: "th", alignment: "right" },
      { text: "Won", style: "th", alignment: "right" },
      { text: "Lost", style: "th", alignment: "right" },
    ],
    ...report.rows.map((r): TableCell[] => [
      { text: r.communityName, style: "td" },
      n(r.submissions),
      n(r.projects),
      n(r.active),
      n(r.won),
      n(r.lost),
    ]),
    [
      { text: "Total", bold: true, fontSize: 8 },
      n(report.totals.submissions, true),
      n(report.totals.projects, true),
      n(report.totals.active, true),
      n(report.totals.won, true),
      n(report.totals.lost, true),
    ],
  ];

  const content: Content[] = [
    ...header("Quarterly Submission Summary", report.filters),
  ];
  if (report.rows.length === 0) {
    content.push({ text: "No submissions match these filters.", style: "empty" });
  } else {
    content.push({
      table: { headerRows: 1, widths: ["*", "auto", "auto", "auto", "auto", "auto"], body },
      layout: "lightHorizontalLines",
    });
  }

  return toBuffer({
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
    defaultStyle: { font: "Roboto", fontSize: 9 },
  });
}
