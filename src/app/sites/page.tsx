import { prisma } from "@/lib/prisma";
import SitesManager from "@/components/SitesManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sites · HCEDP Tracker" };

export default async function SitesPage() {
  const [communities, sites] = await Promise.all([
    prisma.community.findMany({ orderBy: { order: "asc" } }),
    prisma.site.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { submissions: true } } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Sites</h1>
        <p className="text-sm text-gray-500">
          Real estate sites we can submit, grouped by community.
        </p>
      </div>
      <SitesManager
        communities={communities.map((c) => ({ id: c.id, name: c.name }))}
        initialSites={sites.map((s) => ({
          id: s.id,
          name: s.name,
          communityId: s.communityId,
          acreage: s.acreage,
          address: s.address,
          submissionCount: s._count.submissions,
        }))}
      />
    </div>
  );
}
