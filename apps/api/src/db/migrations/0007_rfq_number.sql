CREATE SEQUENCE "rfqs_rfq_number_seq";

ALTER TABLE "rfqs" ADD COLUMN "rfq_number" integer;

WITH "numbered_rfqs" AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "created_at", "id") AS "next_number"
  FROM "rfqs"
)
UPDATE "rfqs"
SET "rfq_number" = "numbered_rfqs"."next_number"
FROM "numbered_rfqs"
WHERE "rfqs"."id" = "numbered_rfqs"."id";

SELECT setval(
  'rfqs_rfq_number_seq',
  COALESCE((SELECT MAX("rfq_number") FROM "rfqs"), 0)
);

ALTER TABLE "rfqs"
  ALTER COLUMN "rfq_number" SET DEFAULT nextval('rfqs_rfq_number_seq');

ALTER SEQUENCE "rfqs_rfq_number_seq" OWNED BY "rfqs"."rfq_number";

ALTER TABLE "rfqs" ALTER COLUMN "rfq_number" SET NOT NULL;

CREATE UNIQUE INDEX "rfqs_rfq_number_unique" ON "rfqs" USING btree ("rfq_number");

ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_rfq_number_range" CHECK (
  "rfq_number" >= 1 AND "rfq_number" <= 99999999
);
