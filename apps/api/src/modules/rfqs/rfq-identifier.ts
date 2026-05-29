import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { rfqs } from "../../db/schema/index.js";

/** Upper bound for assigned RFQ numbers (8 decimal digits). */
export const RFQ_NUMBER_MAX = 99_999_999;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RFQ_NUMBER_PATTERN = /^[1-9]\d{0,7}$/;

export function isUuidRfqIdentifier(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isRfqNumberIdentifier(value: string): boolean {
  if (!RFQ_NUMBER_PATTERN.test(value)) {
    return false;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= RFQ_NUMBER_MAX;
}

export function parseRfqNumberIdentifier(value: string): number | null {
  if (!isRfqNumberIdentifier(value)) {
    return null;
  }

  return Number.parseInt(value, 10);
}

export type RfqIdentifier =
  | { kind: "uuid"; value: string }
  | { kind: "number"; value: number };

export function parseRfqIdentifier(identifier: string): RfqIdentifier | null {
  if (isUuidRfqIdentifier(identifier)) {
    return { kind: "uuid", value: identifier };
  }

  const rfqNumber = parseRfqNumberIdentifier(identifier);
  if (rfqNumber !== null) {
    return { kind: "number", value: rfqNumber };
  }

  return null;
}

export function rfqIdentifierWhere(identifier: RfqIdentifier) {
  if (identifier.kind === "uuid") {
    return eq(rfqs.id, identifier.value);
  }

  return eq(rfqs.rfqNumber, identifier.value);
}

export async function findRfqRowByIdentifier(
  db: Database,
  identifier: string,
): Promise<typeof rfqs.$inferSelect | null> {
  const parsed = parseRfqIdentifier(identifier);
  if (parsed === null) {
    return null;
  }

  const [rfq] = await db
    .select()
    .from(rfqs)
    .where(and(rfqIdentifierWhere(parsed), isNull(rfqs.deletedAt)))
    .limit(1);

  return rfq ?? null;
}
