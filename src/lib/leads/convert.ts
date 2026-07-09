import { prisma } from "@/lib/prisma";
import { createProjectFromProposal } from "@/lib/projects/create";
import { SaveProjectSchema } from "@/lib/projects/schema";
import { leadDisplayName } from "@/lib/leads/schema";

export class LeadConversionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Timeframe recorded on the job phase seeded from Lead.estimatedJobs. Leads
// carry a single unphased headcount guess; the RFI is what later breaks jobs
// into real phases.
const ESTIMATED_JOBS_TIMEFRAME = "Estimated at lead stage";

// Convert a qualified lead into a full project.
//
// The lead row is kept (stage CONVERTED, pointing at the new project) rather
// than deleted, so lead→project conversion stays reportable and the lead's own
// fields — companyName, contactPhone, notes — remain available even though
// Project has no column for them.
//
// Project creation and the lead update run in one transaction: a project that
// exists with no lead pointing at it would silently double-count on the
// dashboard the next time someone converted the same lead.
export async function convertLeadToProject(leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
  });
  if (!lead) throw new LeadConversionError("Lead not found", 404);
  if (lead.convertedProjectId) {
    throw new LeadConversionError(
      "This lead has already been converted to a project.",
      409,
    );
  }
  if (lead.stage === "DEAD") {
    throw new LeadConversionError(
      "This lead is marked dead. Move it back to Qualified before converting.",
      409,
    );
  }

  // Run the copied fields through the same validation the intake review form
  // uses, so a bad lead can't create a project the normal path would reject.
  const proposal = SaveProjectSchema.parse({
    // A lead may carry only a company name. The project needs something to be
    // called, and it is the same name the board was showing.
    codename: leadDisplayName(lead),

    leadSource: lead.leadSource,
    leadSourceOther: lead.leadSourceOther,
    sourceContactName: lead.contactName,
    sourceContactEmail: lead.contactEmail,

    companyLocationRaw: lead.companyLocationRaw,

    naicsCode: lead.naicsCode,
    industryDescription: lead.industryDescription,
    narrative: lead.notes,

    capexTotal: lead.estimatedCapex ? Number(lead.estimatedCapex) : null,

    minAcreage: lead.minAcreage,
    minBuildingSqFt: lead.minBuildingSqFt,

    jobPhases:
      lead.estimatedJobs && lead.estimatedJobs > 0
        ? [{ count: lead.estimatedJobs, timeframe: ESTIMATED_JOBS_TIMEFRAME }]
        : [],
  });

  return prisma.$transaction(async (tx) => {
    const project = await createProjectFromProposal(proposal, tx);

    // Guard against two concurrent converts of the same lead: the second one
    // matches zero rows and we abort rather than orphan a project.
    const claimed = await tx.lead.updateMany({
      where: { id: leadId, convertedProjectId: null },
      data: {
        stage: "CONVERTED",
        convertedProjectId: project.id,
        convertedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new LeadConversionError(
        "This lead has already been converted to a project.",
        409,
      );
    }

    return project;
  });
}
