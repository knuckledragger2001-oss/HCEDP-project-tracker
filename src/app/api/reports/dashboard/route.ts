import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/reports/data";
import { dashboardReport } from "@/lib/reports/dashboard";
import { dashboardPdf } from "@/lib/reports/pdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  const filters = parseFilters(params);
  const report = await dashboardReport(filters);

  if (format === "pdf") {
    const buf = await dashboardPdf(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dashboard.pdf"`,
      },
    });
  }
  return NextResponse.json(report);
}
