import { spawn } from "node:child_process";
import path from "node:path";
import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import {
  type CityActivityProject,
  type CityActivityReport,
  type LeadSourceReport,
  type ProviderActivityReport,
  type QuarterlyReport,
  type SiteVisitReport,
  type ReportFilterLabels,
} from "@/lib/reports/data";
import { type DashboardReport } from "@/lib/reports/dashboard";
import { layoutSankey } from "@/lib/reports/sankeyLayout";
import { STAGE_LABELS } from "@/lib/format";
import { NAICS_BY_CODE } from "@/lib/naics";

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
// Ribbon fill on the dashboard's Sankey. Matches the on-screen chart.
const ACCENT = "#6ba7c1";

function header(title: string, filters: ReportFilterLabels): Content[] {
  return [
    { text: "HCEDP Projects Tracker", style: "kicker" },
    { text: title, style: "h1" },
    {
      style: "filters",
      columns: [
        { text: `Community: ${filters.community}` },
        { text: `County: ${filters.county}` },
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
  // The community or stakeholder a report was run for, under the report title.
  reportSubject: {
    fontSize: 12,
    color: BRAND,
    margin: [0, 0, 0, 6] as [number, number, number, number],
  },
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

// NAICS as "code — official description". Never the free-text industry blurb,
// which can carry company-identifying detail (e.g. "UK-based company").
function naicsLabel(code: string | null): string | null {
  if (!code) return null;
  const desc = NAICS_BY_CODE[code];
  return desc ? `NAICS ${code} — ${desc}` : `NAICS ${code}`;
}

// Shared per-project block for the city/provider reports: name, stage, active
// date and NAICS, then a small capex/jobs/wage table and the site names. No
// acreage, no per-site status, no narrative.
function projectBlocks(p: CityActivityProject): Content[] {
  const meta = [
    STAGE_LABELS[p.stage] ?? p.stage,
    p.rfiReceivedDate
      ? `Active ${new Date(p.rfiReceivedDate).toLocaleDateString("en-US")}`
      : null,
    naicsLabel(p.naicsCode),
  ].filter(Boolean) as string[];

  return [
    { text: p.codename, style: "project" },
    { text: meta.join("  ·  "), style: "meta" },
    {
      table: {
        headerRows: 1,
        widths: ["auto", "auto", "auto"],
        body: [
          [
            { text: "Capex", style: "th", alignment: "right" },
            { text: "Jobs", style: "th", alignment: "right" },
            { text: "Avg wage", style: "th", alignment: "right" },
          ],
          [
            { text: usd(p.capexTotal), style: "td", alignment: "right" },
            { text: count(p.jobs), style: "td", alignment: "right" },
            { text: usd(p.avgWage), style: "td", alignment: "right" },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 2, 0, 2] as [number, number, number, number],
    },
    {
      text: `Sites: ${p.sites.map((s) => s.siteName).join(", ") || "—"}`,
      style: "td",
      margin: [0, 0, 0, 6] as [number, number, number, number],
    },
  ];
}

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
      content.push(...projectBlocks(p));
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
      content.push(...projectBlocks(p));
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

// ---------------------------------------------------------------------------
// Roll-up dashboard
//
// The on-screen dashboard uses Recharts, which renders in the browser and has no
// server-side equivalent here. Rather than ship a second chart runtime for
// export, both charts are drawn with pdfmake's vector canvas: the month chart as
// plain columns, and the Sankey from the shared geometry in sankeyLayout.ts.
//
// pdfmake's canvas cannot draw text, so stage names are emitted as an ordinary
// equal-width `columns` row above the diagram. That only lines up because the
// layout gives every stage its own equal-width column — see sankeyLayout.ts.
// ---------------------------------------------------------------------------

const CHART_WIDTH = 515;
const CHART_HEIGHT = 120;
const SANKEY_HEIGHT = 230;

function usd(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function count(value: number | null, fractionDigits = 0): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: fractionDigits });
}

// A plain column chart: one bar per month, scaled to the tallest.
function monthBarChart(months: DashboardReport["rfisByMonth"]): Content {
  if (months.length === 0) {
    return { text: "No RFIs in this period.", style: "empty" };
  }
  const peak = Math.max(...months.map((m) => m.received), 1);
  const slot = CHART_WIDTH / months.length;
  const barWidth = Math.min(28, Math.max(4, slot - 6));

  const canvas = months.map((m, i) => {
    const height = (m.received / peak) * CHART_HEIGHT;
    return {
      type: "rect" as const,
      x: i * slot + (slot - barWidth) / 2,
      y: CHART_HEIGHT - height,
      w: barWidth,
      h: height,
      color: BRAND,
    };
  });
  canvas.push({
    type: "rect" as const,
    x: 0,
    y: CHART_HEIGHT,
    w: CHART_WIDTH,
    h: 0.5,
    color: "#999",
  });

  // Only label every nth month once they get tight, or they overprint.
  const step = Math.ceil(months.length / 12);
  const labels = months
    .filter((_, i) => i % step === 0)
    .map((m) => ({ text: m.label, style: "meta", width: slot * step }));

  return {
    stack: [
      { canvas, margin: [0, 4, 0, 2] as [number, number, number, number] },
      { columns: labels, columnGap: 0 },
      { text: `Peak: ${peak} RFI${peak === 1 ? "" : "s"} in a month`, style: "meta" },
    ],
  };
}

// The Sankey: stage labels above, then ribbons and node bars on one canvas.
function sankeyChart(sankey: DashboardReport["sankey"]): Content {
  if (sankey.links.length === 0) {
    return { text: "No stage progression in this period.", style: "empty" };
  }

  const geo = layoutSankey(sankey, {
    width: CHART_WIDTH,
    height: SANKEY_HEIGHT,
    nodeWidth: 9,
    curveSteps: 24,
  });

  const ribbons = geo.ribbons.map((r) => ({
    type: "polyline" as const,
    closePath: true,
    points: r.points,
    color: ACCENT,
    fillOpacity: 0.3,
    lineWidth: 0,
  }));
  const bars = geo.nodes.map((n) => ({
    type: "rect" as const,
    x: n.x,
    y: n.y,
    w: n.width,
    h: n.height,
    color: BRAND,
  }));

  return {
    stack: [
      {
        columns: geo.nodes.map((n) => ({
          width: geo.columnWidth,
          alignment: "center" as const,
          stack: [
            { text: n.name, fontSize: 6.5, color: "#374151" },
            { text: String(n.value), fontSize: 6.5, color: "#9ca3af" },
          ],
        })),
        columnGap: 0,
      },
      // Ribbons first so the node bars sit on top of them.
      {
        canvas: [...ribbons, ...bars],
        margin: [0, 2, 0, 4] as [number, number, number, number],
      },
    ],
  };
}

export async function dashboardPdf(report: DashboardReport): Promise<Buffer> {
  const { rates, summary, sankey } = report;

  // A dashboard-specific header. The stakeholder or community this was run for
  // is the headline — these get printed and handed across a table.
  const content: Content[] = [
    { text: "HCEDP Projects Report", style: "h1" },
    { text: report.filters.community, style: "reportSubject" },
    {
      style: "filters",
      columns: [
        { text: `Period: ${report.filters.period}` },
        { text: `NAICS: ${report.filters.naics}` },
        { text: `Stage: ${report.filters.stage}` },
      ],
    },
    {
      canvas: [
        { type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 1, lineColor: BRAND },
      ],
      margin: [0, 4, 0, 10] as [number, number, number, number],
    },
  ];

  const tile = (label: string, value: string): TableCell => ({
    stack: [
      { text: value, fontSize: 14, bold: true, color: BRAND },
      { text: label, fontSize: 7, color: "#666" },
    ],
    margin: [4, 6, 4, 6] as [number, number, number, number],
  });

  // Win rates are deliberately absent. Projects take years to close, so a rate
  // computed over an arbitrary reporting window reads as a low score rather than
  // as a pipeline still in progress. The counts below say the same thing without
  // inviting that reading.
  content.push({
    table: {
      widths: ["*", "*", "*", "*"],
      body: [
        [
          tile("RFIs received", count(rates.received)),
          tile("Responses submitted", count(rates.submitted)),
          tile("Still open", count(rates.open)),
          tile("No submission", count(rates.noSubmission)),
        ],
        [
          tile("Won", count(rates.won)),
          tile("Lost", count(rates.lost)),
          tile("Total capex", usd(summary.capexTotal)),
          tile("Average capex", usd(summary.capexAverage)),
        ],
        [
          tile("Total jobs", count(summary.jobsTotal)),
          tile("Average jobs per project", count(summary.jobsAverage, 1)),
          tile("Average wage", usd(summary.avgWage)),
          tile("Acreage sought", count(summary.acreageTotal)),
        ],
        [
          tile("Site submissions", count(summary.submissions)),
          tile("Site visits", count(summary.siteVisits)),
          tile("", ""),
          tile("", ""),
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  });

  content.push({ text: "RFIs received by month", style: "community" });
  content.push(monthBarChart(report.rfisByMonth));

  content.push({ text: "Stage progression", style: "community" });
  content.push({
    text: "Each project is charted along its furthest linear path; one that moved backwards and advanced again is drawn as a single clean run.",
    style: "meta",
  });
  content.push(sankeyChart(sankey));
  if (sankey.projectsWithBackwardMoves > 0) {
    content.push({
      text: `${sankey.projectsWithBackwardMoves} project${sankey.projectsWithBackwardMoves === 1 ? "" : "s"} moved backwards at some point.`,
      style: "meta",
    });
  }

  const breakdownTable = (
    title: string,
    rows: DashboardReport["byIndustry"],
  ): Content[] => [
    { text: title, style: "community" },
    rows.length === 0
      ? { text: "No projects match these filters.", style: "empty" }
      : {
          table: {
            headerRows: 1,
            widths: ["*", "auto"],
            body: [
              [
                { text: "Name", style: "th" },
                { text: "Projects", style: "th" },
              ],
              ...rows.map((r) => [
                { text: r.label, style: "td" },
                { text: String(r.count), style: "td" },
              ]),
            ],
          },
          layout: "lightHorizontalLines",
        },
  ];

  content.push(...breakdownTable("Top industries", report.byIndustry));
  content.push(...breakdownTable("Lead source", report.byLeadSource));

  return toBuffer({
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
    defaultStyle: { font: "Roboto", fontSize: 9 },
  });
}
