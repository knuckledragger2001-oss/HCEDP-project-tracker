import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PipelineWorkspace from "@/components/pipeline/PipelineWorkspace";
import { NewRfiIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      codename: true,
      stage: true,
      naicsCode: true,
      industryDescription: true,
      jobs: true,
      minAcreage: true,
      minBuildingSqFt: true,
      capexTotal: true,
      rfiReceivedDate: true,
      responseDueDate: true,
      responseSubmittedDate: true,
      siteVisitDate: true,
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
    jobs: p.jobs,
    minAcreage: p.minAcreage,
    minBuildingSqFt: p.minBuildingSqFt,
    capexTotal: p.capexTotal ? p.capexTotal.toString() : null,
    rfiReceivedDate: p.rfiReceivedDate ? p.rfiReceivedDate.toISOString() : null,
    responseDueDate: p.responseDueDate ? p.responseDueDate.toISOString() : null,
    responseSubmittedDate: p.responseSubmittedDate ? p.responseSubmittedDate.toISOString() : null,
    siteVisitDate: p.siteVisitDate ? p.siteVisitDate.toISOString() : null,
    archived: p.archivedAt != null,
    submissionCount: p._count.submissions,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-muted">
            {data.length} project{data.length === 1 ? "" : "s"}. Drag cards on the
            board to change stage, or switch to the table to sort and scan.
          </p>
        </div>
        <Link href="/intake" className="btn-primary">
          <NewRfiIcon className="h-4 w-4" /> New RFI
        </Link>
      </div>
      <PipelineWorkspace initialProjects={data} />
    </div>
  );
}
