import { NextRequest, NextResponse } from "next/server";
import { siteVisitReport, parseFilters } from "@/lib/reports/data";
import { siteVisitPdf } from "@/lib/reports/pdf";
import { siteVisitXlsx } from "@/lib/reports/excel";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  const filters = parseFilters(params);
  const report = await siteVisitReport(filters);

  if (format === "pdf") {
    const buf = await siteVisitPdf(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="site-visit-activity.pdf"`,
      },
    });
  }
  if (format === "xlsx") {
    const buf = await siteVisitXlsx(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="site-visit-activity.xlsx"`,
      },
    });
  }
  return NextResponse.json(report);
}
