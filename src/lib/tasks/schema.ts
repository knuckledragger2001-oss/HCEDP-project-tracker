import { z } from "zod";

// ---------------------------------------------------------------------------
// Pings — shared enums, labels and validation.
// ---------------------------------------------------------------------------
// A "ping" is a task assigned to one internal teammate: a title, an optional due
// date, and optionally the Placer AI request it's about. Assigning one notifies
// them straight away; the reminder sweep notifies them again as the due date
// nears and once it passes (src/lib/notifications/notify.ts).

export const TaskStatusEnum = z.enum(["OPEN", "DONE"]);
export type TaskStatusValue = z.infer<typeof TaskStatusEnum>;

export const TaskPriorityEnum = z.enum(["LOW", "NORMAL", "HIGH"]);
export type TaskPriorityValue = z.infer<typeof TaskPriorityEnum>;

// Order defines the dropdown order wherever priority is chosen.
export const TASK_PRIORITIES: { value: TaskPriorityValue; label: string }[] = [
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];

export const TASK_PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.value, p.label]),
);

export function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "HIGH":
      return "bg-red-100 text-red-700";
    case "LOW":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

// --- Due-date urgency ------------------------------------------------------

export type DueUrgency = "overdue" | "today" | "soon" | null;

/**
 * How pressing a due date is, for coloring. Date-only values are compared in
 * UTC (they are stored as UTC midnight — see formatDate in src/lib/format.ts)
 * against the viewer's own today, so "today" reads as today wherever you are.
 */
export function dueUrgency(
  dueDate: string | Date | null | undefined,
  status: TaskStatusValue | string = "OPEN",
): DueUrgency {
  if (!dueDate || status === "DONE") return null;
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  const diffDays = Math.round((dueDay - today) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 2) return "soon";
  return null;
}

/** Tailwind text classes for a due date at a given urgency. */
export function dueClass(urgency: DueUrgency): string {
  switch (urgency) {
    case "overdue":
      return "font-semibold text-danger";
    case "today":
      return "font-semibold text-warn";
    case "soon":
      return "font-semibold text-warn";
    default:
      return "text-muted";
  }
}

// --- Validation ------------------------------------------------------------

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

// Body accepted by POST /api/tasks. A ping always has someone to ping: the
// assignee is required, and the API checks they are internal staff.
export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, "What needs doing?"),
  details: optionalText,
  dueDate: optionalDate,
  assignedToId: z.string().trim().min(1, "Choose who to ping."),
  priority: TaskPriorityEnum.default("NORMAL"),
  /** The Placer AI request this ping is about, if any. */
  placerRequestId: z.string().trim().nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

// Body accepted by PATCH /api/tasks/[id]. Every field optional so a checkbox can
// send just { status }.
export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  details: optionalText,
  dueDate: optionalDate,
  assignedToId: z.string().trim().min(1).optional(),
  priority: TaskPriorityEnum.optional(),
  status: TaskStatusEnum.optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
