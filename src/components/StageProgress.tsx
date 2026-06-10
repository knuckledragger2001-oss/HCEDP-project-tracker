"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";

// Progress stages run left-to-right; LOST is a terminal off-track outcome.
const PROGRESS = PIPELINE_STAGES.filter((s) => s.value !== "LOST");
const LOST = PIPELINE_STAGES.find((s) => s.value === "LOST")!;

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
}: {
  projectId: string;
  stage: PipelineStageValue;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<PipelineStageValue>(initial);
  const [saving, setSaving] = useState(false);

  const currentIndex = PROGRESS.findIndex((s) => s.value === stage);
  const isLost = stage === "LOST";

  async function change(next: PipelineStageValue) {
    if (next === stage || saving) return;
    const prev = stage;
    setStage(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setStage(prev);
      alert("Could not change stage.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <div className="flex items-stretch">
        {PROGRESS.map((s, i) => {
          const reached = !isLost && i <= currentIndex;
          const isCurrent = !isLost && i === currentIndex;
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
    </div>
  );
}
