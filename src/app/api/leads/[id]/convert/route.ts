import { NextRequest, NextResponse } from "next/server";
import { convertLeadToProject, LeadConversionError } from "@/lib/leads/convert";

export const runtime = "nodejs";

// Convert a lead into a full project. The lead survives as a CONVERTED record
// pointing at the new project — see src/lib/leads/convert.ts.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const project = await convertLeadToProject(id);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if (err instanceof LeadConversionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
