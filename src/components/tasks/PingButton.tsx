"use client";

// Reusable "Ping" action: a button that opens a small popover to assign a task
// to a teammate, optionally about a specific Placer AI request. Used on the
// Placer request detail page and the planning calendar.

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { PingIcon } from "@/components/ui/icons";
import type { StaffOption } from "@/components/placer/PlacerBoard";

export default function PingButton({
  staff,
  placerRequestId,
  defaultTitle,
  className,
}: {
  staff: StaffOption[];
  placerRequestId?: string;
  defaultTitle: string;
  className?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [assignedToId, setAssignedToId] = useState(staff[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) setTitle(defaultTitle);
      return next;
    });
  }

  async function send() {
    if (!assignedToId) {
      toast.error("Choose who to ping.");
      return;
    }
    if (!title.trim()) {
      toast.error("Say what needs doing.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assignedToId,
          dueDate,
          placerRequestId: placerRequestId ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const who = staff.find((s) => s.id === assignedToId)?.label ?? "them";
      toast.success(`Pinged ${who}.`);
      setOpen(false);
      setDueDate("");
    } catch {
      toast.error("Could not send the ping. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block" ref={boxRef}>
      <button
        type="button"
        className={className ?? "btn-secondary h-8 py-1 text-xs"}
        onClick={toggleOpen}
      >
        <PingIcon className="h-3.5 w-3.5" /> Ping
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 space-y-2.5 rounded-xl border border-line bg-surface p-3 shadow-xl">
          <div className="text-xs font-semibold text-foreground">Ping a teammate</div>
          <input
            className="input h-8 py-1 text-xs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input h-8 py-1 text-xs"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <input
              type="date"
              className="input mono h-8 py-1 text-xs"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary h-7 py-0.5 text-xs" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary h-7 py-0.5 text-xs" onClick={send} disabled={busy}>
              {busy ? "Sending…" : "Send ping"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
