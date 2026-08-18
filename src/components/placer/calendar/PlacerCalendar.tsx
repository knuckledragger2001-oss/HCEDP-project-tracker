"use client";

// The planning calendar: future Placer AI requests (one-off or recurring),
// shown on a month grid by event date. Drag a plan to a different day to
// reschedule it — its queue date (when it becomes a live request) shifts by the
// same number of days, preserving the lead time it was set up with. Plans with
// no date yet sit in the "Unscheduled" tray; drag one onto a day to date it.

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { PARTNER_CITY_LABELS, reportTypeLabel, type PartnerCityValue } from "@/lib/placer/schema";
import { toDateKey, addUtcDays, startOfUtcDay } from "@/lib/placer/recurrence";
import { PlusIcon, ChevronDownIcon } from "@/components/ui/icons";
import type { StaffOption } from "@/components/placer/PlacerBoard";
import PlanDialog from "./PlanDialog";
import SeriesPanel from "./SeriesPanel";

export interface CalendarPlan {
  id: string;
  city: PartnerCityValue;
  placeName: string;
  locationAddress: string | null;
  reportType: string;
  reportTypeOther: string | null;
  purpose: string | null;
  eventDate: string | null;
  eventEndDate: string | null;
  queueOnDate: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  seriesId: string | null;
}

export interface SeriesSummary {
  id: string;
  city: PartnerCityValue;
  placeName: string;
  reportType: string;
  active: boolean;
  leadDays: number;
  assignedToId: string | null;
  assignedToName: string | null;
  description: string;
  occurrenceCount: number;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UNSCHEDULED_ID = "__unscheduled__";

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// The 6-week grid a month view needs, padded with the trailing/leading days of
// neighboring months so every week is full.
function monthGrid(monthStart: Date): Date[] {
  const firstWeekday = monthStart.getUTCDay();
  const gridStart = addUtcDays(monthStart, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addUtcDays(gridStart, i));
}

function Chip({ plan }: { plan: CalendarPlan }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plan.id });
  const reportLabel =
    plan.reportType === "OTHER" && plan.reportTypeOther
      ? plan.reportTypeOther
      : reportTypeLabel(plan.reportType);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-md border border-line bg-surface px-1.5 py-1 text-[11px] leading-tight shadow-sm transition-opacity hover:border-brand/40 ${
        isDragging ? "opacity-30" : ""
      }`}
      title={`${plan.placeName} · ${reportLabel}${plan.queueOnDate ? ` · queues ${formatDate(plan.queueOnDate)}` : ""}`}
    >
      <span className="flex items-center gap-1">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
          aria-hidden
        />
        <span className="truncate font-medium text-foreground">{plan.placeName}</span>
      </span>
      <span className="block truncate pl-2.5 text-muted-2">
        {PARTNER_CITY_LABELS[plan.city]}
        {plan.seriesId ? " · repeats" : ""}
      </span>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  plans,
  onAdd,
  onOpen,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  plans: CalendarPlan[];
  onAdd: (date: Date) => void;
  onOpen: (plan: CalendarPlan) => void;
}) {
  const key = toDateKey(date);
  const { setNodeRef, isOver } = useDroppable({ id: key });
  return (
    <div
      ref={setNodeRef}
      className={`group flex min-h-[6.5rem] flex-col gap-1 border border-line/70 p-1 transition-colors ${
        inMonth ? "bg-surface" : "bg-surface-2/60"
      } ${isOver ? "border-brand/50 bg-green-tint" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] font-semibold ${
            isToday
              ? "grid h-5 w-5 place-items-center rounded-full bg-brand text-white"
              : inMonth
                ? "text-foreground"
                : "text-muted-2"
          }`}
        >
          {date.getUTCDate()}
        </span>
        <button
          type="button"
          onClick={() => onAdd(date)}
          className="hidden rounded p-0.5 text-muted-2 hover:bg-brand/10 hover:text-brand group-hover:block"
          title="Add a plan on this date"
          aria-label="Add a plan on this date"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {plans.map((p) => (
          <div key={p.id} onClick={() => onOpen(p)}>
            <Chip plan={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlacerCalendar({
  initialPlans,
  initialSeries,
  staff,
}: {
  initialPlans: CalendarPlan[];
  initialSeries: SeriesSummary[];
  staff: StaffOption[];
}) {
  const toast = useToast();
  const [plans, setPlans] = useState(initialPlans);
  const [series, setSeries] = useState(initialSeries);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [dialog, setDialog] = useState<
    { mode: "add"; date: Date | null } | { mode: "edit"; plan: CalendarPlan } | null
  >(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<"all" | PartnerCityValue>("all");
  const [showSeries, setShowSeries] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const today = startOfUtcDay(new Date());
  const grid = useMemo(() => monthGrid(month), [month]);

  const visiblePlans = useMemo(
    () => plans.filter((p) => cityFilter === "all" || p.city === cityFilter),
    [plans, cityFilter],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPlan[]>();
    for (const p of visiblePlans) {
      if (!p.eventDate) continue;
      const key = toDateKey(new Date(p.eventDate));
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [visiblePlans]);
  const unscheduled = useMemo(
    () => visiblePlans.filter((p) => !p.eventDate),
    [visiblePlans],
  );

  function upsertPlan(next: CalendarPlan) {
    setPlans((cur) => {
      const exists = cur.some((p) => p.id === next.id);
      return exists ? cur.map((p) => (p.id === next.id ? next : p)) : [next, ...cur];
    });
  }
  function removePlan(id: string) {
    setPlans((cur) => cur.filter((p) => p.id !== id));
  }
  function markReleased(id: string) {
    removePlan(id);
    toast.success("Released into the queue.");
  }

  async function moveTo(planId: string, newKey: string | null) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    const prevKey = plan.eventDate ? toDateKey(new Date(plan.eventDate)) : null;
    if (prevKey === newKey) return;

    const prev = plans;
    const eventDate = newKey ? new Date(`${newKey}T00:00:00.000Z`) : null;
    // Mirror the server's queue-date shift locally for an instant, correct
    // preview; the PATCH response isn't needed to keep the UI consistent.
    let queueOnDate = plan.queueOnDate;
    if (eventDate && plan.eventDate && plan.queueOnDate) {
      const shiftDays = Math.round(
        (eventDate.getTime() - new Date(plan.eventDate).getTime()) / 86_400_000,
      );
      queueOnDate = new Date(
        new Date(plan.queueOnDate).getTime() + shiftDays * 86_400_000,
      ).toISOString();
    }
    setPlans((cur) =>
      cur.map((p) =>
        p.id === planId
          ? { ...p, eventDate: eventDate?.toISOString() ?? null, queueOnDate }
          : p,
      ),
    );
    try {
      const res = await fetch(`/api/placer-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDate: newKey ?? "" }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setPlans(prev);
      toast.error("Could not move the plan. Please try again.");
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : undefined;
    if (!over) return;
    moveTo(id, over === UNSCHEDULED_ID ? null : over);
  }

  const activePlan = plans.find((p) => p.id === activeId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary h-8 py-1 text-xs" onClick={() => setDialog({ mode: "add", date: null })}>
          <PlusIcon className="h-3.5 w-3.5" /> Add plan
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn-secondary h-8 w-8 justify-center py-1 text-xs"
            onClick={() => setMonth((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-semibold text-foreground">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            className="btn-secondary h-8 w-8 justify-center py-1 text-xs"
            onClick={() => setMonth((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)))}
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            className="btn-secondary h-8 py-1 text-xs"
            onClick={() => setMonth(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)))}
          >
            Today
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-muted">
          <span className="text-xs font-medium text-muted">City</span>
          <select
            className="input h-8 w-auto py-1 text-xs"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value as "all" | PartnerCityValue)}
          >
            <option value="all">All cities</option>
            {Object.entries(PARTNER_CITY_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ml-auto flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          onClick={() => setShowSeries((v) => !v)}
        >
          Recurring plans ({series.filter((s) => s.active).length} active)
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showSeries ? "rotate-180" : ""}`} />
        </button>
      </div>

      {showSeries && (
        <SeriesPanel series={series} staff={staff} onChange={setSeries} onPlansChanged={() => window.location.reload()} />
      )}

      <DndContext id="placer-calendar" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-[1fr_14rem] gap-3">
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-[11px] font-semibold text-muted">
              {WEEKDAY_SHORT.map((d) => (
                <div key={d} className="px-2 py-1.5 text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((date) => (
                <DayCell
                  key={date.toISOString()}
                  date={date}
                  inMonth={date.getUTCMonth() === month.getUTCMonth()}
                  isToday={date.getTime() === today.getTime()}
                  plans={byDay.get(toDateKey(date)) ?? []}
                  onAdd={(d) => setDialog({ mode: "add", date: d })}
                  onOpen={(plan) => setDialog({ mode: "edit", plan })}
                />
              ))}
            </div>
          </div>

          <UnscheduledTray plans={unscheduled} onOpen={(plan) => setDialog({ mode: "edit", plan })} />
        </div>

        <DragOverlay>
          {activePlan ? (
            <div className="w-40">
              <Chip plan={activePlan} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {dialog && (
        <PlanDialog
          mode={dialog.mode}
          date={dialog.mode === "add" ? dialog.date : null}
          plan={dialog.mode === "edit" ? dialog.plan : null}
          staff={staff}
          onClose={() => setDialog(null)}
          onCreated={(plan) => {
            upsertPlan(plan);
            setDialog(null);
          }}
          onCreatedSeries={() => {
            setDialog(null);
            window.location.reload();
          }}
          onUpdated={(plan) => {
            upsertPlan(plan);
            setDialog(null);
          }}
          onDeleted={(id) => {
            removePlan(id);
            setDialog(null);
          }}
          onReleased={(id) => {
            markReleased(id);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function UnscheduledTray({
  plans,
  onOpen,
}: {
  plans: CalendarPlan[];
  onOpen: (plan: CalendarPlan) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED_ID });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-1.5 rounded-xl border p-2 ${
        isOver ? "border-brand/50 bg-green-tint" : "border-line bg-surface-2"
      }`}
    >
      <div className="px-1 text-xs font-semibold text-foreground">
        Unscheduled ({plans.length})
      </div>
      <p className="px-1 text-[11px] text-muted-2">
        No date yet — drag onto a day, or drag a plan here to clear its date.
      </p>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {plans.map((p) => (
          <div key={p.id} onClick={() => onOpen(p)}>
            <Chip plan={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
