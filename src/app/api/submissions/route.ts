import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SubmissionStatusEnum = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "SITE_VISIT",
  "WON",
  "LOST",
  "WITHDRAWN",
]);

const CreateSubmissionSchema = z.object({
  projectId: z.string().min(1),
  siteId: z.string().min(1),
  submissionDate: z.string().nullable().optional(),
  status: SubmissionStatusEnum.optional(),
  outcomeNote: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const date = d.submissionDate ? new Date(d.submissionDate) : new Date();

  try {
    const submission = await prisma.submission.create({
      data: {
        projectId: d.projectId,
        siteId: d.siteId,
        submissionDate: isNaN(date.getTime()) ? new Date() : date,
        status: d.status ?? "SUBMITTED",
        outcomeNote: d.outcomeNote ?? null,
      },
      include: { site: { include: { community: true } } },
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    // Unique [projectId, siteId] violation -> friendly message.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That site is already submitted for this project." },
        { status: 409 },
      );
    }
    throw err;
  }
}

const UpdateSubmissionSchema = z.object({
  id: z.string().min(1),
  status: SubmissionStatusEnum.optional(),
  outcomeNote: z.string().nullable().optional(),
  submissionDate: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = UpdateSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }
  const d = parsed.data;
  const submission = await prisma.submission.update({
    where: { id: d.id },
    data: {
      status: d.status,
      outcomeNote: d.outcomeNote ?? undefined,
      submissionDate: d.submissionDate ? new Date(d.submissionDate) : undefined,
    },
    include: { site: { include: { community: true } } },
  });
  return NextResponse.json({ submission });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.submission.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
