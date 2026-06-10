import { NextRequest, NextResponse } from "next/server";
import { quarterlySummaryReport, parseFilters } from "@/lib/reports/data";
import { quarterlyPdf } from "@/lib/reports/pdf";
import { quarterlyXlsx } from "@/lib/reports/excel";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  const filters = parseFilters(params);
  const report = await quarterlySummaryReport(filters);

  if (format === "pdf") {
    const buf = await quarterlyPdf(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quarterly-summary.pdf"`,
      },
    });
  }
  if (format === "xlsx") {
    const buf = await quarterlyXlsx(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="quarterly-summary.xlsx"`,
      },
    });
  }
  return NextResponse.json(report);
}
