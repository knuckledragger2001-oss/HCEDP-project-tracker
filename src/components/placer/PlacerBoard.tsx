"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useToast } from "@/components/ui/Toast";
import AddRequestDialog from "./AddRequestDialog";
import { formatDate } from "@/lib/format";
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  PARTNER_CITY_LABELS,
  reportTypeLabel,
  statusColor,
  statusBadgeClass,
  type RequestStatusValue,
  type PartnerCityValue,
} from "@/lib/placer/schema";

export interface QueueRequest {
  id: string;
  city: PartnerCityValue;
  placeName: string;
  reportType: string;
  reportTypeOther: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  timeframeNote: string | null;
  status: RequestStatusValue;
  assignedToId: string | null;
  submittedByName: string;
  neededByDate: string | null;
  createdAt: string;
}

export interface StaffOption {
  id: string;
  label: string;
}

// Flags the needed-by date as overdue / imminent, but only while the request is
// still open (not Completed or Declined).
function neededUrgency(r: QueueRequest): "overdue" | "soon" | null {
  if (r.status === "COMPLETED" || r.status === "DECLINED") return null;
  if (!r.neededByDate) return null;
  const due = new Date(r.neededByDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return null;
}

function Card({
  request,
  staff,
  onAssign,
}: {
  request: QueueRequest;
  staff: StaffOption[];
  onAssign: (id: string, assignedToId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: request.id,
  });
  const urgency = neededUrgency(request);
  const reportLabel =
    request.reportType === "OTHER" && request.reportTypeOther
      ? request.reportTypeOther
      : reportTypeLabel(request.reportType);

  return (
    <div
      ref={setNodeRef}
      className={`card border-l-4 p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{ borderLeftColor: statusColor(request.status) }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <span className="badge bg-accent/15 text-accent-dark">
            {PARTNER_CITY_LABELS[request.city]}
          </span>
          <Link
            href={`/placer/${request.id}`}
            className="mt-1 block truncate text-sm font-semibold leading-tight text-brand hover:underline"
          >
            {request.placeName}
          </Link>
        </div>
        <button
          {...listeners}
          {...attributes}
          className="-mt-0.5 -mr-1 cursor-grab rounded px-1 text-gray-300 hover:bg-brand/5 hover:text-brand"
          aria-label="Drag"
          title="Drag to move status"
        >
          ⠿
        </button>
      </div>
      <p className="mt-1 truncate text-[11px] text-muted" title={reportLabel}>
        {reportLabel}
      </p>
      {request.neededByDate && (
        <p
          className={`mt-1 text-[11px] leading-tight ${
            urgency === "overdue"
              ? "font-medium text-red-600"
              : urgency === "soon"
                ? "font-medium text-yellow-600"
                : "text-gray-500"
          }`}
        >
          Needed {formatDate(request.neededByDate)}
        </p>
      )}
      {/* Inline assignee picker — stop drag/click from bubbling into dnd. */}
      <select
        className="input mt-2 h-7 w-full py-0.5 text-[11px]"
        value={request.assignedToId ?? ""}
        onChange={(e) => onAssign(request.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Assignee"
      >
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Column({
  status,
  label,
  requests,
  staff,
  onAssign,
}: {
  status: RequestStatusValue;
  label: string;
  requests: QueueRequest[];
  staff: StaffOption[];
  onAssign: (id: string, assignedToId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col">
      <div className="mb-1.5 flex min-h-[2.5rem] items-center justify-between gap-1 px-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: statusColor(status) }}
          />
          <span className="line-clamp-2">{label}</span>
        </span>
        <span className="badge shrink-0 bg-brand/8 text-muted">
          {requests.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex max-h-[calc(100vh-13rem)] min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border p-1.5 transition-colors ${
          isOver ? "border-accent/40 bg-accent/10" : "border-line/70 bg-brand/[0.03]"
        }`}
      >
        {requests.map((r) => (
          <Card key={r.id} request={r} staff={staff} onAssign={onAssign} />
        ))}
        {requests.length === 0 && (
          <p className="px-1 py-3 text-center text-[11px] text-gray-400">Empty</p>
        )}
      </div>
    </div>
  );
}

export default function PlacerBoard({
  initialRequests,
  staff,
}: {
  initialRequests: QueueRequest[];
  staff: StaffOption[];
}) {
  const toast = useToast();
  const [requests, setRequests] = useState(initialRequests);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<"all" | PartnerCityValue>("all");
  const [addOpen, setAddOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (cityFilter !== "all" && r.city !== cityFilter) return false;
      if (q) {
        const hay = `${r.placeName} ${r.reportTypeOther ?? ""} ${r.submittedByName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, query, cityFilter]);

  async function moveRequest(id: string, status: RequestStatusValue) {
    let statusReason: string | undefined;
    if (status === "DECLINED") {
      const reason = window.prompt("Why are we declining this request?");
      if (reason === null) return;
      const trimmed = reason.trim();
      if (!trimmed) {
        toast.error("A reason is required to decline a request.");
        return;
      }
      statusReason = trimmed;
    }

    const prev = requests;
    setRequests((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/placer-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statusReason ? { status, statusReason } : { status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Moved to ${REQUEST_STATUS_LABELS[status]}.`);
    } catch {
      setRequests(prev);
      toast.error("Could not update status. Please try again.");
    }
  }

  async function assign(id: string, assignedToId: string) {
    const prev = requests;
    setRequests((cur) =>
      cur.map((r) => (r.id === id ? { ...r, assignedToId: assignedToId || null } : r)),
    );
    try {
      const res = await fetch(`/api/placer-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assignedToId || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const who = assignedToId
        ? (staff.find((s) => s.id === assignedToId)?.label ?? "someone")
        : "Unassigned";
      toast.success(assignedToId ? `Assigned to ${who}.` : "Unassigned.");
    } catch {
      setRequests(prev);
      toast.error("Could not update assignee. Please try again.");
    }
  }

  function onCreated(request: QueueRequest) {
    setRequests((cur) => [request, ...cur]);
    setAddOpen(false);
    toast.success("Request added to the queue.");
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const overStatus = e.over?.id as RequestStatusValue | undefined;
    if (!overStatus) return;
    const current = requests.find((r) => r.id === id);
    if (!current || current.status === overStatus) return;
    moveRequest(id, overStatus);
  }

  const active = requests.find((r) => r.id === activeId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className="btn-primary h-8 py-1 text-xs"
          onClick={() => setAddOpen(true)}
        >
          Add request
        </button>
        <label className="flex items-center gap-1.5 text-gray-600">
          <span className="text-xs font-medium text-gray-500">City</span>
          <select
            className="input h-8 w-auto py-1 text-xs"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value as "all" | PartnerCityValue)}
          >
            <option value="all">All cities</option>
            {Object.entries(PARTNER_CITY_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search place, requester…"
            className="input h-8 w-56 py-1 pl-7 text-xs"
            aria-label="Search requests"
          />
          <svg
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a1 1 0 01-1.42 1.42l-3.08-3.08A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <span className="text-xs text-gray-400">
          {visible.length} request{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      <DndContext
        id="placer-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {REQUEST_STATUSES.map((s) => (
            <Column
              key={s.value}
              status={s.value}
              label={s.label}
              requests={visible.filter((r) => r.status === s.value)}
              staff={staff}
              onAssign={assign}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-48">
              <div className="card p-2 shadow-lg">
                <span className={`badge ${statusBadgeClass(active.status)}`}>
                  {active.placeName}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {addOpen && (
        <AddRequestDialog onClose={() => setAddOpen(false)} onCreated={onCreated} />
      )}
    </div>
  );
}
