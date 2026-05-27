import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ValidationError } from "../../shared/errors/app-error.js";
import { parseWithZod } from "../../shared/validation/zod.js";

describe("parseWithZod", () => {
  const schema = z.object({
    email: z.string().trim().email(),
  });

  it("returns parsed DTOs", () => {
    expect(parseWithZod(schema, { email: " user@example.com " })).toEqual({
      email: "user@example.com",
    });
  });

  it("throws a typed validation error with issue details", () => {
    expect(() => parseWithZod(schema, { email: "invalid" })).toThrow(ValidationError);
  });
});
