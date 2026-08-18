// ---------------------------------------------------------------------------
// Recurrence math for the Placer AI planning calendar.
// ---------------------------------------------------------------------------
// Pure functions, no database, no timezone surprises: every date here is a
// calendar date held as UTC midnight, exactly like the rest of the app's
// date-only values (see formatDate in src/lib/format.ts). This is the single
// implementation of "the third Friday of every quarter" — the generator
// (src/lib/placer/planning.ts), the API and the UI preview all call it, so a
// planned occurrence can never land on a different day than the one a user was
// shown.

export type RecurrenceValue = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
export type RecurrenceModeValue = "DAY_OF_MONTH" | "NTH_WEEKDAY";

export interface RecurrencePattern {
  frequency: RecurrenceValue;
  /** "Every N" of the unit implied by frequency. Quarterly interval 1 = 3 months. */
  interval: number;
  mode: RecurrenceModeValue;
  /** DAY_OF_MONTH: 1–31, clamped down in short months (31 → Feb 28/29). */
  dayOfMonth: number | null;
  /** 0 = Sunday … 6 = Saturday. Used by NTH_WEEKDAY, and by WEEKLY to pick the day. */
  weekday: number | null;
  /** NTH_WEEKDAY: 1–4, or -1 for "last". */
  weekOfMonth: number | null;
  /** First date the pattern can produce, and the anchor the stepping counts from. */
  startDate: Date;
  /** Last date the pattern can produce. Null = open-ended. */
  endDate: Date | null;
}

// Hard stop so a pathological pattern (tiny interval, distant horizon) can never
// spin. 600 steps covers 50 years of monthly occurrences.
const MAX_STEPS = 600;

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEK_OF_MONTH_LABELS: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  [-1]: "last",
};

/** UTC midnight for a Y/M/D triple. month is 0-based, matching Date.UTC. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Strips any time-of-day, keeping the UTC calendar date. */
export function startOfUtcDay(d: Date): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Today's calendar date in UTC — the app's "today" for every date-only field. */
export function todayUtc(): Date {
  return startOfUtcDay(new Date());
}

export function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** Adds whole months, clamping the day into the target month (Jan 31 + 1 = Feb 28). */
export function addUtcMonths(d: Date, months: number): Date {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const day = Math.min(d.getUTCDate(), daysInUtcMonth(year, month));
  return utcDate(year, month, day);
}

export function daysInUtcMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Parses a date-only input ("YYYY-MM-DD") into UTC midnight — how every calendar
 * date in the app is stored. Empty / null / undefined all give null.
 */
export function parseUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** The inverse: a UTC date as the "YYYY-MM-DD" an <input type="date"> wants. */
export function toDateKey(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

/** Whole days between two calendar dates (b - a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / 86_400_000,
  );
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}

/**
 * The nth `weekday` of a month, e.g. the third Friday of March 2026.
 * nth 1–4 counts from the start; -1 means the last one in the month.
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number,
): Date {
  if (nth === -1) {
    const last = daysInUtcMonth(year, month);
    const lastDate = utcDate(year, month, last);
    const back = (lastDate.getUTCDay() - weekday + 7) % 7;
    return utcDate(year, month, last - back);
  }
  const first = utcDate(year, month, 1);
  const forward = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + forward + (nth - 1) * 7;
  // A "fifth Tuesday" that doesn't exist falls back to the last one in the month.
  return day > daysInUtcMonth(year, month)
    ? nthWeekdayOfMonth(year, month, weekday, -1)
    : utcDate(year, month, day);
}

/** Months per step for the month-based frequencies. WEEKLY steps in days instead. */
function monthStep(p: RecurrencePattern): number {
  const interval = Math.max(1, p.interval);
  switch (p.frequency) {
    case "MONTHLY":
      return interval;
    case "QUARTERLY":
      return 3 * interval;
    case "ANNUAL":
      return 12 * interval;
    default:
      return interval;
  }
}

/** The day within a given month that the pattern lands on. */
function dayInMonth(p: RecurrencePattern, year: number, month: number): Date {
  if (p.mode === "NTH_WEEKDAY") {
    const weekday = p.weekday ?? p.startDate.getUTCDay();
    const nth = p.weekOfMonth ?? 1;
    return nthWeekdayOfMonth(year, month, weekday, nth);
  }
  const wanted = p.dayOfMonth ?? p.startDate.getUTCDate();
  return utcDate(year, month, Math.min(wanted, daysInUtcMonth(year, month)));
}

/**
 * Every occurrence of `pattern` that falls in [from, to] (inclusive), in order.
 * Occurrences before startDate or after endDate are never produced.
 */
export function occurrencesBetween(
  pattern: RecurrencePattern,
  from: Date,
  to: Date,
): Date[] {
  const start = startOfUtcDay(pattern.startDate);
  const end = pattern.endDate ? startOfUtcDay(pattern.endDate) : null;
  const windowStart = startOfUtcDay(from);
  const windowEnd = startOfUtcDay(to);
  const hardEnd = end && end < windowEnd ? end : windowEnd;
  if (hardEnd < start || hardEnd < windowStart) return [];

  const out: Date[] = [];

  if (pattern.frequency === "WEEKLY") {
    const stepDays = 7 * Math.max(1, pattern.interval);
    // Anchor on the chosen weekday at or after startDate; without one, on
    // startDate's own weekday.
    let cursor = start;
    if (pattern.weekday !== null && pattern.weekday !== undefined) {
      cursor = addUtcDays(start, (pattern.weekday - start.getUTCDay() + 7) % 7);
    }
    for (let i = 0; i < MAX_STEPS && cursor <= hardEnd; i++) {
      if (cursor >= windowStart) out.push(cursor);
      cursor = addUtcDays(cursor, stepDays);
    }
    return out;
  }

  const step = monthStep(pattern);
  for (let i = 0; i < MAX_STEPS; i++) {
    const month = start.getUTCMonth() + i * step;
    const cursor = dayInMonth(pattern, start.getUTCFullYear(), month);
    // The first stepped month can land before startDate (e.g. "the 5th" when the
    // series starts on the 20th) — skip it rather than dropping the pattern.
    if (cursor > hardEnd) break;
    if (cursor >= start && cursor >= windowStart) out.push(cursor);
  }
  return out;
}

/** The first occurrence on or after `from`, or null if the pattern has run out. */
export function nextOccurrence(
  pattern: RecurrencePattern,
  from: Date,
  lookaheadDays = 800,
): Date | null {
  const list = occurrencesBetween(pattern, from, addUtcDays(from, lookaheadDays));
  return list[0] ?? null;
}

/** Plain-English summary of a pattern, e.g. "Every quarter on the third Friday". */
export function describeRecurrence(pattern: RecurrencePattern): string {
  const n = Math.max(1, pattern.interval);
  const unit =
    pattern.frequency === "WEEKLY"
      ? n === 1
        ? "week"
        : `${n} weeks`
      : pattern.frequency === "MONTHLY"
        ? n === 1
          ? "month"
          : `${n} months`
        : pattern.frequency === "QUARTERLY"
          ? n === 1
            ? "quarter"
            : `${n} quarters`
          : n === 1
            ? "year"
            : `${n} years`;

  if (pattern.frequency === "WEEKLY") {
    const weekday = pattern.weekday ?? pattern.startDate.getUTCDay();
    return `Every ${unit} on ${WEEKDAY_LABELS[weekday]}`;
  }
  if (pattern.mode === "NTH_WEEKDAY") {
    const weekday = pattern.weekday ?? pattern.startDate.getUTCDay();
    const nth = WEEK_OF_MONTH_LABELS[pattern.weekOfMonth ?? 1] ?? "first";
    return `Every ${unit} on the ${nth} ${WEEKDAY_LABELS[weekday]}`;
  }
  const day = pattern.dayOfMonth ?? pattern.startDate.getUTCDate();
  return `Every ${unit} on the ${ordinal(day)}`;
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
