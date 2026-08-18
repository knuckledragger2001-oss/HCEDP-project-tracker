"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/ui/Toast";
import { Area, DateInput, Field, Select, Text } from "@/components/intake/fields";
import { TASK_PRIORITIES } from "@/lib/tasks/schema";
import type { StaffOption } from "@/components/placer/PlacerBoard";
import type { TaskRow } from "./TasksView";

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }));

export default function CreateTaskDialog({
  staff,
  onClose,
  onCreated,
}: {
  staff: StaffOption[];
  onClose: () => void;
  onCreated: (task: TaskRow) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState(staff[0]?.id ?? "");
  const [priority, setPriority] = useState("NORMAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim()) return setError("What needs doing?");
    if (!assignedToId) return setError("Choose who to ping.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, details, dueDate, assignedToId, priority }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not send the ping.");
      onCreated(body.task as TaskRow);
      toast.success("Ping sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the ping.");
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">New ping</h2>
        <p className="mt-0.5 text-xs text-muted">Assign something to a teammate.</p>

        <div className="mt-4 space-y-3">
          <Field label="What needs doing? *">
            <Text value={title} onChange={setTitle} placeholder="e.g. Follow up with Buda on parade dates" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assign to *">
              <Select
                value={assignedToId}
                onChange={setAssignedToId}
                options={staff.map((s) => ({ value: s.id, label: s.label }))}
              />
            </Field>
            <Field label="Priority">
              <Select value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
            </Field>
          </div>
          <Field label="Due date (optional)">
            <DateInput value={dueDate} onChange={setDueDate} />
          </Field>
          <Field label="Details (optional)">
            <Area value={details} onChange={setDetails} rows={3} />
          </Field>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? "Sending…" : "Send ping"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
