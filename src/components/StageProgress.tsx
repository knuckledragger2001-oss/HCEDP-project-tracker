"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { useToast } from "@/components/ui/Toast";

// Progress stages run left-to-right; LOST and NO_SUBMISSION are terminal
// off-track outcomes shown as separate buttons.
const TERMINAL: PipelineStageValue[] = ["LOST", "NO_SUBMISSION"];
const PROGRESS = PIPELINE_STAGES.filter((s) => !TERMINAL.includes(s.value));
const LOST = PIPELINE_STAGES.find((s) => s.value === "LOST")!;
const NO_SUBMISSION = PIPELINE_STAGES.find((s) => s.value === "NO_SUBMISSION")!;

// Gradient endpoints: a light green that deepens to saturated brand green.
const FROM: [number, number, number] = [191, 224, 205]; // #BFE0CD
const TO: [number, number, number] = [23, 76, 52]; // #174C34

function gradientColor(index: number, count: number): string {
  const t = count <= 1 ? 1 : index / (count - 1);
  const c = FROM.map((f, i) => Math.round(f + (TO[i] - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Darker greens need white text; lighter ones read better with dark text.
function textColor(index: number, count: number): string {
  const t = count <= 1 ? 1 : index / (count - 1);
  return t > 0.45 ? "#ffffff" : "#15392a";
}

// Breadcrumb-style right-pointing arrow; first segment has no left notch.
function clipFor(first: boolean): string {
  return first
    ? "polygon(0% 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 0% 100%)"
    : "polygon(0% 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 0% 100%, 12px 50%)";
}

export default function StageProgress({
  projectId,
  stage: initial,
  wonSiteId,
  submittedSites,
}: {
  projectId: string;
  stage: PipelineStageValue;
  wonSiteId: string | null;
  // Sites submitted for this project — the choices when marking the project Won.
  submittedSites: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [stage, setStage] = useState<PipelineStageValue>(initial);
  const [saving, setSaving] = useState(false);
  // Won-site picker: choosing which submitted site was selected when we win, so
  // the project rolls up under exactly one community in reports.
  const [wonPickerOpen, setWonPickerOpen] = useState(false);
  const [pickedSite, setPickedSite] = useState<string>(wonSiteId ?? "");

  const currentIndex = PROGRESS.findIndex((s) => s.value === stage);
  const isLost = stage === "LOST";
  const isNoSubmission = stage === "NO_SUBMISSION";
  const wonSiteName =
    submittedSites.find((s) => s.id === wonSiteId)?.name ?? null;

  // Perform the stage change (and any extra fields) with optimistic UI.
  async function commit(
    next: PipelineStageValue,
    extra: Record<string, unknown> = {},
  ) {
    const prev = stage;
    setStage(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next, ...extra }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      const label =
        PIPELINE_STAGES.find((s) => s.value === next)?.label ?? "new stage";
      toast.success(`Moved to ${label}.`);
    } catch {
      setStage(prev);
      toast.error("Could not change stage.");
    } finally {
      setSaving(false);
    }
  }

  async function change(next: PipelineStageValue) {
    if (saving) return;

    // Winning: prompt to pick which submitted site was chosen, so the project
    // reports under one community. Re-opening the picker while already Won lets
    // staff change the chosen site.
    if (next === "WON") {
      if (submittedSites.length === 0) {
        if (next === stage) return;
        await commit("WON");
        return;
      }
      setPickedSite(wonSiteId ?? submittedSites[0]?.id ?? "");
      setWonPickerOpen(true);
      return;
    }

    if (next === stage) return;

    // Moving into "No Submission" requires recording why we chose not to submit.
    if (next === "NO_SUBMISSION") {
      const reason = window.prompt(
        "Why did we choose not to submit for this project?",
      );
      if (reason === null) return; // cancelled
      const trimmed = reason.trim();
      if (!trimmed) {
        toast.error("A reason is required to move a project to No Submission.");
        return;
      }
      await commit("NO_SUBMISSION", { noSubmissionReason: trimmed });
      return;
    }

    await commit(next);
  }

  async function confirmWon() {
    setWonPickerOpen(false);
    await commit("WON", { wonSiteId: pickedSite || null });
  }

  return (
    <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-1">
      <div className="flex items-stretch">
        {PROGRESS.map((s, i) => {
          const offTrack = isLost || isNoSubmission;
          const reached = !offTrack && i <= currentIndex;
          const isCurrent = !offTrack && i === currentIndex;
          const bg = reached ? gradientColor(i, PROGRESS.length) : "#eef0f2";
          const fg = reached ? textColor(i, PROGRESS.length) : "#9aa1a9";
          return (
            <button
              key={s.value}
              type="button"
              disabled={saving}
              onClick={() => change(s.value)}
              title={s.label}
              className={`relative -ml-2 first:ml-0 px-3 py-1.5 text-xs font-semibold transition-transform disabled:cursor-wait ${
                isCurrent ? "scale-[1.03]" : "hover:brightness-110"
              }`}
              style={{
                backgroundColor: bg,
                color: fg,
                clipPath: clipFor(i === 0),
                boxShadow: isCurrent ? "inset 0 0 0 2px rgba(0,0,0,0.18)" : "none",
                zIndex: PROGRESS.length - i,
              }}
            >
              <span className="pl-1">{s.label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => change(LOST.value as PipelineStageValue)}
        title="Mark as lost"
        className="ml-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait"
        style={{
          backgroundColor: isLost ? "#b91c1c" : "#f3f4f6",
          color: isLost ? "#ffffff" : "#9aa1a9",
          boxShadow: isLost ? "inset 0 0 0 2px rgba(0,0,0,0.18)" : "none",
        }}
      >
        {LOST.label}
      </button>

      <button
        type="button"
        disabled={saving}
        onClick={() => change(NO_SUBMISSION.value as PipelineStageValue)}
        title="We chose not to submit"
        className="ml-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait"
        style={{
          backgroundColor: isNoSubmission ? "#475569" : "#f3f4f6",
          color: isNoSubmission ? "#ffffff" : "#9aa1a9",
          boxShadow: isNoSubmission ? "inset 0 0 0 2px rgba(0,0,0,0.18)" : "none",
        }}
      >
        {NO_SUBMISSION.label}
      </button>
    </div>

    {/* Won-site picker: which submitted site was chosen. */}
    {wonPickerOpen && (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand/30 bg-brand/5 p-2">
        <span className="text-xs font-semibold text-brand">Chosen site:</span>
        <select
          className="input h-8 w-56 py-1 text-sm"
          value={pickedSite}
          onChange={(e) => setPickedSite(e.target.value)}
          disabled={saving}
        >
          <option value="">— No specific site —</option>
          {submittedSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary h-8 py-1 text-xs"
          onClick={confirmWon}
          disabled={saving}
        >
          Confirm Won
        </button>
        <button
          type="button"
          className="text-xs text-gray-500 hover:underline"
          onClick={() => setWonPickerOpen(false)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    )}

    {/* When already Won, show the chosen site with a shortcut to change it. */}
    {!wonPickerOpen && stage === "WON" && (
      <div className="text-xs text-gray-500">
        Chosen site: <span className="font-medium text-gray-700">{wonSiteName ?? "— none —"}</span>
        {submittedSites.length > 0 && (
          <button
            type="button"
            className="ml-2 text-brand hover:underline"
            onClick={() => change("WON")}
            disabled={saving}
          >
            change
          </button>
        )}
      </div>
    )}
    </div>
  );
}
