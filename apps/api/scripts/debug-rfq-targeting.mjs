import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

function loadRootEnv() {
  let current = dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }

    const parent = dirname(current);
    if (parent === current) {
      return;
    }

    current = parent;
  }
}

loadRootEnv();

const sql = postgres(process.env.DATABASE_URL);

const rfqs = await sql`
  SELECT r.id, r.rfq_number, r.status, r.event_name, r.estimated_headcount, r.budget_max_cents,
         a.city, a.state, a.postal_code
  FROM rfqs r
  LEFT JOIN addresses a ON a.id = r.venue_address_id
  WHERE r.deleted_at IS NULL
  ORDER BY r.created_at DESC
  LIMIT 5`;

console.log("RECENT RFQS:", JSON.stringify(rfqs, null, 2));

for (const rfq of rfqs) {
  const targets = await sql`
    SELECT t.vendor_id, t.status, v.business_name, v.approval_status, v.status AS vendor_status
    FROM rfq_vendor_targets t
    JOIN vendors v ON v.id = t.vendor_id
    WHERE t.rfq_id = ${rfq.id}`;
  console.log(`TARGETS for RFQ ${rfq.rfq_number}:`, JSON.stringify(targets, null, 2));

  const reqs = await sql`
    SELECT label, details
    FROM rfq_requirements
    WHERE rfq_id = ${rfq.id}
    AND label IN ('food_requirements', 'service_style')`;
  console.log(`REQUIREMENTS for RFQ ${rfq.rfq_number}:`, JSON.stringify(reqs, null, 2));
}

const vendors = await sql`
  SELECT v.id, v.business_name, v.approval_status, v.status, v.is_published, v.catering_minimum_cents,
         sa.state, sa.city, sa.metro_area, sa.postal_code
  FROM vendors v
  LEFT JOIN vendor_service_areas sa ON sa.vendor_id = v.id
  WHERE v.deleted_at IS NULL
  ORDER BY v.created_at DESC
  LIMIT 15`;

console.log("VENDORS:", JSON.stringify(vendors, null, 2));

const memberships = await sql`
  SELECT vm.user_id, u.email, vm.vendor_id, vm.status AS membership_status,
         v.business_name, v.approval_status
  FROM vendor_memberships vm
  JOIN users u ON u.id = vm.user_id
  JOIN vendors v ON v.id = vm.vendor_id
  WHERE vm.status = 'active'
  ORDER BY u.email, v.created_at`;

console.log("VENDOR MEMBERSHIPS:", JSON.stringify(memberships, null, 2));

await sql.end();
