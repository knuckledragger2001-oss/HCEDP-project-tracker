import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import {
  partnerCityLabel,
  reportTypeLabel,
  formatTimeframe,
  statusBadgeClass,
  statusColor,
  REQUEST_STATUS_LABELS,
  type PartnerCityValue,
} from "@/lib/placer/schema";
import RequestForm from "@/components/placer/RequestForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Placer AI Requests — HCEDP",
};

// External partner surface: submit a Placer AI report request and track this
// city's requests. Scoped entirely to the signed-in partner's city.
export default async function PartnerRequestsPage() {
  const user = await requirePartner();

  const requests = user.partnerCity
    ? await prisma.placerRequest.findMany({
        where: { city: user.partnerCity as PartnerCityValue, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          placeName: true,
          locationAddress: true,
          reportType: true,
          reportTypeOther: true,
          dateRangeStart: true,
          dateRangeEnd: true,
          timeframeNote: true,
          status: true,
          resultNote: true,
          neededByDate: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Placer AI Requests
        </h1>
        <p className="mt-1 text-sm text-muted">
          {partnerCityLabel(user.partnerCity)} — request a report and track where
          it is. HCEDP handles it from there.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          New request
        </h2>
        <RequestForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Your requests ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">
            No requests yet. Submit one above and it will appear here.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {requests.map((r) => (
              <li
                key={r.id}
                className="card border-l-4 p-4"
                style={{ borderLeftColor: statusColor(r.status) }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">
                      {r.placeName}
                    </div>
                    <div className="text-sm text-muted">
                      {r.reportType === "OTHER" && r.reportTypeOther
                        ? r.reportTypeOther
                        : reportTypeLabel(r.reportType)}
                      {r.locationAddress ? ` · ${r.locationAddress}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${statusBadgeClass(r.status)}`}>
                    {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                  <span>
                    <span className="font-medium text-foreground/70">
                      Timeframe:
                    </span>{" "}
                    {formatTimeframe(
                      r.dateRangeStart?.toISOString() ?? null,
                      r.dateRangeEnd?.toISOString() ?? null,
                      r.timeframeNote,
                    )}
                  </span>
                  {r.neededByDate && (
                    <span>
                      <span className="font-medium text-foreground/70">
                        Needed by:
                      </span>{" "}
                      {formatDate(r.neededByDate.toISOString())}
                    </span>
                  )}
                  <span>
                    <span className="font-medium text-foreground/70">
                      Submitted:
                    </span>{" "}
                    {formatDate(r.createdAt.toISOString())}
                  </span>
                </div>
                {r.status === "COMPLETED" && r.resultNote && (
                  <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-900">
                    <span className="font-semibold">Result: </span>
                    {r.resultNote}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
