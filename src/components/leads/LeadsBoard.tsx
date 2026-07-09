"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  LEAD_STAGES,
  LEAD_STAGE_CONVERTED,
  LEAD_STAGES_REQUIRING_REASON,
  leadDisplayName,
  leadStageBadgeClass,
  leadStageColor,
  type LeadStageValue,
} from "@/lib/leads/schema";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";
import { formatCurrency, formatDate } from "@/lib/format";
import LeadDialog from "./LeadDialog";

export interface BoardLead {
  id: string;
  codename: string | null;
  companyName: string | null;
  stage: LeadStageValue;
  leadSource: string;
  leadSourceOther: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  companyLocationRaw: string | null;
  naicsCode: string | null;
  industryDescription: string | null;
  /** Prisma Decimal is serialized as a string over the wire. */
  estimatedCapex: string | null;
  estimatedJobs: number | null;
  minAcreage: number | null;
  minBuildingSqFt: number | null;
  notes: string | null;
  nextFollowUpDate: string | null;
  deadReason: string | null;
  convertedProjectId: string | null;
}

// Flags a follow-up that has slipped. Only meaningful while the lead is still
// being worked — a converted or dead lead has nothing left to follow up on.
function followUpUrgency(lead: BoardLead): "overdue" | "soon" | null {
  if (lead.stage === "CONVERTED" || lead.stage === "DEAD") return null;
  if (!lead.nextFollowUpDate) return null;
  const due = new Date(lead.nextFollowUpDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "soon";
  return null;
}

function Card({
  lead,
  onEdit,
  onConvert,
  onDelete,
}: {
  lead: BoardLead;
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });
  const urgency = followUpUrgency(lead);
  const dateCls =
    urgency === "overdue"
      ? "font-medium text-red-600"
      : urgency === "soon"
        ? "font-medium text-yellow-600"
        : "text-gray-500";

  const convertible = lead.stage !== "CONVERTED" && lead.stage !== "DEAD";

  const title = leadDisplayName(lead);
  // The company already sits in the title when there is no codename; repeating
  // it underneath would just be the same words twice.
  const showCompanyLine = Boolean(lead.codename?.trim() && lead.companyName);

  return (
    <div
      ref={setNodeRef}
      className={`card border-l-4 p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{ borderLeftColor: leadStageColor(lead.stage) }}
    >
      <div className="flex items-start justify-between gap-1">
        {/* A converted lead is frozen (the API rejects edits), so it gets no
            edit affordance — its live copy is the project. */}
        {lead.convertedProjectId ? (
          <span className="text-sm font-semibold leading-tight text-foreground">
            {title}
          </span>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="text-left text-sm font-semibold leading-tight text-brand hover:underline"
          >
            {title}
          </button>
        )}
        <button
          {...listeners}
          {...attributes}
          className="-mt-0.5 -mr-1 cursor-grab rounded px-1 text-gray-300 hover:bg-brand/5 hover:text-brand"
          aria-label="Drag"
          title="Drag to move stage"
        >
          ⠿
        </button>
      </div>

      {showCompanyLine && (
        <p className="mt-0.5 truncate text-[11px] text-muted" title={lead.companyName!}>
          {lead.companyName}
        </p>
      )}
      {lead.contactName && (
        <p className="truncate text-[11px] text-gray-400" title={lead.contactName}>
          {lead.contactName}
        </p>
      )}

      {/* One compact meta row: next follow-up (left), estimated size (right). */}
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] leading-tight">
        <span className={dateCls}>
          {lead.nextFollowUpDate
            ? `Follow up ${formatDate(lead.nextFollowUpDate)}`
            : ""}
        </span>
        {lead.estimatedCapex && (
          <span className="badge shrink-0 bg-accent/15 text-accent-dark">
            {formatCurrency(lead.estimatedCapex)}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2 border-t border-line/60 pt-1.5">
        {convertible && (
          <button
            type="button"
            onClick={onConvert}
            className="text-[11px] font-medium text-brand hover:underline"
          >
            Convert to project →
          </button>
        )}
        {lead.convertedProjectId && (
          <a
            href={`/projects/${lead.convertedProjectId}`}
            className="text-[11px] font-medium text-brand hover:underline"
          >
            View project →
          </a>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-600"
          aria-label={`Delete ${title}`}
          title="Delete lead"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Column({
  stage,
  label,
  leads,
  children,
}: {
  stage: LeadStageValue;
  label: string;
  leads: BoardLead[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  // Converted is reachable only through the Convert action, so it must not read
  // as a drop target.
  const droppable = stage !== LEAD_STAGE_CONVERTED;
  return (
    <div className="flex flex-col">
      <div className="mb-1.5 flex min-h-[2.5rem] items-center justify-between gap-1 px-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: leadStageColor(stage) }}
          />
          <span className="line-clamp-2">{label}</span>
        </span>
        <span className="badge shrink-0 bg-brand/8 text-muted">{leads.length}</span>
      </div>
      <div
        ref={droppable ? setNodeRef : undefined}
        className={`flex min-h-24 flex-1 flex-col gap-2 rounded-xl border p-1.5 transition-colors ${
          isOver && droppable
            ? "border-accent/40 bg-accent/10"
            : "border-line/70 bg-brand/[0.03]"
        }`}
      >
        {children}
        {leads.length === 0 && (
          <p className="px-1 py-3 text-center text-[11px] text-gray-400">Empty</p>
        )}
      </div>
    </div>
  );
}

export default function LeadsBoard({ initialLeads }: { initialLeads: BoardLead[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BoardLead | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  async function moveLead(id: string, stage: LeadStageValue) {
    // Entering Dead requires recording why, mirroring No Submission on the
    // project pipeline.
    let deadReason: string | undefined;
    if (LEAD_STAGES_REQUIRING_REASON.includes(stage)) {
      const reason = window.prompt("Why is this lead dead?");
      if (reason === null) return; // cancelled — leave the card where it was
      const trimmed = reason.trim();
      if (!trimmed) {
        toast.error("A reason is required to mark a lead dead.");
        return;
      }
      deadReason = trimmed;
    }

    const prev = leads;
    setLeads((cur) =>
      cur.map((l) =>
        l.id === id ? { ...l, stage, deadReason: deadReason ?? l.deadReason } : l,
      ),
    );
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deadReason ? { stage, deadReason } : { stage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed");
      }
      const label = LEAD_STAGES.find((s) => s.value === stage)?.label ?? "new stage";
      toast.success(`Moved to ${label}.`);
    } catch (e) {
      setLeads(prev);
      toast.error(e instanceof Error ? e.message : "Could not update stage.");
    }
  }

  async function convertLead(lead: BoardLead) {
    const ok = await confirm({
      title: `Convert ${leadDisplayName(lead)} to a project?`,
      description:
        "This creates a project in RFI Received carrying over everything known about the lead. The lead stays on this board as Converted and can no longer be edited.",
      confirmLabel: "Convert",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not convert the lead.");

      const projectId = body.project.id as string;
      setLeads((cur) =>
        cur.map((l) =>
          l.id === lead.id
            ? { ...l, stage: "CONVERTED", convertedProjectId: projectId }
            : l,
        ),
      );
      toast.success(`${leadDisplayName(lead)} is now a project.`, {
        action: { label: "Open", onClick: () => router.push(`/projects/${projectId}`) },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not convert the lead.");
    }
  }

  async function deleteLead(lead: BoardLead) {
    const ok = await confirm({
      title: `Delete ${leadDisplayName(lead)}?`,
      description: "You can undo this from the toast that appears.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;

    const prev = leads;
    setLeads((cur) => cur.filter((l) => l.id !== lead.id));
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Deleted ${leadDisplayName(lead)}.`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const r = await fetch(`/api/leads/${lead.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restore: true }),
            });
            if (r.ok) {
              setLeads(prev);
              toast.success(`Restored ${leadDisplayName(lead)}.`);
            } else {
              toast.error("Could not restore the lead.");
            }
          },
        },
      });
    } catch {
      setLeads(prev);
      toast.error("Could not delete the lead.");
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const overStage = e.over?.id as LeadStageValue | undefined;
    if (!overStage) return;
    const current = leads.find((l) => l.id === id);
    if (!current || current.stage === overStage) return;
    if (current.convertedProjectId) {
      toast.error("A converted lead can no longer be moved.");
      return;
    }
    moveLead(id, overStage);
  }

  function onSaved(saved: BoardLead) {
    setLeads((cur) => {
      const exists = cur.some((l) => l.id === saved.id);
      return exists ? cur.map((l) => (l.id === saved.id ? saved : l)) : [saved, ...cur];
    });
    setDialogOpen(false);
    toast.success(editing ? "Lead updated." : "Lead created.");
  }

  const active = leads.find((l) => l.id === activeId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          New lead
        </button>
        <span className="text-xs text-gray-400">
          {leads.length} lead{leads.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* A stable id: dnd-kit otherwise derives its aria-describedby ids from a
          module-level counter, which starts fresh on the client and mismatches
          what the server rendered. */}
      <DndContext
        id="leads-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {LEAD_STAGES.map((s) => {
            const inStage = leads.filter((l) => l.stage === s.value);
            return (
              <Column key={s.value} stage={s.value} label={s.label} leads={inStage}>
                {inStage.map((l) => (
                  <Card
                    key={l.id}
                    lead={l}
                    onEdit={() => {
                      setEditing(l);
                      setDialogOpen(true);
                    }}
                    onConvert={() => convertLead(l)}
                    onDelete={() => deleteLead(l)}
                  />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-48">
              <div className="card p-2 shadow-lg">
                <span className={`badge ${leadStageBadgeClass(active.stage)}`}>
                  {leadDisplayName(active)}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {dialogOpen && (
        <LeadDialog
          lead={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
