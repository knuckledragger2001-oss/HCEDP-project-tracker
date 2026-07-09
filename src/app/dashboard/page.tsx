import { prisma } from "@/lib/prisma";
import DashboardView from "@/components/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Only the filter lookups render on the server; the dashboard itself fetches
  // its figures client-side so changing a filter doesn't re-render the page.
  const communities = await prisma.community.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  return <DashboardView communities={communities} />;
}
