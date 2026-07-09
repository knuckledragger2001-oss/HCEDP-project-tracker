import { prisma } from "@/lib/prisma";
import LeadsBoard, { type BoardLead } from "@/components/leads/LeadsBoard";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  // Prisma hands back Decimal and Date instances; neither survives the boundary
  // into a client component, so flatten them to strings here.
  const boardLeads: BoardLead[] = leads.map((l) => ({
    id: l.id,
    codename: l.codename,
    companyName: l.companyName,
    stage: l.stage,
    leadSource: l.leadSource,
    leadSourceOther: l.leadSourceOther,
    contactName: l.contactName,
    contactEmail: l.contactEmail,
    contactPhone: l.contactPhone,
    companyLocationRaw: l.companyLocationRaw,
    naicsCode: l.naicsCode,
    industryDescription: l.industryDescription,
    estimatedCapex: l.estimatedCapex?.toString() ?? null,
    estimatedJobs: l.estimatedJobs,
    minAcreage: l.minAcreage,
    minBuildingSqFt: l.minBuildingSqFt,
    notes: l.notes,
    nextFollowUpDate: l.nextFollowUpDate?.toISOString() ?? null,
    deadReason: l.deadReason,
    convertedProjectId: l.convertedProjectId,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Leads</h1>
        <p className="text-sm text-muted">
          Prospects we are working before an RFI exists. Qualify a lead, then
          convert it into a project.
        </p>
      </div>
      <LeadsBoard initialLeads={boardLeads} />
    </div>
  );
}
