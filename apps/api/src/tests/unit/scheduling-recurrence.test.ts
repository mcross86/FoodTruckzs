import { describe, expect, it } from "vitest";

import { expandRecurringManualEvents } from "../../modules/scheduling/scheduling.recurrence.js";

describe("expandRecurringManualEvents", () => {
  it("creates weekly occurrences on the same weekday", () => {
    const startsAt = new Date("2026-06-02T15:00:00.000Z");
    const endsAt = new Date("2026-06-02T19:00:00.000Z");

    const occurrences = expandRecurringManualEvents(startsAt, endsAt, {
      frequency: "weekly",
      occurrenceCount: 4,
    });

    expect(occurrences).toHaveLength(4);
    expect(occurrences[0]?.startsAt.toISOString()).toBe("2026-06-02T15:00:00.000Z");
    expect(occurrences[1]?.startsAt.toISOString()).toBe("2026-06-09T15:00:00.000Z");
    expect(occurrences[3]?.startsAt.toISOString()).toBe("2026-06-23T15:00:00.000Z");
  });

  it("creates biweekly occurrences", () => {
    const startsAt = new Date("2026-06-02T15:00:00.000Z");
    const endsAt = new Date("2026-06-02T19:00:00.000Z");

    const occurrences = expandRecurringManualEvents(startsAt, endsAt, {
      frequency: "biweekly",
      occurrenceCount: 3,
    });

    expect(occurrences).toHaveLength(3);
    expect(occurrences[1]?.startsAt.toISOString()).toBe("2026-06-16T15:00:00.000Z");
  });

  it("supports multiple weekdays per week", () => {
    const startsAt = new Date("2026-06-03T15:00:00.000Z");
    const endsAt = new Date("2026-06-03T19:00:00.000Z");

    const occurrences = expandRecurringManualEvents(startsAt, endsAt, {
      daysOfWeek: [2, 4],
      frequency: "weekly",
      occurrenceCount: 4,
    });

    expect(occurrences).toHaveLength(4);
    expect(occurrences.map((slot) => slot.startsAt.getUTCDay()).sort()).toEqual([2, 2, 4, 4]);
    expect(occurrences[0]?.startsAt.toISOString()).toBe("2026-06-04T15:00:00.000Z");
  });
});
