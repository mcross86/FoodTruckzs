ALTER TYPE "public"."quote_line_item_type" ADD VALUE 'gratuity' BEFORE 'discount';--> statement-breakpoint
ALTER TYPE "public"."quote_line_item_type" ADD VALUE 'service_charge' BEFORE 'discount';--> statement-breakpoint
ALTER TYPE "public"."quote_line_item_type" ADD VALUE 'overtime' BEFORE 'discount';--> statement-breakpoint
ALTER TABLE "quote_line_items" DROP CONSTRAINT "quote_line_items_unit_amount_non_negative";--> statement-breakpoint
ALTER TABLE "quote_line_items" DROP CONSTRAINT "quote_line_items_total_amount_non_negative";--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "unit" text DEFAULT 'each' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "taxable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "is_internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD COLUMN "service_style" text;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD COLUMN "menu_summary" text;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD COLUMN "assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD COLUMN "exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD COLUMN "cancellation_policy_summary" text;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_unit_amount_discount_guard" CHECK ("quote_line_items"."type" = 'discount' OR "quote_line_items"."unit_amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_total_amount_discount_guard" CHECK ("quote_line_items"."type" = 'discount' OR "quote_line_items"."total_amount_cents" >= 0);