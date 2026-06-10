"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { stageBadgeClass } from "@/lib/format";

export default function ProjectStageSelect({
  projectId,
  stage: initial,
}: {
  projectId: string;
  stage: PipelineStageValue;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<PipelineStageValue>(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: PipelineStageValue) {
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
    <div className="flex items-center gap-2">
      <span className={`badge ${stageBadgeClass(stage)}`}>
        {PIPELINE_STAGES.find((s) => s.value === stage)?.label}
      </span>
      <select
        className="input w-48"
        value={stage}
        disabled={saving}
        onChange={(e) => change(e.target.value as PipelineStageValue)}
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
