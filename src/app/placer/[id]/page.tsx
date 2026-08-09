import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireInternal } from "@/lib/auth/session";
import { formatDate, formatTimestamp } from "@/lib/format";
import {
  partnerCityLabel,
  reportTypeLabel,
  formatTimeframe,
  statusBadgeClass,
  statusColor,
  REQUEST_STATUS_LABELS,
  type RequestStatusValue,
} from "@/lib/placer/schema";
import RequestDetail from "@/components/placer/RequestDetail";
import type { StaffOption } from "@/components/placer/PlacerBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request — Placer AI — HCEDP",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default async function PlacerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternal();
  const { id } = await params;

  const [request, staff] = await Promise.all([
    prisma.placerRequest.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, disabledAt: null, role: { in: ["ADMIN", "USER"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  if (!request || request.deletedAt) notFound();

  const staffOptions: StaffOption[] = staff.map((s) => ({
    id: s.id,
    label: s.name ?? s.email,
  }));

  const reportLabel =
    request.reportType === "OTHER" && request.reportTypeOther
      ? request.reportTypeOther
      : reportTypeLabel(request.reportType);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/placer" className="text-sm text-brand hover:underline">
          ← Back to queue
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">
            {request.placeName}
          </h1>
          <span className="badge bg-accent/15 text-accent-dark">
            {partnerCityLabel(request.city)}
          </span>
          <span className={`badge ${statusBadgeClass(request.status)}`}>
            {REQUEST_STATUS_LABELS[request.status as RequestStatusValue] ??
              request.status}
          </span>
        </div>
      </div>

      <section
        className="card border-l-4 p-5"
        style={{ borderLeftColor: statusColor(request.status) }}
      >
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          What was requested
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Report type">{reportLabel}</Field>
          <Field label="Place / location">
            {request.placeName}
            {request.locationAddress ? ` · ${request.locationAddress}` : ""}
          </Field>
          <Field label="Timeframe">
            {formatTimeframe(
              request.dateRangeStart?.toISOString() ?? null,
              request.dateRangeEnd?.toISOString() ?? null,
              request.timeframeNote,
            )}
          </Field>
          <Field label="Needed by">
            {request.neededByDate
              ? formatDate(request.neededByDate.toISOString())
              : "—"}
          </Field>
          <Field label="Submitted by">
            {request.submittedBy?.name ?? request.submittedBy?.email ?? "—"}
          </Field>
          <Field label="Submitted">
            {formatTimestamp(request.createdAt)}
          </Field>
        </div>
        {request.purpose && (
          <div className="mt-4">
            <div className="label">Purpose &amp; details</div>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {request.purpose}
            </p>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Fulfillment
        </h2>
        <RequestDetail
          request={{
            id: request.id,
            status: request.status as RequestStatusValue,
            assignedToId: request.assignedToId,
            internalNotes: request.internalNotes ?? "",
            resultNote: request.resultNote ?? "",
          }}
          staff={staffOptions}
        />
      </section>
    </div>
  );
}
