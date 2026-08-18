"use client";

// "My Tasks": what's assigned to me, and what I've assigned to others. A task
// can be ticked done (and reopened), reassigned, or withdrawn by whoever raised
// it. See CreateTaskDialog for the "new task" flow.

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatDate } from "@/lib/format";
import {
  TASK_PRIORITY_LABELS,
  priorityBadgeClass,
  dueUrgency,
  dueClass,
  type TaskStatusValue,
} from "@/lib/tasks/schema";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import type { StaffOption } from "@/components/placer/PlacerBoard";
import CreateTaskDialog from "./CreateTaskDialog";

export interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  dueDate: string | null;
  status: TaskStatusValue;
  priority: string;
  assignedToId: string;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  placerRequestId: string | null;
  placerRequestName: string | null;
  createdAt: string;
}

function Row({
  task,
  showAssignee,
  showCreator,
  onToggle,
  onDelete,
  canDelete,
  busy,
}: {
  task: TaskRow;
  showAssignee: boolean;
  showCreator: boolean;
  onToggle: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
  canDelete: boolean;
  busy: boolean;
}) {
  const urgency = dueUrgency(task.dueDate, task.status);
  const done = task.status === "DONE";
  return (
    <li className={`card flex items-start gap-3 border-l-4 p-3 ${done ? "opacity-60" : ""}`} style={{
      borderLeftColor: task.priority === "HIGH" ? "#dc2626" : task.priority === "LOW" ? "#94a3b8" : "#6ba7c1",
    }}>
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(task)}
        disabled={busy}
        className="mt-1 h-4 w-4 shrink-0 accent-brand"
        aria-label={done ? "Reopen" : "Mark done"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${done ? "text-muted line-through" : "text-foreground"}`}>
            {task.title}
          </span>
          <span className={`badge ${priorityBadgeClass(task.priority)}`}>
            {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
        </div>
        {task.details && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{task.details}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-2">
          {task.dueDate && (
            <span className={dueClass(urgency)}>Due {formatDate(task.dueDate)}</span>
          )}
          {showAssignee && <span>To {task.assignedToName}</span>}
          {showCreator && <span>From {task.createdByName}</span>}
          {task.placerRequestId && (
            <Link href={`/placer/${task.placerRequestId}`} className="text-brand hover:underline">
              {task.placerRequestName ?? "Linked request"} →
            </Link>
          )}
        </div>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(task)}
          disabled={busy}
          className="rounded p-1 text-muted-2 hover:bg-danger/10 hover:text-danger"
          aria-label="Withdraw task"
          title="Withdraw"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function List({
  tasks,
  showAssignee,
  showCreator,
  currentUserId,
  onChange,
}: {
  tasks: TaskRow[];
  showAssignee: boolean;
  showCreator: boolean;
  currentUserId: string;
  onChange: (tasks: TaskRow[]) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(task: TaskRow) {
    const nextStatus: TaskStatusValue = task.status === "DONE" ? "OPEN" : "DONE";
    setBusyId(task.id);
    onChange(tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      onChange(tasks);
      toast.error("Could not update the task.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(task: TaskRow) {
    const ok = await confirm({
      title: "Withdraw this task?",
      description: `"${task.title}" will be removed.`,
      confirmLabel: "Withdraw",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(task.id);
    const prev = tasks;
    onChange(tasks.filter((t) => t.id !== task.id));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Task withdrawn.");
    } catch {
      onChange(prev);
      toast.error("Could not withdraw the task.");
    } finally {
      setBusyId(null);
    }
  }

  if (tasks.length === 0) {
    return <p className="card p-6 text-center text-sm text-muted">Nothing here.</p>;
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <Row
          key={t.id}
          task={t}
          showAssignee={showAssignee}
          showCreator={showCreator}
          onToggle={toggle}
          onDelete={remove}
          canDelete={t.createdById === currentUserId}
          busy={busyId === t.id}
        />
      ))}
    </ul>
  );
}

export default function TasksView({
  currentUserId,
  assignedToMe: initialAssignedToMe,
  createdByMe: initialCreatedByMe,
  staff,
}: {
  currentUserId: string;
  assignedToMe: TaskRow[];
  createdByMe: TaskRow[];
  staff: StaffOption[];
}) {
  const [assignedToMe, setAssignedToMe] = useState(initialAssignedToMe);
  const [createdByMe, setCreatedByMe] = useState(initialCreatedByMe);
  const [createOpen, setCreateOpen] = useState(false);

  const openCount = assignedToMe.filter((t) => t.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{openCount} open task{openCount === 1 ? "" : "s"} for you</span>
        <button type="button" className="btn-primary h-8 py-1 text-xs" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="h-3.5 w-3.5" /> New task
        </button>
      </div>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Assigned to you ({assignedToMe.length})</h2>
        <List
          tasks={assignedToMe}
          showAssignee={false}
          showCreator
          currentUserId={currentUserId}
          onChange={setAssignedToMe}
        />
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Assigned by you ({createdByMe.length})</h2>
        <List
          tasks={createdByMe}
          showAssignee
          showCreator={false}
          currentUserId={currentUserId}
          onChange={setCreatedByMe}
        />
      </section>

      {createOpen && (
        <CreateTaskDialog
          staff={staff}
          onClose={() => setCreateOpen(false)}
          onCreated={(task) => {
            setCreateOpen(false);
            if (task.assignedToId === currentUserId) {
              setAssignedToMe((cur) => [task, ...cur]);
            } else {
              setCreatedByMe((cur) => [task, ...cur]);
            }
          }}
        />
      )}
    </div>
  );
}
