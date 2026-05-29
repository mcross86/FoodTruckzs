export type RecurrenceFrequency = "weekly" | "biweekly";

export type RecurrenceInput = {
  daysOfWeek?: number[];
  frequency: RecurrenceFrequency;
  occurrenceCount?: number;
  until?: string;
};

export type RecurrenceOccurrence = {
  endsAt: Date;
  startsAt: Date;
};

const MAX_OCCURRENCES = 52;

function normalizeDaysOfWeek(days: number[] | undefined, anchor: Date): number[] {
  const unique = [...new Set((days ?? [anchor.getDay()]).filter((day) => day >= 0 && day <= 6))].sort(
    (left, right) => left - right,
  );

  if (unique.length === 0) {
    return [anchor.getDay()];
  }

  return unique;
}

function startOfWeekSunday(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function withTimeFrom(source: Date, day: Date): Date {
  const next = new Date(day);
  next.setHours(
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  );
  return next;
}

function parseUntilDate(until: string): Date {
  return new Date(`${until}T23:59:59.999`);
}

export function expandRecurringManualEvents(
  startsAt: Date,
  endsAt: Date,
  recurrence: RecurrenceInput,
): RecurrenceOccurrence[] {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("Event end must be after start.");
  }

  const durationMs = endsAt.getTime() - startsAt.getTime();
  const daysOfWeek = normalizeDaysOfWeek(recurrence.daysOfWeek, startsAt);
  const stepWeeks = recurrence.frequency === "weekly" ? 1 : 2;
  const untilDate = recurrence.until ? parseUntilDate(recurrence.until) : null;
  const maxCount = untilDate
    ? MAX_OCCURRENCES
    : Math.min(MAX_OCCURRENCES, Math.max(2, recurrence.occurrenceCount ?? 12));

  const weekStart = startOfWeekSunday(startsAt);
  const slots: Date[] = [];

  for (let weekIndex = 0; weekIndex < 104 && slots.length < maxCount; weekIndex += 1) {
    for (const dayOfWeek of daysOfWeek) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + weekIndex * stepWeeks * 7 + dayOfWeek);
      const candidateStart = withTimeFrom(startsAt, day);

      if (candidateStart.getTime() < startsAt.getTime()) {
        continue;
      }

      if (untilDate && candidateStart.getTime() > untilDate.getTime()) {
        return slots.map((start) => ({
          endsAt: new Date(start.getTime() + durationMs),
          startsAt: start,
        }));
      }

      slots.push(candidateStart);

      if (slots.length >= maxCount) {
        break;
      }
    }
  }

  return slots.map((start) => ({
    endsAt: new Date(start.getTime() + durationMs),
    startsAt: start,
  }));
}
