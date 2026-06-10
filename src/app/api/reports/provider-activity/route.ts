import { NextRequest, NextResponse } from "next/server";
import { providerActivityReport, parseFilters } from "@/lib/reports/data";
import { providerActivityPdf } from "@/lib/reports/pdf";
import { providerActivityXlsx } from "@/lib/reports/excel";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  const dimension = params.get("dimension") === "water" ? "water" : "electric";
  const filters = parseFilters(params);
  const report = await providerActivityReport(filters, dimension);

  const file = `${dimension}-provider-activity`;

  if (format === "pdf") {
    const buf = await providerActivityPdf(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${file}.pdf"`,
      },
    });
  }
  if (format === "xlsx") {
    const buf = await providerActivityXlsx(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file}.xlsx"`,
      },
    });
  }
  return NextResponse.json(report);
}
