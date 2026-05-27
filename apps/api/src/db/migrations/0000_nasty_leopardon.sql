CREATE TYPE "public"."agreement_signature_role" AS ENUM('customer', 'vendor', 'platform_admin');--> statement-breakpoint
CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'pending_signature', 'signed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."availability_exception_type" AS ENUM('blackout', 'special_hours', 'capacity_limit');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_status" AS ENUM('tentative', 'confirmed', 'blocking', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('confirmed_catering', 'manual_booking', 'food_truck_location', 'festival', 'blocked_time');--> statement-breakpoint
CREATE TYPE "public"."catering_event_status" AS ENUM('pending_deposit', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('visible', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."message_thread_status" AS ENUM('open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'processed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('checkout_pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_schedule_item_status" AS ENUM('pending', 'due', 'paid', 'waived', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_schedule_item_type" AS ENUM('deposit', 'milestone', 'final_balance', 'invoice', 'onsite');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('requires_payment', 'checkout_created', 'processing', 'succeeded', 'failed', 'cancelled', 'refund_pending', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('deposit', 'milestone', 'final_balance', 'invoice', 'onsite');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'in_transit', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."platform_fee_status" AS ENUM('pending_invoice', 'invoiced', 'paid', 'void', 'adjusted');--> statement-breakpoint
CREATE TYPE "public"."quote_line_item_type" AS ENUM('food', 'service', 'staffing', 'travel', 'rental', 'fee', 'tax', 'discount');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired', 'cancelled', 'not_selected');--> statement-breakpoint
CREATE TYPE "public"."refresh_token_status" AS ENUM('active', 'rotated', 'revoked', 'reused', 'expired');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'pending', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rfq_requirement_type" AS ENUM('food', 'equipment', 'dietary', 'service', 'other');--> statement-breakpoint
CREATE TYPE "public"."rfq_status" AS ENUM('draft', 'submitted', 'vendor_reviewing', 'clarification_requested', 'quote_in_progress', 'quote_sent', 'negotiation', 'accepted', 'agreement_pending', 'agreement_signed', 'deposit_paid', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rfq_vendor_target_status" AS ENUM('invited', 'viewed', 'accepted', 'rejected', 'quote_sent', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."stripe_webhook_status" AS ENUM('received', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending_verification', 'active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."vendor_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vendor_invoice_line_item_type" AS ENUM('agreement_fee', 'adjustment', 'credit');--> statement-breakpoint
CREATE TYPE "public"."vendor_invoice_status" AS ENUM('draft', 'issued', 'paid', 'overdue', 'void');--> statement-breakpoint
CREATE TYPE "public"."vendor_membership_role" AS ENUM('owner', 'manager', 'staff', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."vendor_membership_status" AS ENUM('active', 'invited', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text,
	"country" text DEFAULT 'US' NOT NULL,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"signer_user_id" uuid NOT NULL,
	"signer_role" "agreement_signature_role" NOT NULL,
	"typed_name" text NOT NULL,
	"signature_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signed_document_file_id" uuid,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"terms_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"document_file_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_versions_version_positive" CHECK ("agreement_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_revision_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"status" "agreement_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" uuid,
	"document_file_id" uuid,
	"signed_document_file_id" uuid,
	"generated_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"vendor_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"request_id" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"type" "availability_exception_type" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"reason" text,
	"capacity_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_exceptions_valid_time" CHECK ("availability_exceptions"."starts_at" < "availability_exceptions"."ends_at"),
	CONSTRAINT "availability_exceptions_capacity_non_negative" CHECK ("availability_exceptions"."capacity_limit" IS NULL OR "availability_exceptions"."capacity_limit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"starts_at_local" time NOT NULL,
	"ends_at_local" time NOT NULL,
	"timezone" text NOT NULL,
	"effective_start_date" date,
	"effective_end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_rules_day_of_week_range" CHECK ("availability_rules"."day_of_week" BETWEEN 0 AND 6),
	CONSTRAINT "availability_rules_valid_time" CHECK ("availability_rules"."starts_at_local" < "availability_rules"."ends_at_local")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"catering_event_id" uuid,
	"type" "calendar_event_type" NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" text,
	"venue_address_id" uuid,
	"status" "calendar_event_status" DEFAULT 'tentative' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "calendar_events_valid_time" CHECK ("calendar_events"."starts_at" < "calendar_events"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "catering_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"rfq_id" uuid,
	"agreement_id" uuid,
	"customer_user_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"venue_address_id" uuid,
	"status" "catering_event_status" DEFAULT 'pending_deposit' NOT NULL,
	"source" text DEFAULT 'agreement' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "catering_events_valid_time" CHECK ("catering_events"."starts_at" < "catering_events"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "cuisines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_provider" text NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"visibility" "file_visibility" DEFAULT 'private' NOT NULL,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"owner_user_id" uuid,
	"vendor_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_size_positive" CHECK ("files"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"status" "message_thread_status" DEFAULT 'open' NOT NULL,
	"last_message_id" uuid,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text,
	"attachment_file_id" uuid,
	"status" "message_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "messages_body_or_attachment_required" CHECK ("messages"."body" IS NOT NULL OR "messages"."attachment_file_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_attempts_non_negative" CHECK ("notification_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_attempts_non_negative" CHECK ("outbox_events"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'checkout_pending' NOT NULL,
	"idempotency_key" text,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "payment_attempts_amount_positive" CHECK ("payment_attempts"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_revision_id" uuid NOT NULL,
	"agreement_id" uuid,
	"type" "payment_schedule_item_type" NOT NULL,
	"status" "payment_schedule_item_status" DEFAULT 'pending' NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_schedule_items_amount_non_negative" CHECK ("payment_schedule_items"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_schedule_item_id" uuid,
	"agreement_id" uuid NOT NULL,
	"rfq_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"type" "payment_type" NOT NULL,
	"status" "payment_status" DEFAULT 'requires_payment' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"processing_fee_cents" integer DEFAULT 0 NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_cents" > 0),
	CONSTRAINT "payments_processing_fee_non_negative" CHECK ("payments"."processing_fee_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"payment_id" uuid,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"stripe_payout_id" text,
	"arrival_date" date,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_amount_positive" CHECK ("payouts"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "platform_agreement_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"signed_agreement_total_cents" integer NOT NULL,
	"fee_percentage_basis_points" integer NOT NULL,
	"fee_amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" "platform_fee_status" DEFAULT 'pending_invoice' NOT NULL,
	"vendor_invoice_id" uuid,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_agreement_fees_signed_total_non_negative" CHECK ("platform_agreement_fees"."signed_agreement_total_cents" >= 0),
	CONSTRAINT "platform_agreement_fees_percentage_non_negative" CHECK ("platform_agreement_fees"."fee_percentage_basis_points" >= 0),
	CONSTRAINT "platform_agreement_fees_amount_non_negative" CHECK ("platform_agreement_fees"."fee_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_revision_id" uuid NOT NULL,
	"type" "quote_line_item_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer DEFAULT 0 NOT NULL,
	"total_amount_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_line_items_quantity_positive" CHECK ("quote_line_items"."quantity" > 0),
	CONSTRAINT "quote_line_items_unit_amount_non_negative" CHECK ("quote_line_items"."unit_amount_cents" >= 0),
	CONSTRAINT "quote_line_items_total_amount_non_negative" CHECK ("quote_line_items"."total_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"notes" text,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"fees_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"deposit_required_cents" integer DEFAULT 0 NOT NULL,
	"payment_schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_revisions_revision_positive" CHECK ("quote_revisions"."revision_number" > 0),
	CONSTRAINT "quote_revisions_subtotal_non_negative" CHECK ("quote_revisions"."subtotal_cents" >= 0),
	CONSTRAINT "quote_revisions_fees_non_negative" CHECK ("quote_revisions"."fees_cents" >= 0),
	CONSTRAINT "quote_revisions_tax_non_negative" CHECK ("quote_revisions"."tax_cents" >= 0),
	CONSTRAINT "quote_revisions_total_non_negative" CHECK ("quote_revisions"."total_cents" >= 0),
	CONSTRAINT "quote_revisions_deposit_non_negative" CHECK ("quote_revisions"."deposit_required_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"current_revision_id" uuid,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"fees_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"deposit_required_cents" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "quotes_subtotal_non_negative" CHECK ("quotes"."subtotal_cents" >= 0),
	CONSTRAINT "quotes_fees_non_negative" CHECK ("quotes"."fees_cents" >= 0),
	CONSTRAINT "quotes_tax_non_negative" CHECK ("quotes"."tax_cents" >= 0),
	CONSTRAINT "quotes_total_non_negative" CHECK ("quotes"."total_cents" >= 0),
	CONSTRAINT "quotes_deposit_non_negative" CHECK ("quotes"."deposit_required_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token_family_id" uuid NOT NULL,
	"status" "refresh_token_status" DEFAULT 'active' NOT NULL,
	"replaced_by_token_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"reason" text,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"stripe_refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "rfq_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"type" "rfq_requirement_type" NOT NULL,
	"label" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"from_status" "rfq_status",
	"to_status" "rfq_status" NOT NULL,
	"actor_user_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_vendor_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "rfq_vendor_target_status" DEFAULT 'invited' NOT NULL,
	"responded_at" timestamp with time zone,
	"rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"event_type" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"venue_address_id" uuid,
	"indoor_outdoor" text NOT NULL,
	"estimated_headcount" integer NOT NULL,
	"budget_min_cents" integer,
	"budget_max_cents" integer,
	"quote_response_deadline" timestamp with time zone,
	"status" "rfq_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "rfqs_valid_time" CHECK ("rfqs"."starts_at" < "rfqs"."ends_at"),
	CONSTRAINT "rfqs_positive_headcount" CHECK ("rfqs"."estimated_headcount" > 0),
	CONSTRAINT "rfqs_non_negative_budget_min" CHECK ("rfqs"."budget_min_cents" IS NULL OR "rfqs"."budget_min_cents" >= 0),
	CONSTRAINT "rfqs_non_negative_budget_max" CHECK ("rfqs"."budget_max_cents" IS NULL OR "rfqs"."budget_max_cents" >= 0),
	CONSTRAINT "rfqs_budget_range" CHECK ("rfqs"."budget_min_cents" IS NULL OR "rfqs"."budget_max_cents" IS NULL OR "rfqs"."budget_min_cents" <= "rfqs"."budget_max_cents")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"last_seen_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "stripe_webhook_status" DEFAULT 'received' NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_read_states" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_message_id" uuid,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thread_read_states_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"status" "user_status" DEFAULT 'pending_verification' NOT NULL,
	"global_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_billing_settings" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"agreement_fee_basis_points" integer DEFAULT 0 NOT NULL,
	"billing_email" text,
	"invoice_terms_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_billing_settings_fee_non_negative" CHECK ("vendor_billing_settings"."agreement_fee_basis_points" >= 0),
	CONSTRAINT "vendor_billing_settings_invoice_terms_positive" CHECK ("vendor_billing_settings"."invoice_terms_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_cuisines" (
	"vendor_id" uuid NOT NULL,
	"cuisine_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_cuisines_vendor_id_cuisine_id_pk" PRIMARY KEY("vendor_id","cuisine_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_invoice_id" uuid NOT NULL,
	"platform_agreement_fee_id" uuid,
	"type" "vendor_invoice_line_item_type" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_invoice_line_items_amount_not_zero" CHECK ("vendor_invoice_line_items"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"status" "vendor_invoice_status" DEFAULT 'draft' NOT NULL,
	"billing_period_start" date,
	"billing_period_end" date,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_invoices_subtotal_non_negative" CHECK ("vendor_invoices"."subtotal_cents" >= 0),
	CONSTRAINT "vendor_invoices_total_non_negative" CHECK ("vendor_invoices"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "vendor_membership_role" NOT NULL,
	"status" "vendor_membership_status" DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_profiles" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"headline" text,
	"public_description" text,
	"service_styles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dietary_accommodations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"operational_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cover_image_file_id" uuid,
	"gallery_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vendor_service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"metro_area" text NOT NULL,
	"city" text,
	"state" text NOT NULL,
	"postal_code" text,
	"radius_miles" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_service_areas_radius_positive" CHECK ("vendor_service_areas"."radius_miles" IS NULL OR "vendor_service_areas"."radius_miles" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "vendor_status" DEFAULT 'active' NOT NULL,
	"approval_status" "vendor_approval_status" DEFAULT 'pending' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"primary_contact_user_id" uuid,
	"stripe_connect_account_id" text,
	"catering_minimum_cents" integer,
	"pricing_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vendors_catering_minimum_non_negative" CHECK ("vendors"."catering_minimum_cents" IS NULL OR "vendors"."catering_minimum_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_signer_user_id_users_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_signed_document_file_id_files_id_fk" FOREIGN KEY ("signed_document_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_document_file_id_files_id_fk" FOREIGN KEY ("document_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_quote_revision_id_quote_revisions_id_fk" FOREIGN KEY ("quote_revision_id") REFERENCES "public"."quote_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_current_version_id_agreement_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_document_file_id_files_id_fk" FOREIGN KEY ("document_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_signed_document_file_id_files_id_fk" FOREIGN KEY ("signed_document_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_catering_event_id_catering_events_id_fk" FOREIGN KEY ("catering_event_id") REFERENCES "public"."catering_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_venue_address_id_addresses_id_fk" FOREIGN KEY ("venue_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_venue_address_id_addresses_id_fk" FOREIGN KEY ("venue_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_last_message_id_messages_id_fk" FOREIGN KEY ("last_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_file_id_files_id_fk" FOREIGN KEY ("attachment_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_quote_revision_id_quote_revisions_id_fk" FOREIGN KEY ("quote_revision_id") REFERENCES "public"."quote_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_schedule_item_id_payment_schedule_items_id_fk" FOREIGN KEY ("payment_schedule_item_id") REFERENCES "public"."payment_schedule_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_agreement_fees" ADD CONSTRAINT "platform_agreement_fees_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_agreement_fees" ADD CONSTRAINT "platform_agreement_fees_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_agreement_fees" ADD CONSTRAINT "platform_agreement_fees_vendor_invoice_id_vendor_invoices_id_fk" FOREIGN KEY ("vendor_invoice_id") REFERENCES "public"."vendor_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_revision_id_quote_revisions_id_fk" FOREIGN KEY ("quote_revision_id") REFERENCES "public"."quote_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_current_revision_id_quote_revisions_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "public"."quote_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_refresh_tokens_id_fk" FOREIGN KEY ("replaced_by_token_id") REFERENCES "public"."refresh_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_requirements" ADD CONSTRAINT "rfq_requirements_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_status_history" ADD CONSTRAINT "rfq_status_history_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_status_history" ADD CONSTRAINT "rfq_status_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_vendor_targets" ADD CONSTRAINT "rfq_vendor_targets_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_vendor_targets" ADD CONSTRAINT "rfq_vendor_targets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_venue_address_id_addresses_id_fk" FOREIGN KEY ("venue_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_read_states" ADD CONSTRAINT "thread_read_states_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_read_states" ADD CONSTRAINT "thread_read_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_read_states" ADD CONSTRAINT "thread_read_states_last_read_message_id_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_billing_settings" ADD CONSTRAINT "vendor_billing_settings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_cuisines" ADD CONSTRAINT "vendor_cuisines_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_cuisines" ADD CONSTRAINT "vendor_cuisines_cuisine_id_cuisines_id_fk" FOREIGN KEY ("cuisine_id") REFERENCES "public"."cuisines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoice_line_items" ADD CONSTRAINT "vendor_invoice_line_items_vendor_invoice_id_vendor_invoices_id_fk" FOREIGN KEY ("vendor_invoice_id") REFERENCES "public"."vendor_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoice_line_items" ADD CONSTRAINT "vendor_invoice_line_items_platform_agreement_fee_id_platform_agreement_fees_id_fk" FOREIGN KEY ("platform_agreement_fee_id") REFERENCES "public"."platform_agreement_fees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_memberships" ADD CONSTRAINT "vendor_memberships_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_memberships" ADD CONSTRAINT "vendor_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_memberships" ADD CONSTRAINT "vendor_memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_cover_image_file_id_files_id_fk" FOREIGN KEY ("cover_image_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_service_areas" ADD CONSTRAINT "vendor_service_areas_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_primary_contact_user_id_users_id_fk" FOREIGN KEY ("primary_contact_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_signatures_unique_signer_role" ON "agreement_signatures" USING btree ("agreement_id","signer_role","signer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_versions_agreement_version_unique" ON "agreement_versions" USING btree ("agreement_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_quote_revision_unique" ON "agreements" USING btree ("quote_revision_id");--> statement-breakpoint
CREATE INDEX "agreements_vendor_status_idx" ON "agreements" USING btree ("vendor_id","status","created_at");--> statement-breakpoint
CREATE INDEX "agreements_customer_status_idx" ON "agreements" USING btree ("customer_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_created_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "availability_exceptions_vendor_range_idx" ON "availability_exceptions" USING btree ("vendor_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "availability_rules_vendor_day_idx" ON "availability_rules" USING btree ("vendor_id","day_of_week");--> statement-breakpoint
CREATE INDEX "calendar_events_vendor_range_idx" ON "calendar_events" USING btree ("vendor_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "calendar_events_vendor_status_idx" ON "calendar_events" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX "catering_events_vendor_range_idx" ON "catering_events" USING btree ("vendor_id","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cuisines_slug_unique" ON "cuisines" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_object_unique" ON "files" USING btree ("storage_provider","bucket","object_key");--> statement-breakpoint
CREATE INDEX "files_vendor_created_idx" ON "files" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_threads_rfq_vendor_unique" ON "message_threads" USING btree ("rfq_id","vendor_id");--> statement-breakpoint
CREATE INDEX "message_threads_rfq_idx" ON "message_threads" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "message_threads_vendor_updated_idx" ON "message_threads" USING btree ("vendor_id","updated_at");--> statement-breakpoint
CREATE INDEX "messages_thread_created_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_retry_idx" ON "notification_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_type_channel_unique" ON "notification_preferences" USING btree ("user_id","notification_type","channel");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("status","available_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_idempotency_unique" ON "payment_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_attempts_payment_status_idx" ON "payment_attempts" USING btree ("payment_id","status");--> statement-breakpoint
CREATE INDEX "payment_schedule_items_agreement_status_idx" ON "payment_schedule_items" USING btree ("agreement_id","status");--> statement-breakpoint
CREATE INDEX "payment_schedule_items_revision_sort_idx" ON "payment_schedule_items" USING btree ("quote_revision_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_stripe_payment_intent_unique" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_stripe_checkout_session_unique" ON "payments" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "payments_vendor_status_idx" ON "payments" USING btree ("vendor_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payments_rfq_quote_idx" ON "payments" USING btree ("rfq_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_stripe_payout_unique" ON "payouts" USING btree ("stripe_payout_id");--> statement-breakpoint
CREATE INDEX "payouts_vendor_status_idx" ON "payouts" USING btree ("vendor_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_agreement_fees_agreement_unique" ON "platform_agreement_fees" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "platform_agreement_fees_vendor_status_idx" ON "platform_agreement_fees" USING btree ("vendor_id","status","created_at");--> statement-breakpoint
CREATE INDEX "quote_line_items_revision_sort_idx" ON "quote_line_items" USING btree ("quote_revision_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_revisions_quote_revision_number_unique" ON "quote_revisions" USING btree ("quote_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_rfq_vendor_unique" ON "quotes" USING btree ("rfq_id","vendor_id");--> statement-breakpoint
CREATE INDEX "quotes_rfq_vendor_status_idx" ON "quotes" USING btree ("rfq_id","vendor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_unique" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_status_idx" ON "refresh_tokens" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("token_family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_stripe_refund_unique" ON "refunds" USING btree ("stripe_refund_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_status_idx" ON "refunds" USING btree ("payment_id","status");--> statement-breakpoint
CREATE INDEX "rfq_requirements_rfq_type_idx" ON "rfq_requirements" USING btree ("rfq_id","type");--> statement-breakpoint
CREATE INDEX "rfq_status_history_rfq_created_idx" ON "rfq_status_history" USING btree ("rfq_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rfq_vendor_targets_rfq_vendor_unique" ON "rfq_vendor_targets" USING btree ("rfq_id","vendor_id");--> statement-breakpoint
CREATE INDEX "rfq_vendor_targets_vendor_status_idx" ON "rfq_vendor_targets" USING btree ("vendor_id","status","created_at");--> statement-breakpoint
CREATE INDEX "rfqs_customer_created_idx" ON "rfqs" USING btree ("customer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "rfqs_status_created_idx" ON "rfqs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_status_idx" ON "sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_unique" ON "stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_status_received_idx" ON "stripe_webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "thread_read_states_user_idx" ON "thread_read_states" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendor_cuisines_cuisine_vendor_idx" ON "vendor_cuisines" USING btree ("cuisine_id","vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_invoice_line_items_invoice_idx" ON "vendor_invoice_line_items" USING btree ("vendor_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_invoices_invoice_number_unique" ON "vendor_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "vendor_invoices_vendor_status_idx" ON "vendor_invoices" USING btree ("vendor_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_memberships_vendor_user_unique" ON "vendor_memberships" USING btree ("vendor_id","user_id");--> statement-breakpoint
CREATE INDEX "vendor_memberships_user_status_idx" ON "vendor_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "vendor_memberships_vendor_role_idx" ON "vendor_memberships" USING btree ("vendor_id","role");--> statement-breakpoint
CREATE INDEX "vendor_service_areas_marketplace_idx" ON "vendor_service_areas" USING btree ("metro_area","state");--> statement-breakpoint
CREATE INDEX "vendor_service_areas_vendor_idx" ON "vendor_service_areas" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_slug_unique" ON "vendors" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_stripe_connect_account_unique" ON "vendors" USING btree ("stripe_connect_account_id");--> statement-breakpoint
CREATE INDEX "vendors_marketplace_idx" ON "vendors" USING btree ("status","approval_status","is_published");