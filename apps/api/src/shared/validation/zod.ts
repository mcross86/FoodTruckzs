import type { z, ZodError } from "zod";

import { ValidationError } from "../errors/app-error.js";

type ZodIssueDetail = {
  message: string;
  path: string;
};

export function formatZodIssues(error: ZodError): ZodIssueDetail[] {
  return error.issues.map((issue) => ({
    message: issue.message,
    path: issue.path.join("."),
  }));
}

export function parseWithZod<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Request validation failed.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  return parsed.data;
}

export function zodErrorToValidationError(error: ZodError): ValidationError {
  return new ValidationError("Request validation failed.", {
    issues: formatZodIssues(error),
  });
}
