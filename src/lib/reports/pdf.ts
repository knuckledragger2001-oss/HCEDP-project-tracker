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
  type QuarterlyReport,
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
