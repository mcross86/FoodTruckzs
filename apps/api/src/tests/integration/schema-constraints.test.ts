import { randomUUID } from "node:crypto";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "../../db/schema/index.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl === undefined ? describe.skip : describe;

async function cleanupConstraintTestRows(sql: Sql) {
  await sql`delete from stripe_webhook_events where stripe_event_id like 'evt_schema_%'`;
  await sql`
    delete from rfqs
    where customer_user_id in (
      select id from users where email like 'schema-%@example.com'
    )
  `;
  await sql`
    delete from vendor_billing_settings
    where vendor_id in (
      select id from vendors where slug like 'schema-%'
    )
  `;
  await sql`delete from vendors where slug like 'schema-%'`;
  await sql`delete from users where email like 'schema-%@example.com'`;
}

async function seedUser(sql: Sql) {
  const userId = randomUUID();

  await sql`
    insert into users (id, email, password_hash, first_name, last_name, status)
    values (
      ${userId},
      ${`schema-${userId}@example.com`},
      'hashed-password',
      'Schema',
      'Tester',
      'active'
    )
  `;

  return userId;
}

async function seedVendor(sql: Sql, userId: string) {
  const vendorId = randomUUID();

  await sql`
    insert into vendors (id, business_name, slug, status, approval_status, primary_contact_user_id)
    values (
      ${vendorId},
      'Schema Test Truck',
      ${`schema-${vendorId}`},
      'active',
      'approved',
      ${userId}
    )
  `;

  return vendorId;
}

async function seedRfq(sql: Sql, userId: string) {
  const rfqId = randomUUID();

  await sql`
    insert into rfqs (
      id,
      customer_user_id,
      event_name,
      event_type,
      starts_at,
      ends_at,
      timezone,
      indoor_outdoor,
      estimated_headcount,
      status
    )
    values (
      ${rfqId},
      ${userId},
      'Schema Test Event',
      'corporate',
      '2026-07-01T12:00:00Z',
      '2026-07-01T14:00:00Z',
      'America/New_York',
      'outdoor',
      75,
      'submitted'
    )
  `;

  return rfqId;
}

describeWithDatabase("database schema constraints", () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = postgres(testDatabaseUrl!, { max: 1 });
    const db = drizzle(sql, { schema });

    await migrate(db, { migrationsFolder: "src/db/migrations" });
    await cleanupConstraintTestRows(sql);
  });

  afterEach(async () => {
    await cleanupConstraintTestRows(sql);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("rejects duplicate Stripe webhook event IDs", async () => {
    const stripeEventId = `evt_schema_${randomUUID().replaceAll("-", "")}`;

    await sql`
      insert into stripe_webhook_events (stripe_event_id, event_type, payload)
      values (${stripeEventId}, 'checkout.session.completed', '{}'::jsonb)
    `;

    await expect(
      sql`
        insert into stripe_webhook_events (stripe_event_id, event_type, payload)
        values (${stripeEventId}, 'checkout.session.completed', '{}'::jsonb)
      `,
    ).rejects.toThrow();
  });

  it("rejects RFQs with invalid time ranges", async () => {
    const userId = await seedUser(sql);

    await expect(
      sql`
        insert into rfqs (
          customer_user_id,
          event_name,
          event_type,
          starts_at,
          ends_at,
          timezone,
          indoor_outdoor,
          estimated_headcount,
          status
        )
        values (
          ${userId},
          'Invalid Schema Test Event',
          'corporate',
          '2026-07-01T14:00:00Z',
          '2026-07-01T12:00:00Z',
          'America/New_York',
          'outdoor',
          75,
          'submitted'
        )
      `,
    ).rejects.toThrow();
  });

  it("rejects duplicate quotes for the same RFQ and vendor", async () => {
    const userId = await seedUser(sql);
    const vendorId = await seedVendor(sql, userId);
    const rfqId = await seedRfq(sql, userId);

    await sql`
      insert into quotes (rfq_id, vendor_id, status)
      values (${rfqId}, ${vendorId}, 'draft')
    `;

    await expect(
      sql`
        insert into quotes (rfq_id, vendor_id, status)
        values (${rfqId}, ${vendorId}, 'draft')
      `,
    ).rejects.toThrow();
  });

  it("rejects negative platform fee basis points", async () => {
    const userId = await seedUser(sql);
    const vendorId = await seedVendor(sql, userId);

    await expect(
      sql`
        insert into vendor_billing_settings (vendor_id, agreement_fee_basis_points)
        values (${vendorId}, -1)
      `,
    ).rejects.toThrow();
  });
});
