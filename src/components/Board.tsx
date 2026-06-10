"use client";

import { useState } from "react";
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
  responseDueDate: string | null;
  submissionCount: number;
}

function Card({ project }: { project: BoardProject }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
  });
  return (
    <div
      ref={setNodeRef}
      className={`card p-3 ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/projects/${project.id}`}
          className="font-medium text-gray-900 hover:text-brand hover:underline"
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
      <div className="mt-1 space-y-0.5 text-xs text-gray-500">
        {project.naicsCode && <div>NAICS {project.naicsCode}</div>}
        <div>
          {project.minAcreage ? `${project.minAcreage} ac min` : "— ac"} ·{" "}
          {formatCurrency(project.capexTotal)}
        </div>
        {project.responseDueDate && (
          <div>Due {formatDate(project.responseDueDate)}</div>
        )}
        {project.submissionCount > 0 && (
          <div className="text-brand">
            {project.submissionCount} site
            {project.submissionCount === 1 ? "" : "s"} submitted
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
  onSelectStage,
}: {
  stage: PipelineStageValue;
  label: string;
  projects: BoardProject[];
  onSelectStage: (projectId: string, stage: PipelineStageValue) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="badge bg-gray-100 text-gray-600">
          {projects.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-32 flex-1 flex-col gap-2 rounded-lg p-2 transition-colors ${
          isOver ? "bg-brand/10" : "bg-gray-100/60"
        }`}
      >
        {projects.map((p) => (
          <div key={p.id}>
            <Card project={p} />
            <select
              value={p.stage}
              onChange={(e) =>
                onSelectStage(p.id, e.target.value as PipelineStageValue)
              }
              className="mt-1 w-full rounded border border-gray-200 bg-white px-1 py-1 text-xs text-gray-600"
              aria-label="Change stage"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-gray-400">Empty</p>
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  async function moveProject(id: string, stage: PipelineStageValue) {
    const prev = projects;
    setProjects((cur) =>
      cur.map((p) => (p.id === id ? { ...p, stage } : p)),
    );
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setProjects(prev); // rollback
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
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((s) => (
          <Column
            key={s.value}
            stage={s.value}
            label={s.label}
            projects={projects.filter((p) => p.stage === s.value)}
            onSelectStage={moveProject}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="w-64">
            <div className="card p-3 shadow-lg">
              <span className={`badge ${stageBadgeClass(active.stage)}`}>
                {active.codename}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
