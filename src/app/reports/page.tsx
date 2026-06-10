import { prisma } from "@/lib/prisma";
import ReportsView from "@/components/ReportsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports · HCEDP Tracker" };

export default async function ReportsPage() {
  const [communities, providers] = await Promise.all([
    prisma.community.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.utilityProvider.findMany({
      orderBy: [{ type: "asc" }, { order: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">
          Partner-facing activity and submission summaries. Filter, preview, then
          export to PDF or Excel.
        </p>
      </div>
      <ReportsView communities={communities} providers={providers} />
    </div>
  );
}
