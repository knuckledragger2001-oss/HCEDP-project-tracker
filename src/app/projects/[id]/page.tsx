import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectStageSelect from "@/components/ProjectStageSelect";
import SubmissionsPanel, {
  type SubmissionLite,
} from "@/components/SubmissionsPanel";
import {
  LEAD_SOURCE_LABELS,
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/format";
import type { PipelineStageValue } from "@/lib/projects/schema";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
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

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Back to board
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            {project.codename}
          </h1>
          <ProjectStageSelect
            projectId={project.id}
            stage={project.stage as PipelineStageValue}
          />
        </div>
        <p className="text-sm text-gray-500">
          {project.industryDescription ?? "—"}
          {project.naicsCode ? ` · NAICS ${project.naicsCode}` : ""}
          {project.projectType ? ` · ${project.projectType}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Source & dates
          </h3>
          <Row
            label="Lead source"
            value={
              LEAD_SOURCE_LABELS[project.leadSource] ?? project.leadSource
            }
          />
          <Row label="Source contact" value={project.sourceContactName ?? "—"} />
          <Row label="Submit to" value={project.submissionDestination ?? "—"} />
          <Row label="RFI received" value={formatDate(project.rfiReceivedDate)} />
          <Row label="Response due" value={formatDate(project.responseDueDate)} />
          <Row
            label="Response submitted"
            value={formatDate(project.responseSubmittedDate)}
          />
          <Row label="Site visit" value={formatDate(project.siteVisitDate)} />
          <Row
            label="Projected decision"
            value={formatDate(project.projectedDecisionDate)}
          />
          <Row
            label="Start of production"
            value={formatDate(project.productionStartDate)}
          />
        </div>

        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Investment & jobs
          </h3>
          <Row
            label="Total capex"
            value={formatCurrency(project.capexTotal?.toString())}
          />
          <Row
            label="Land"
            value={formatCurrency(project.capexLand?.toString())}
          />
          <Row
            label="Building"
            value={formatCurrency(project.capexBuilding?.toString())}
          />
          <Row
            label="Equipment"
            value={formatCurrency(project.capexEquipment?.toString())}
          />
          <Row
            label="Avg wage"
            value={formatCurrency(project.avgWage?.toString())}
          />
          <div className="mt-2 border-t border-gray-100 pt-2">
            {project.jobPhases.length === 0 ? (
              <p className="text-sm text-gray-400">No job phases.</p>
            ) : (
              project.jobPhases.map((j) => (
                <Row
                  key={j.id}
                  label={j.timeframe}
                  value={`${formatNumber(j.count)} jobs`}
                />
              ))
            )}
          </div>
          {project.financingNotes && (
            <p className="mt-2 text-xs text-gray-500">{project.financingNotes}</p>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Site requirements
          </h3>
          <Row
            label="Min acreage"
            value={project.minAcreage ? `${project.minAcreage} ac` : "—"}
          />
          <Row
            label="Location prefs"
            value={
              project.siteLocationPreferences.length
                ? project.siteLocationPreferences.join(", ")
                : "—"
            }
          />
          {project.buildingSizeNeeds && (
            <p className="mt-2 text-xs text-gray-600">
              {project.buildingSizeNeeds}
            </p>
          )}
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="label">Required deliverables</p>
            {project.requiredDeliverables.length ? (
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {project.requiredDeliverables.map((dlv, i) => (
                  <li key={i}>{dlv}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Critical criteria */}
      <div className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">
          Critical criteria (in order of importance)
        </h3>
        {project.criticalCriteria.length === 0 ? (
          <p className="text-sm text-gray-400">None recorded.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-800">
            {project.criticalCriteria.map((c) => (
              <li key={c.id}>{c.text}</li>
            ))}
          </ol>
        )}
      </div>

      {/* Utilities */}
      <div className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">
          Utility requirements
        </h3>
        {project.utilities.length === 0 ? (
          <p className="text-sm text-gray-400">None recorded.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {project.utilities.map((u) => (
              <div key={u.id} className="rounded-md border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {u.type.charAt(0) + u.type.slice(1).toLowerCase()}
                  </span>
                  <span className="text-sm text-gray-700">
                    {u.normalizedValue != null
                      ? `${formatNumber(u.normalizedValue)} ${u.normalizedUnit ?? ""}`
                      : "—"}
                  </span>
                </div>
                {u.rawValue && (
                  <p className="mt-1 text-xs text-gray-500">Raw: {u.rawValue}</p>
                )}
                {u.alternatives && (
                  <p className="text-xs text-gray-500">Alt: {u.alternatives}</p>
                )}
                {u.flagged && u.assumptionNote && (
                  <p className="mt-1 text-xs text-amber-700">⚠ {u.assumptionNote}</p>
                )}
                {u.datapoints.length > 0 && (
                  <table className="mt-2 w-full text-xs">
                    <tbody>
                      {u.datapoints.map((dp) => (
                        <tr key={dp.id} className="text-gray-600">
                          <td className="pr-2">{dp.kind ?? dp.label ?? "—"}</td>
                          <td className="pr-2 text-right">
                            {dp.value != null
                              ? `${formatNumber(dp.value)} ${dp.unit ?? ""}`
                              : "—"}
                          </td>
                          <td className="text-right text-gray-400">
                            {dp.date ? formatDate(dp.date) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submissions */}
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

      {/* Qualitative + notes */}
      {(project.qualitativeNotes.length > 0 ||
        project.environmentalNotes ||
        project.transportationNotes ||
        project.specialServicesNotes) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {project.qualitativeNotes.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Qualitative needs
              </h3>
              {project.qualitativeNotes.map((q) => (
                <div key={q.id} className="mb-2">
                  <p className="text-xs font-semibold text-gray-700">
                    {q.label}
                  </p>
                  <p className="text-sm text-gray-600">{q.content}</p>
                </div>
              ))}
            </div>
          )}
          <div className="card space-y-2 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
            {project.environmentalNotes && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Environmental:</span>{" "}
                {project.environmentalNotes}
              </p>
            )}
            {project.transportationNotes && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Transportation:</span>{" "}
                {project.transportationNotes}
              </p>
            )}
            {project.specialServicesNotes && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Special services:</span>{" "}
                {project.specialServicesNotes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Attachments + history */}
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
