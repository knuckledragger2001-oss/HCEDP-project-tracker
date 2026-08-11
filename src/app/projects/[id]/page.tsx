import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StageProgress from "@/components/StageProgress";
import ProjectActions from "@/components/ProjectActions";
import SubmissionsPanel, {
  type SubmissionLite,
} from "@/components/SubmissionsPanel";
import TabbedCard from "@/components/project/TabbedCard";
import {
  EditableHeader,
  EditableSourceDates,
  EditableInvestmentJobs,
  EditableSiteRequirements,
  EditableCriticalCriteria,
  EditableUtilities,
  EditableQualitative,
  EditableNotes,
  EditableNoSubmissionReason,
} from "@/components/project/editable";
import { formatTimestamp } from "@/lib/format";
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
  // The site catalog for the submissions picker is fetched client-side by
  // SubmissionsPanel, so it isn't loaded here — keeps the page's initial render
  // light regardless of how large the site list grows.
  const [project, communities] = await Promise.all([
    prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        stageHistory: { orderBy: { changedAt: "asc" } },
        criticalCriteria: { orderBy: { rank: "asc" } },
        qualitativeNotes: true,
        attachments: true,
        siteVisits: { orderBy: { orderIndex: "asc" } },
        submissions: {
          include: { site: { include: { community: true } } },
          orderBy: { submissionDate: "desc" },
        },
      },
    }),
    prisma.community.findMany({ orderBy: { order: "asc" } }),
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
      community: {
        id: s.site.community?.id ?? "__none",
        name: s.site.community?.name ?? "Outside city limits",
      },
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
            wonSiteId={project.wonSiteId}
            submittedSites={project.submissions.map((s) => ({
              id: s.site.id,
              name: s.site.name,
            }))}
          />
        </div>
        {project.stage === "NO_SUBMISSION" && (
          <div className="mt-3">
            <EditableNoSubmissionReason
              projectId={project.id}
              noSubmissionReason={project.noSubmissionReason}
            />
          </div>
        )}
      </div>

      {/* Topic boxes: related sections grouped behind sub-tabs so the page reads
          as a horizontal grid rather than one long vertical stack. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <TabbedCard
          tabs={[
            {
              key: "source",
              label: "Source & dates",
              node: (
                <EditableSourceDates
                  projectId={project.id}
                  leadSource={project.leadSource}
                  leadSourceOther={project.leadSourceOther}
                  sourceContactName={project.sourceContactName}
                  submissionDestination={project.submissionDestination}
                  companyLocationRaw={project.companyLocationRaw}
                  companyState={project.companyState}
                  companyCountry={project.companyCountry}
                  dates={{
                    rfiReceivedDate: iso(project.rfiReceivedDate),
                    responseDueDate: iso(project.responseDueDate),
                    responseSubmittedDate: iso(project.responseSubmittedDate),
                    projectedDecisionDate: iso(project.projectedDecisionDate),
                    productionStartDate: iso(project.productionStartDate),
                  }}
                  siteVisits={project.siteVisits.map((v) => ({
                    date: v.visitDate.toISOString(),
                    note: v.note,
                    siteId: v.siteId,
                  }))}
                  submittedSites={project.submissions.map((s) => ({
                    id: s.site.id,
                    name: s.site.name,
                    communityName: s.site.community?.name ?? "Outside city limits",
                  }))}
                />
              ),
            },
            {
              key: "investment",
              label: "Investment & jobs",
              node: (
                <EditableInvestmentJobs
                  projectId={project.id}
                  capexTotal={dec(project.capexTotal)}
                  capexLand={dec(project.capexLand)}
                  capexBuilding={dec(project.capexBuilding)}
                  capexEquipment={dec(project.capexEquipment)}
                  avgWage={dec(project.avgWage)}
                  financingNotes={project.financingNotes}
                  jobs={project.jobs}
                />
              ),
            },
          ]}
        />

        <TabbedCard
          tabs={[
            {
              key: "requirements",
              label: "Site requirements",
              node: (
                <EditableSiteRequirements
                  projectId={project.id}
                  minAcreage={project.minAcreage}
                  maxAcreage={project.maxAcreage}
                  minBuildingSqFt={project.minBuildingSqFt}
                  maxBuildingSqFt={project.maxBuildingSqFt}
                  siteLocationPreferences={project.siteLocationPreferences}
                  buildingSizeNeeds={project.buildingSizeNeeds}
                  requiredDeliverables={project.requiredDeliverables}
                  existingBuildingPreference={project.existingBuildingPreference}
                  railPreference={project.railPreference}
                />
              ),
            },
            {
              key: "utilities",
              label: "Utilities",
              node: (
                <EditableUtilities
                  projectId={project.id}
                  electricityNeeds={project.electricityNeeds}
                  waterNeeds={project.waterNeeds}
                  wastewaterNeeds={project.wastewaterNeeds}
                  gasNeeds={project.gasNeeds}
                />
              ),
            },
            {
              key: "criteria",
              label: "Critical criteria",
              node: (
                <EditableCriticalCriteria
                  projectId={project.id}
                  criticalCriteria={project.criticalCriteria.map((c) => ({
                    rank: c.rank,
                    text: c.text,
                  }))}
                />
              ),
            },
          ]}
        />

        <TabbedCard
          tabs={[
            {
              key: "qualitative",
              label: "Qualitative needs",
              node: (
                <EditableQualitative
                  projectId={project.id}
                  qualitativeNotes={project.qualitativeNotes.map((q) => ({
                    label: q.label,
                    content: q.content,
                  }))}
                />
              ),
            },
            {
              key: "notes",
              label: "Other notes",
              node: (
                <EditableNotes
                  projectId={project.id}
                  environmentalNotes={project.environmentalNotes}
                  transportationNotes={project.transportationNotes}
                  specialServicesNotes={project.specialServicesNotes}
                />
              ),
            },
          ]}
        />

        <TabbedCard
          tabs={[
            {
              key: "attachments",
              label: "Attachments",
              node:
                project.attachments.length === 0 ? (
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
                ),
            },
            {
              key: "history",
              label: "Stage history",
              node: (
                <ul className="space-y-1 text-sm text-gray-600">
                  {project.stageHistory.map((h) => (
                    <li key={h.id}>
                      {formatTimestamp(h.changedAt)} — {h.toStage.replace(/_/g, " ")}
                      {h.note ? ` (${h.note})` : ""}
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Sites submitted
        </h3>
        <SubmissionsPanel
          projectId={project.id}
          initialSubmissions={submissions}
          communities={communities.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
