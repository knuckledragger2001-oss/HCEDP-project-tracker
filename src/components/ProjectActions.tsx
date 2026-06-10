"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

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
    } catch {
      alert("Could not update the project.");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (typed !== codename) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.push("/");
      router.refresh();
    } catch {
      alert("Could not delete the project.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary text-xs"
          onClick={toggleArchive}
          disabled={busy}
        >
          {archived ? "Unarchive" : "Archive"}
        </button>
        <button
          className="btn-danger text-xs"
          onClick={() => setConfirming((v) => !v)}
          disabled={busy}
        >
          Delete
        </button>
      </div>

      {confirming && (
        <div className="card w-72 border-red-200 p-3">
          <p className="text-xs text-gray-600">
            This permanently deletes the project and all its data. Type{" "}
            <span className="font-semibold text-gray-900">{codename}</span> to
            confirm.
          </p>
          <input
            className="input mt-2 text-sm"
            placeholder="Project codename"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                setConfirming(false);
                setTyped("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="btn-danger text-xs"
              onClick={doDelete}
              disabled={busy || typed !== codename}
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
