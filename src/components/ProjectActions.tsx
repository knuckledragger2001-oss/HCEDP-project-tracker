"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";

export default function ProjectActions({
  projectId,
  codename,
  archived,
}: {
  projectId: string;
  codename: string;
  archived: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function toggleArchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      toast.success(archived ? "Project unarchived." : "Project archived.");
    } catch {
      toast.error("Could not update the project.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    if (res.ok) {
      router.push(`/projects/${projectId}`);
      router.refresh();
      toast.info("Project restored.");
    } else {
      toast.error("Could not restore the project.");
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${codename}?`,
      description:
        "This removes the project and all its data from the board and reports. You can undo this right after.",
      confirmLabel: "Delete permanently",
      tone: "danger",
      requireText: codename,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
      router.refresh();
      toast.success(`Deleted ${codename}.`, {
        action: { label: "Undo", onClick: restore },
      });
    } catch {
      toast.error("Could not delete the project.");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button className="btn-secondary text-xs" onClick={toggleArchive} disabled={busy}>
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button
        className="btn-danger inline-flex items-center gap-1 text-xs"
        onClick={onDelete}
        disabled={busy}
      >
        <TrashIcon className="text-sm" />
        Delete
      </button>
    </div>
  );
}
