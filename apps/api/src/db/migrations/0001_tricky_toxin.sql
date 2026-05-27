CREATE TYPE "public"."vendor_menu_item_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."vendor_menu_package_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."vendor_menu_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "vendor_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"price_cents" integer,
	"dietary_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "vendor_menu_item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vendor_menu_items_price_non_negative" CHECK ("vendor_menu_items"."price_cents" IS NULL OR "vendor_menu_items"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_menu_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer,
	"pricing_model" text DEFAULT 'fixed' NOT NULL,
	"minimum_guest_count" integer,
	"maximum_guest_count" integer,
	"included_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dietary_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "vendor_menu_package_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vendor_menu_packages_price_non_negative" CHECK ("vendor_menu_packages"."price_cents" IS NULL OR "vendor_menu_packages"."price_cents" >= 0),
	CONSTRAINT "vendor_menu_packages_min_guest_positive" CHECK ("vendor_menu_packages"."minimum_guest_count" IS NULL OR "vendor_menu_packages"."minimum_guest_count" > 0),
	CONSTRAINT "vendor_menu_packages_max_guest_positive" CHECK ("vendor_menu_packages"."maximum_guest_count" IS NULL OR "vendor_menu_packages"."maximum_guest_count" > 0),
	CONSTRAINT "vendor_menu_packages_guest_range" CHECK ("vendor_menu_packages"."minimum_guest_count" IS NULL OR "vendor_menu_packages"."maximum_guest_count" IS NULL OR "vendor_menu_packages"."minimum_guest_count" <= "vendor_menu_packages"."maximum_guest_count")
);
--> statement-breakpoint
CREATE TABLE "vendor_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "vendor_menu_status" DEFAULT 'draft' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"minimum_guest_count" integer,
	"maximum_guest_count" integer,
	"prep_lead_time_hours" integer,
	"seasonal_start_date" date,
	"seasonal_end_date" date,
	"service_styles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dietary_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vendor_menus_min_guest_positive" CHECK ("vendor_menus"."minimum_guest_count" IS NULL OR "vendor_menus"."minimum_guest_count" > 0),
	CONSTRAINT "vendor_menus_max_guest_positive" CHECK ("vendor_menus"."maximum_guest_count" IS NULL OR "vendor_menus"."maximum_guest_count" > 0),
	CONSTRAINT "vendor_menus_guest_range" CHECK ("vendor_menus"."minimum_guest_count" IS NULL OR "vendor_menus"."maximum_guest_count" IS NULL OR "vendor_menus"."minimum_guest_count" <= "vendor_menus"."maximum_guest_count"),
	CONSTRAINT "vendor_menus_prep_lead_time_non_negative" CHECK ("vendor_menus"."prep_lead_time_hours" IS NULL OR "vendor_menus"."prep_lead_time_hours" >= 0),
	CONSTRAINT "vendor_menus_seasonal_date_range" CHECK ("vendor_menus"."seasonal_start_date" IS NULL OR "vendor_menus"."seasonal_end_date" IS NULL OR "vendor_menus"."seasonal_start_date" <= "vendor_menus"."seasonal_end_date")
);
--> statement-breakpoint
CREATE TABLE "vendor_operating_settings" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"minimum_lead_time_days" integer DEFAULT 7 NOT NULL,
	"travel_radius_miles" integer,
	"minimum_guest_count" integer,
	"max_daily_bookings" integer,
	"default_setup_minutes" integer DEFAULT 60 NOT NULL,
	"default_travel_buffer_minutes" integer DEFAULT 30 NOT NULL,
	"quote_response_target_hours" integer,
	"request_anyway_on_blackout" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_operating_settings_lead_time_minimum" CHECK ("vendor_operating_settings"."minimum_lead_time_days" >= 7),
	CONSTRAINT "vendor_operating_settings_travel_radius_positive" CHECK ("vendor_operating_settings"."travel_radius_miles" IS NULL OR "vendor_operating_settings"."travel_radius_miles" > 0),
	CONSTRAINT "vendor_operating_settings_minimum_guest_positive" CHECK ("vendor_operating_settings"."minimum_guest_count" IS NULL OR "vendor_operating_settings"."minimum_guest_count" > 0),
	CONSTRAINT "vendor_operating_settings_max_daily_positive" CHECK ("vendor_operating_settings"."max_daily_bookings" IS NULL OR "vendor_operating_settings"."max_daily_bookings" > 0),
	CONSTRAINT "vendor_operating_settings_setup_non_negative" CHECK ("vendor_operating_settings"."default_setup_minutes" >= 0),
	CONSTRAINT "vendor_operating_settings_travel_buffer_non_negative" CHECK ("vendor_operating_settings"."default_travel_buffer_minutes" >= 0),
	CONSTRAINT "vendor_operating_settings_response_target_positive" CHECK ("vendor_operating_settings"."quote_response_target_hours" IS NULL OR "vendor_operating_settings"."quote_response_target_hours" > 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "owner_contact_name" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "business_phone" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "business_email" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "average_response_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "business_license_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "insurance_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_menu_items" ADD CONSTRAINT "vendor_menu_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_menu_items" ADD CONSTRAINT "vendor_menu_items_menu_id_vendor_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."vendor_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_menu_packages" ADD CONSTRAINT "vendor_menu_packages_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_menu_packages" ADD CONSTRAINT "vendor_menu_packages_menu_id_vendor_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."vendor_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_menus" ADD CONSTRAINT "vendor_menus_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_operating_settings" ADD CONSTRAINT "vendor_operating_settings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_menu_items_menu_sort_idx" ON "vendor_menu_items" USING btree ("menu_id","sort_order");--> statement-breakpoint
CREATE INDEX "vendor_menu_items_vendor_idx" ON "vendor_menu_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_menu_packages_menu_sort_idx" ON "vendor_menu_packages" USING btree ("menu_id","sort_order");--> statement-breakpoint
CREATE INDEX "vendor_menu_packages_vendor_idx" ON "vendor_menu_packages" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_menus_vendor_status_idx" ON "vendor_menus" USING btree ("vendor_id","status","created_at");