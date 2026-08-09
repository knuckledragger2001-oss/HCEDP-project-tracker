"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";
import {
  REQUEST_STATUSES,
  type RequestStatusValue,
} from "@/lib/placer/schema";
import type { StaffOption } from "@/components/placer/PlacerBoard";

export interface DetailValues {
  id: string;
  status: RequestStatusValue;
  assignedToId: string | null;
  internalNotes: string;
  resultNote: string;
}

// Internal editor for a single Placer request: triage its status, assignee,
// working notes and the result shared back to the partner.
export default function RequestDetail({
  request,
  staff,
}: {
  request: DetailValues;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<RequestStatusValue>(request.status);
  const [assignedToId, setAssignedToId] = useState(request.assignedToId ?? "");
  const [internalNotes, setInternalNotes] = useState(request.internalNotes);
  const [resultNote, setResultNote] = useState(request.resultNote);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    let statusReason: string | undefined;
    if (status === "DECLINED" && request.status !== "DECLINED") {
      const reason = window.prompt("Why are we declining this request?");
      if (reason === null) return;
      const trimmed = reason.trim();
      if (!trimmed) {
        toast.error("A reason is required to decline a request.");
        return;
      }
      statusReason = trimmed;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/placer-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          assignedToId: assignedToId || null,
          internalNotes,
          resultNote,
          ...(statusReason ? { statusReason } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Saved.");
      router.refresh();
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this request?",
      description: "It will be removed from the queue and the partner's list.",
      confirmLabel: "Delete request",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/placer-requests/${request.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Request deleted.");
      router.push("/placer");
    } catch {
      toast.error("Could not delete. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as RequestStatusValue)}
            disabled={busy}
          >
            {REQUEST_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Assigned to</label>
          <select
            className="input"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            disabled={busy}
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Internal notes (staff only)</label>
        <textarea
          className="input min-h-24"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Working notes — never shown to the partner."
          disabled={busy}
        />
      </div>

      <div>
        <label className="label">
          Result (shown to the partner when completed)
        </label>
        <textarea
          className="input min-h-24"
          value={resultNote}
          onChange={(e) => setResultNote(e.target.value)}
          placeholder="Link to the delivered report or a short summary."
          disabled={busy}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDelete}
          className="btn-danger"
          disabled={busy}
        >
          <TrashIcon className="text-sm" />
          Delete
        </button>
        <button
          type="button"
          onClick={onSave}
          className="btn-primary"
          disabled={busy}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
