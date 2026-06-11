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
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { formatCurrency, formatDate, stageBadgeClass } from "@/lib/format";

export interface BoardProject {
  id: string;
  codename: string;
  stage: PipelineStageValue;
  naicsCode: string | null;
  industryDescription: string | null;
  minAcreage: number | null;
  capexTotal: string | null;
  rfiReceivedDate: string | null;
  responseDueDate: string | null;
  archived: boolean;
  submissionCount: number;
}

type DateMode = "all" | "month" | "quarter" | "fy" | "custom";
type ArchiveMode = "active" | "archived" | "all";

function periodBounds(
  mode: DateMode,
  customStart: string,
  customEnd: string,
): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (mode) {
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    case "quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), qStartMonth, 1), end: null };
    }
    case "fy":
      return {
        start:
          now.getMonth() >= 9
            ? new Date(now.getFullYear(), 9, 1)
            : new Date(now.getFullYear() - 1, 9, 1),
        end: null,
      };
    case "custom":
      return {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(customEnd + "T23:59:59") : null,
      };
    default:
      return { start: null, end: null };
  }
}

function Card({ project }: { project: BoardProject }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
  });
  return (
    <div ref={setNodeRef} className={`card p-2 ${isDragging ? "opacity-30" : ""}`}>
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-medium leading-tight text-gray-900 hover:text-brand hover:underline"
        >
          {project.codename}
        </Link>
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab text-gray-300 hover:text-gray-500"
          aria-label="Drag"
          title="Drag to move stage"
        >
          ⠿
        </button>
      </div>
      <div className="mt-1 space-y-0.5 text-[11px] leading-tight text-gray-500">
        {project.naicsCode && <div>NAICS {project.naicsCode}</div>}
        <div>
          {project.minAcreage ? `${project.minAcreage} ac` : "— ac"} ·{" "}
          {formatCurrency(project.capexTotal)}
        </div>
        {project.responseDueDate && (
          <div>Due {formatDate(project.responseDueDate)}</div>
        )}
        {project.submissionCount > 0 && (
          <div className="text-brand">
            {project.submissionCount} site
            {project.submissionCount === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

function Column({
  stage,
  label,
  projects,
}: {
  stage: PipelineStageValue;
  label: string;
  projects: BoardProject[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="badge bg-gray-100 text-gray-600">{projects.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-1.5 rounded-lg p-1.5 transition-colors ${
          isOver ? "bg-brand/10" : "bg-gray-100/60"
        }`}
      >
        {projects.map((p) => (
          <Card key={p.id} project={p} />
        ))}
        {projects.length === 0 && (
          <p className="px-1 py-3 text-center text-[11px] text-gray-400">Empty</p>
        )}
      </div>
    </div>
  );
}

export default function Board({
  initialProjects,
}: {
  initialProjects: BoardProject[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>("all");
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>("active");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const visible = useMemo(() => {
    const { start, end } = periodBounds(dateMode, customStart, customEnd);
    return projects.filter((p) => {
      if (archiveMode === "active" && p.archived) return false;
      if (archiveMode === "archived" && !p.archived) return false;
      if (start || end) {
        if (!p.rfiReceivedDate) return false;
        const d = new Date(p.rfiReceivedDate);
        if (start && d < start) return false;
        if (end && d > end) return false;
      }
      return true;
    });
  }, [projects, dateMode, archiveMode, customStart, customEnd]);

  async function moveProject(id: string, stage: PipelineStageValue) {
    const prev = projects;
    setProjects((cur) => cur.map((p) => (p.id === id ? { ...p, stage } : p)));
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setProjects(prev);
      alert("Could not update stage. Please try again.");
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const overStage = e.over?.id as PipelineStageValue | undefined;
    if (!overStage) return;
    const current = projects.find((p) => p.id === id);
    if (!current || current.stage === overStage) return;
    moveProject(id, overStage);
  }

  const active = projects.find((p) => p.id === activeId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-gray-600">
          <span className="text-xs font-medium text-gray-500">Received</span>
          <select
            className="input h-8 w-auto py-1 text-xs"
            value={dateMode}
            onChange={(e) => setDateMode(e.target.value as DateMode)}
          >
            <option value="all">All time</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="fy">This fiscal year (Oct–Sep)</option>
            <option value="custom">Custom range…</option>
          </select>
        </label>
        {dateMode === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="input h-8 py-1 text-xs"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              className="input h-8 py-1 text-xs"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
        <label className="flex items-center gap-1.5 text-gray-600">
          <span className="text-xs font-medium text-gray-500">Show</span>
          <select
            className="input h-8 w-auto py-1 text-xs"
            value={archiveMode}
            onChange={(e) => setArchiveMode(e.target.value as ArchiveMode)}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <span className="text-xs text-gray-400">
          {visible.length} project{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {PIPELINE_STAGES.map((s) => (
            <Column
              key={s.value}
              stage={s.value}
              label={s.label}
              projects={visible.filter((p) => p.stage === s.value)}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-48">
              <div className="card p-2 shadow-lg">
                <span className={`badge ${stageBadgeClass(active.stage)}`}>
                  {active.codename}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
