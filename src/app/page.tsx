import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Board from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
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
      archivedAt: true,
      _count: { select: { submissions: true } },
    },
  });

  // Decimal -> string for the client component.
  const data = projects.map((p) => ({
    id: p.id,
    codename: p.codename,
    stage: p.stage,
    naicsCode: p.naicsCode,
    industryDescription: p.industryDescription,
    minAcreage: p.minAcreage,
    capexTotal: p.capexTotal ? p.capexTotal.toString() : null,
    rfiReceivedDate: p.rfiReceivedDate ? p.rfiReceivedDate.toISOString() : null,
    responseDueDate: p.responseDueDate ? p.responseDueDate.toISOString() : null,
    archived: p.archivedAt != null,
    submissionCount: p._count.submissions,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">
            Drag a card between columns to change stage.
          </p>
        </div>
        <Link href="/intake" className="btn-primary">
          + New RFI
        </Link>
      </div>
      <Board initialProjects={data} />
    </div>
  );
}
