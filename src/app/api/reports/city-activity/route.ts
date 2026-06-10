import { NextRequest, NextResponse } from "next/server";
import { cityActivityReport, parseFilters } from "@/lib/reports/data";
import { cityActivityPdf } from "@/lib/reports/pdf";
import { cityActivityXlsx } from "@/lib/reports/excel";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  const filters = parseFilters(params);
  const report = await cityActivityReport(filters);

  if (format === "pdf") {
    const buf = await cityActivityPdf(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="city-activity.pdf"`,
      },
    });
  }
  if (format === "xlsx") {
    const buf = await cityActivityXlsx(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="city-activity.xlsx"`,
      },
    });
  }
  return NextResponse.json(report);
}
