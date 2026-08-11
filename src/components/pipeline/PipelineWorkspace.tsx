"use client";

import { useEffect, useMemo, useState } from "react";
import { PIPELINE_STAGES, type PipelineStageValue } from "@/lib/projects/schema";
import { useToast } from "@/components/ui/Toast";
import { BoardIcon, TableIcon } from "@/components/ui/icons";
import BoardView from "./BoardView";
import ProjectsTable from "./ProjectsTable";
import {
  periodBounds,
  type ArchiveMode,
  type BoardProject,
  type DateMode,
} from "./helpers";

type View = "board" | "table";
const VIEW_KEY = "hcedp.pipeline.view";

// The pipeline workspace: shared filters and a Board / Table toggle over one
// filtered dataset. The board and the table are two lenses on the same projects,
// so a filter applies identically to both. Stage changes (the drag-to-move
// mutation) live here so the optimistic update flows to whichever view is shown.
export default function PipelineWorkspace({
  initialProjects,
}: {
  initialProjects: BoardProject[];
}) {
  const toast = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [view, setView] = useState<View>("board");
  const [dateMode, setDateMode] = useState<DateMode>("all");
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>("active");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [query, setQuery] = useState("");

  // Remember the chosen view across visits. This must be read after mount, not
  // in a lazy initializer: the server always renders the default ("board"), so
  // adopting the saved value on the client has to happen post-hydration to keep
  // the first client render identical to the server's.
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of a persisted preference; no cascading render loop
    if (saved === "board" || saved === "table") setView(saved);
  }, []);
  function chooseView(v: View) {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  const visible = useMemo(() => {
    const { start, end } = periodBounds(dateMode, customStart, customEnd);
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (archiveMode === "active" && p.archived) return false;
      if (archiveMode === "archived" && !p.archived) return false;
      if (start || end) {
        if (!p.rfiReceivedDate) return false;
        const d = new Date(p.rfiReceivedDate);
        if (start && d < start) return false;
        if (end && d > end) return false;
      }
      if (q) {
        const haystack = `${p.codename} ${p.industryDescription ?? ""} ${p.naicsCode ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [projects, dateMode, archiveMode, customStart, customEnd, query]);

  async function moveProject(id: string, stage: PipelineStageValue) {
    // Moving into "No Submission" requires recording why we chose not to submit.
    let noSubmissionReason: string | undefined;
    if (stage === "NO_SUBMISSION") {
      const reason = window.prompt(
        "Why did we choose not to submit for this project?",
      );
      if (reason === null) return; // cancelled — leave the card where it was
      const trimmed = reason.trim();
      if (!trimmed) {
        toast.error("A reason is required to move a project to No Submission.");
        return;
      }
      noSubmissionReason = trimmed;
    }

    const prev = projects;
    setProjects((cur) => cur.map((p) => (p.id === id ? { ...p, stage } : p)));
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          noSubmissionReason ? { stage, noSubmissionReason } : { stage },
        ),
      });
      if (!res.ok) throw new Error("Failed");
      const label = PIPELINE_STAGES.find((s) => s.value === stage)?.label ?? "new stage";
      toast.success(`Moved to ${label}.`);
    } catch {
      setProjects(prev);
      toast.error("Could not update stage. Please try again.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {/* Board / Table toggle: two lenses on the same filtered projects. */}
        <div className="inline-flex rounded-lg border border-line-2 bg-surface p-0.5">
          <button
            type="button"
            onClick={() => chooseView("board")}
            aria-pressed={view === "board"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              view === "board"
                ? "bg-brand text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <BoardIcon className="h-3.5 w-3.5" /> Board
          </button>
          <button
            type="button"
            onClick={() => chooseView("table")}
            aria-pressed={view === "table"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              view === "table"
                ? "bg-brand text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" /> Table
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-muted">
          <span className="text-xs font-medium text-muted-2">Received</span>
          <select
            className="input h-8 w-auto py-1 text-xs"
            value={dateMode}
            onChange={(e) => setDateMode(e.target.value as DateMode)}
          >
            <option value="all">All time</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="fy">This fiscal year (Oct–Sep)</option>
            <option value="custom">Custom range…</option>
          </select>
        </label>
        {dateMode === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="input h-8 py-1 text-xs"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-xs text-muted-2">to</span>
            <input
              type="date"
              className="input h-8 py-1 text-xs"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
        <label className="flex items-center gap-1.5 text-muted">
          <span className="text-xs font-medium text-muted-2">Show</span>
          <select
            className="input h-8 w-auto py-1 text-xs"
            value={archiveMode}
            onChange={(e) => setArchiveMode(e.target.value as ArchiveMode)}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search codename, industry, NAICS…"
            className="input h-8 w-56 py-1 pl-7 text-xs"
            aria-label="Search projects"
          />
          <svg
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a1 1 0 01-1.42 1.42l-3.08-3.08A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <span className="text-xs text-muted-2">
          {visible.length} project{visible.length === 1 ? "" : "s"}
          {query.trim() ? " match" : ""}
        </span>
      </div>

      {view === "board" ? (
        <BoardView projects={visible} onMove={moveProject} />
      ) : (
        <ProjectsTable projects={visible} />
      )}
    </div>
  );
}
