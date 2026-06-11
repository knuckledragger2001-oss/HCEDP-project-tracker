import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StageProgress from "@/components/StageProgress";
import ProjectActions from "@/components/ProjectActions";
import SubmissionsPanel, {
  type SubmissionLite,
} from "@/components/SubmissionsPanel";
import {
  EditableHeader,
  EditableSourceDates,
  EditableInvestmentJobs,
  EditableSiteRequirements,
  EditableCriticalCriteria,
  EditableUtilities,
  EditableQualitative,
  EditableNotes,
} from "@/components/project/editable";
import { formatDate } from "@/lib/format";
import type { PipelineStageValue } from "@/lib/projects/schema";

export const dynamic = "force-dynamic";

// Prisma Decimal -> plain number (or null) for client components.
function dec(v: { toString(): string } | null): number | null {
  return v == null ? null : Number(v.toString());
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, communities, sites] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        stageHistory: { orderBy: { changedAt: "asc" } },
        jobPhases: { orderBy: { orderIndex: "asc" } },
        criticalCriteria: { orderBy: { rank: "asc" } },
        qualitativeNotes: true,
        utilities: { include: { datapoints: { orderBy: { date: "asc" } } } },
        attachments: true,
        submissions: {
          include: { site: { include: { community: true } } },
          orderBy: { submissionDate: "desc" },
        },
      },
    }),
    prisma.community.findMany({ orderBy: { order: "asc" } }),
    prisma.site.findMany({
      orderBy: { name: "asc" },
      include: { community: true },
    }),
  ]);

  if (!project) notFound();

  const submissions: SubmissionLite[] = project.submissions.map((s) => ({
    id: s.id,
    status: s.status,
    outcomeNote: s.outcomeNote,
    submissionDate: s.submissionDate.toISOString(),
    site: {
      id: s.site.id,
      name: s.site.name,
      community: { id: s.site.community.id, name: s.site.community.name },
    },
  }));

  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Back to board
        </Link>
        {project.archivedAt && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This project is archived — hidden from the board and reports. Use
            Unarchive to restore it.
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <EditableHeader
            projectId={project.id}
            codename={project.codename}
            industryDescription={project.industryDescription}
            naicsCode={project.naicsCode}
            projectType={project.projectType}
          />
          <ProjectActions
            projectId={project.id}
            codename={project.codename}
            archived={project.archivedAt != null}
          />
        </div>
        <div className="mt-3">
          <StageProgress
            projectId={project.id}
            stage={project.stage as PipelineStageValue}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <EditableSourceDates
          projectId={project.id}
          leadSource={project.leadSource}
          leadSourceOther={project.leadSourceOther}
          sourceContactName={project.sourceContactName}
          submissionDestination={project.submissionDestination}
          dates={{
            rfiReceivedDate: iso(project.rfiReceivedDate),
            responseDueDate: iso(project.responseDueDate),
            responseSubmittedDate: iso(project.responseSubmittedDate),
            siteVisitDate: iso(project.siteVisitDate),
            projectedDecisionDate: iso(project.projectedDecisionDate),
            productionStartDate: iso(project.productionStartDate),
          }}
        />

        <EditableInvestmentJobs
          projectId={project.id}
          capexTotal={dec(project.capexTotal)}
          capexLand={dec(project.capexLand)}
          capexBuilding={dec(project.capexBuilding)}
          capexEquipment={dec(project.capexEquipment)}
          avgWage={dec(project.avgWage)}
          financingNotes={project.financingNotes}
          jobPhases={project.jobPhases.map((j) => ({
            count: j.count,
            timeframe: j.timeframe,
          }))}
        />

        <EditableSiteRequirements
          projectId={project.id}
          minAcreage={project.minAcreage}
          minBuildingSqFt={project.minBuildingSqFt}
          siteLocationPreferences={project.siteLocationPreferences}
          buildingSizeNeeds={project.buildingSizeNeeds}
          requiredDeliverables={project.requiredDeliverables}
        />
      </div>

      <EditableCriticalCriteria
        projectId={project.id}
        criticalCriteria={project.criticalCriteria.map((c) => ({
          rank: c.rank,
          text: c.text,
        }))}
      />

      <EditableUtilities
        projectId={project.id}
        utilities={project.utilities.map((u) => ({
          type: u.type,
          normalizedValue: u.normalizedValue,
          normalizedUnit: u.normalizedUnit,
          rawValue: u.rawValue,
          purpose: u.purpose,
          alternatives: u.alternatives,
          notes: u.notes,
          flagged: u.flagged,
          assumptionNote: u.assumptionNote,
          datapoints: u.datapoints.map((dp) => ({
            kind: dp.kind,
            label: dp.label,
            value: dp.value,
            unit: dp.unit,
            date: iso(dp.date),
            rawValue: dp.rawValue,
            flagged: dp.flagged,
            assumptionNote: dp.assumptionNote,
          })),
        }))}
      />

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Sites submitted
        </h3>
        <SubmissionsPanel
          projectId={project.id}
          initialSubmissions={submissions}
          communities={communities.map((c) => ({ id: c.id, name: c.name }))}
          sites={sites.map((s) => ({
            id: s.id,
            name: s.name,
            communityId: s.communityId,
            community: { name: s.community.name },
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EditableQualitative
          projectId={project.id}
          qualitativeNotes={project.qualitativeNotes.map((q) => ({
            label: q.label,
            content: q.content,
          }))}
        />
        <EditableNotes
          projectId={project.id}
          environmentalNotes={project.environmentalNotes}
          transportationNotes={project.transportationNotes}
          specialServicesNotes={project.specialServicesNotes}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Attachments
          </h3>
          {project.attachments.length === 0 ? (
            <p className="text-sm text-gray-400">None.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {project.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/api/attachments/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    {a.fileName}
                  </a>{" "}
                  <span className="text-xs text-gray-400">
                    ({Math.round(a.sizeBytes / 1024)} KB)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Stage history
          </h3>
          <ul className="space-y-1 text-sm text-gray-600">
            {project.stageHistory.map((h) => (
              <li key={h.id}>
                {formatDate(h.changedAt)} — {h.toStage.replace(/_/g, " ")}
                {h.note ? ` (${h.note})` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
