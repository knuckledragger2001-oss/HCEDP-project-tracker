"use client";

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
import { useState } from "react";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { formatDate, stageBadgeClass, stageColor } from "@/lib/format";
import { dueUrgency, stageDate, type BoardProject } from "./helpers";

function Card({ project }: { project: BoardProject }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
  });
  return (
    <div
      ref={setNodeRef}
      className={`card border-l-4 p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{ borderLeftColor: stageColor(project.stage) }}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-semibold leading-tight text-brand hover:underline"
        >
          {project.codename}
        </Link>
        <button
          {...listeners}
          {...attributes}
          className="-mt-0.5 -mr-1 cursor-grab rounded px-1 text-muted-2 hover:bg-brand/5 hover:text-brand"
          aria-label="Drag"
          title="Drag to move stage"
        >
          ⠿
        </button>
      </div>
      {/* One compact meta row: the most relevant date (left) and how many sites
          have been submitted (right). Deliberately minimal so a full board stays
          scannable — richer detail lives on the project page. */}
      {(() => {
        const sd = stageDate(project);
        if (!sd && project.submissionCount === 0) return null;
        const urgency = dueUrgency(project);
        const dateCls =
          urgency === "overdue"
            ? "font-semibold text-danger"
            : urgency === "soon"
              ? "font-semibold text-warn"
              : "text-muted";
        return (
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] leading-tight">
            <span className={`mono min-w-0 truncate ${dateCls}`}>
              {sd ? `${sd.label} ${formatDate(sd.date)}` : ""}
            </span>
            {project.submissionCount > 0 && (
              <span className="badge shrink-0 bg-info/15 text-accent-dark">
                {project.submissionCount} site
                {project.submissionCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        );
      })()}
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
      {/* Fixed min-height so every column header occupies the same vertical
          space whether its label wraps to one line or two — keeps the card
          columns below them aligned across all nine stages. */}
      <div className="mb-1.5 flex min-h-[2.5rem] items-center justify-between gap-1 px-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: stageColor(stage) }}
          />
          <span className="line-clamp-2">{label}</span>
        </span>
        <span className="badge shrink-0 bg-brand/8 text-muted">
          {projects.length}
        </span>
      </div>
      {/* Cap the visible height and scroll within the column so a stage with 80+
          cards no longer stretches the whole board to an unusable length. Every
          column scrolls independently; dnd-kit auto-scrolls a column while
          dragging near its edge. */}
      <div
        ref={setNodeRef}
        className={`flex max-h-[calc(100vh-16rem)] min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border p-1.5 transition-colors ${
          isOver
            ? "border-brand/40 bg-green-tint"
            : "border-line bg-surface-2"
        }`}
      >
        {projects.map((p) => (
          <Card key={p.id} project={p} />
        ))}
        {projects.length === 0 && (
          <p className="px-1 py-3 text-center text-[11px] text-muted-2">Empty</p>
        )}
      </div>
    </div>
  );
}

// Presentational Kanban board. Filtering and the stage-move mutation live in the
// parent (PipelineWorkspace); this view just renders the given projects and
// reports a drop via onMove.
export default function BoardView({
  projects,
  onMove,
}: {
  projects: BoardProject[];
  onMove: (id: string, stage: PipelineStageValue) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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
    onMove(id, overStage);
  }

  const active = projects.find((p) => p.id === activeId) ?? null;

  return (
    // A stable id: dnd-kit otherwise derives its aria-describedby ids from a
    // module-level counter, which starts fresh on the client and mismatches
    // what the server rendered.
    <DndContext
      id="pipeline-board"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {PIPELINE_STAGES.map((s) => (
          <Column
            key={s.value}
            stage={s.value}
            label={s.label}
            projects={projects.filter((p) => p.stage === s.value)}
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
  );
}
