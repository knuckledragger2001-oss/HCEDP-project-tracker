"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PIPELINE_STAGES } from "@/lib/projects/schema";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  stageBadgeClass,
  STAGE_LABELS,
} from "@/lib/format";
import { BuildingIcon } from "@/components/ui/icons";
import { dueUrgency, stageDate, type BoardProject } from "./helpers";

// Sort order of the stage column follows the pipeline sequence, not the label.
const STAGE_ORDER: Record<string, number> = Object.fromEntries(
  PIPELINE_STAGES.map((s, i) => [s.value, i]),
);

type SortKey =
  | "codename"
  | "stage"
  | "jobs"
  | "capex"
  | "acreage"
  | "sites"
  | "received"
  | "next";
type SortDir = "asc" | "desc";

// One accessor per sortable column: a comparable value (string or number).
function sortValue(p: BoardProject, key: SortKey): string | number {
  switch (key) {
    case "codename":
      return p.codename.toLowerCase();
    case "stage":
      return STAGE_ORDER[p.stage] ?? 99;
    case "jobs":
      return p.jobs ?? -1;
    case "capex":
      return p.capexTotal ? Number(p.capexTotal) : -1;
    case "acreage":
      return p.minAcreage ?? -1;
    case "sites":
      return p.submissionCount;
    case "received":
      return p.rfiReceivedDate ? new Date(p.rfiReceivedDate).getTime() : -1;
    case "next": {
      const sd = stageDate(p);
      return sd ? new Date(sd.date).getTime() : -1;
    }
  }
}

function SortHeader({
  label,
  col,
  sort,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortKey;
  sort: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === col;
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line bg-green-tint px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-brand" : "text-muted"}`}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 ${
          align === "right" ? "flex-row-reverse" : ""
        } hover:text-foreground`}
      >
        {label}
        <span aria-hidden className={active ? "text-brand" : "text-muted-2/70"}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

// Sortable, clickable table view of the pipeline. Filtering happens in the
// parent (PipelineWorkspace); this component only sorts and renders. Every row
// links to the project record — the same destination as a board card. Rows are
// deliberately dense so many projects read at a glance.
export default function ProjectsTable({ projects }: { projects: BoardProject[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("codename");
  const [dir, setDir] = useState<SortDir>("asc");

  function onSort(k: SortKey) {
    if (k === sort) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(k);
      // Text sorts read best ascending; numeric/date columns most-first.
      setDir(k === "codename" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const rows = [...projects];
    rows.sort((a, b) => {
      const va = sortValue(a, sort);
      const vb = sortValue(b, sort);
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      // Stable tiebreak by codename so equal values keep a predictable order.
      return a.codename.localeCompare(b.codename);
    });
    return rows;
  }, [projects, sort, dir]);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
        <thead>
          <tr>
            <SortHeader label="Project" col="codename" sort={sort} dir={dir} onSort={onSort} />
            <SortHeader label="Stage" col="stage" sort={sort} dir={dir} onSort={onSort} />
            <SortHeader label="Jobs" col="jobs" sort={sort} dir={dir} onSort={onSort} align="right" />
            <SortHeader label="Capex" col="capex" sort={sort} dir={dir} onSort={onSort} align="right" />
            <SortHeader label="Acreage" col="acreage" sort={sort} dir={dir} onSort={onSort} align="right" />
            <SortHeader label="Sites" col="sites" sort={sort} dir={dir} onSort={onSort} align="right" />
            <SortHeader label="Received" col="received" sort={sort} dir={dir} onSort={onSort} align="right" />
            <SortHeader label="Next date" col="next" sort={sort} dir={dir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const sd = stageDate(p);
            const urgency = dueUrgency(p);
            const nextCls =
              urgency === "overdue"
                ? "font-semibold text-danger"
                : urgency === "soon"
                  ? "font-semibold text-warn"
                  : "text-muted";
            return (
              <tr
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                className="group cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-surface-2"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#d6e5dc] bg-green-tint">
                      <BuildingIcon className="h-4 w-4 text-brand" />
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={`/projects/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-semibold text-foreground group-hover:text-brand"
                      >
                        {p.codename}
                      </Link>
                      {p.industryDescription && (
                        <span className="block max-w-[240px] truncate text-[11px] text-muted">
                          {p.industryDescription}
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`badge ${stageBadgeClass(p.stage)}`}>
                    {STAGE_LABELS[p.stage] ?? p.stage}
                  </span>
                </td>
                <td className="mono px-3 py-2 text-right text-foreground">
                  {p.jobs != null ? formatNumber(p.jobs) : <span className="text-muted-2">—</span>}
                </td>
                <td className="mono px-3 py-2 text-right text-foreground">
                  {p.capexTotal ? formatCurrency(p.capexTotal) : <span className="text-muted-2">—</span>}
                </td>
                <td className="mono px-3 py-2 text-right text-foreground">
                  {p.minAcreage != null ? formatNumber(p.minAcreage) : <span className="text-muted-2">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.submissionCount > 0 ? (
                    <span className="badge bg-info/15 text-accent-dark">
                      {p.submissionCount}
                    </span>
                  ) : (
                    <span className="text-muted-2">—</span>
                  )}
                </td>
                <td className="mono px-3 py-2 text-right text-muted">
                  {formatDate(p.rfiReceivedDate)}
                </td>
                <td className={`mono whitespace-nowrap px-3 py-2 ${nextCls}`}>
                  {sd ? `${sd.label} ${formatDate(sd.date)}` : <span className="text-muted-2">—</span>}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-2">
                No projects match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
