import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SaveProjectSchema } from "@/lib/projects/schema";
import { createProjectFromProposal } from "@/lib/projects/create";

export const runtime = "nodejs";

// GET /api/projects — list for the board (lightweight columns).
export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      codename: true,
      stage: true,
      naicsCode: true,
      industryDescription: true,
      minAcreage: true,
      capexTotal: true,
      rfiReceivedDate: true,
      responseDueDate: true,
      updatedAt: true,
      _count: { select: { submissions: true } },
    },
  });
  return NextResponse.json({ projects });
}

// POST /api/projects — commit a reviewed proposal.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = SaveProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project payload", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const project = await createProjectFromProposal(parsed.data);
  return NextResponse.json({ project }, { status: 201 });
}
