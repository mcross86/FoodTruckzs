import assert from "node:assert/strict";
import test from "node:test";

import {
  CATERING_CUISINE_OPTIONS,
  filterCateringCuisines,
  formatCuisinesText,
  parseCuisinesText,
} from "./catering-cuisines";

test("catering cuisine catalog has 50 options", () => {
  assert.equal(CATERING_CUISINE_OPTIONS.length, 50);
});

test("parse and format cuisines text round-trip", () => {
  const parsed = parseCuisinesText("Tacos / Mexican, BBQ / Barbecue");
  assert.deepEqual(parsed, ["Tacos / Mexican", "BBQ / Barbecue"]);
  assert.equal(formatCuisinesText(parsed), "Tacos / Mexican, BBQ / Barbecue");
});

test("filterCateringCuisines matches case-insensitively", () => {
  const matches = filterCateringCuisines("bbq");
  assert.ok(matches.some((option) => option.includes("BBQ")));
});
