import { NextRequest, NextResponse } from "next/server";
import { leadSourceReport, parseFilters } from "@/lib/reports/data";
import { leadSourcePdf } from "@/lib/reports/pdf";
import { leadSourceXlsx } from "@/lib/reports/excel";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  const filters = parseFilters(params);
  const report = await leadSourceReport(filters);

  if (format === "pdf") {
    const buf = await leadSourcePdf(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lead-source-summary.pdf"`,
      },
    });
  }
  if (format === "xlsx") {
    const buf = await leadSourceXlsx(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lead-source-summary.xlsx"`,
      },
    });
  }
  return NextResponse.json(report);
}
