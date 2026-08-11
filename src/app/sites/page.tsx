import { prisma } from "@/lib/prisma";
import SitesManager from "@/components/SitesManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sites · HCEDP Tracker" };

export default async function SitesPage() {
  const [communities, providers, sites] = await Promise.all([
    prisma.community.findMany({ orderBy: { order: "asc" } }),
    prisma.utilityProvider.findMany({
      orderBy: [{ type: "asc" }, { order: "asc" }],
    }),
    prisma.site.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        electricProvider: true,
        waterProvider: true,
        sewerProvider: true,
        gasProvider: true,
        _count: { select: { submissions: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Sites</h1>
        <p className="text-sm text-muted">
          Real estate sites we can submit, grouped by community.
        </p>
      </div>
      <SitesManager
        communities={communities.map((c) => ({ id: c.id, name: c.name }))}
        providers={providers.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
        }))}
        initialSites={sites.map((s) => ({
          id: s.id,
          name: s.name,
          communityId: s.communityId,
          acreage: s.acreage,
          address: s.address,
          realEstateType: s.realEstateType,
          county: s.county,
          squareFeet: s.squareFeet,
          pricePerSqFt: s.pricePerSqFt ? Number(s.pricePerSqFt.toString()) : null,
          currentElectricMw: s.currentElectricMw,
          projectedElectricMw: s.projectedElectricMw,
          electricProviderId: s.electricProviderId,
          electricProviderName: s.electricProvider?.name ?? null,
          waterProviderId: s.waterProviderId,
          waterProviderName: s.waterProvider?.name ?? null,
          sewerProviderId: s.sewerProviderId,
          sewerProviderName: s.sewerProvider?.name ?? null,
          gasProviderId: s.gasProviderId,
          gasProviderName: s.gasProvider?.name ?? null,
          submissionCount: s._count.submissions,
        }))}
      />
    </div>
  );
}
