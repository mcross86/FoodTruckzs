import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
  "pending_verification",
  "active",
  "suspended",
  "disabled",
]);

export const sessionStatusEnum = pgEnum("session_status", ["active", "revoked", "expired"]);
export const refreshTokenStatusEnum = pgEnum("refresh_token_status", [
  "active",
  "rotated",
  "revoked",
  "reused",
  "expired",
]);

export const vendorStatusEnum = pgEnum("vendor_status", ["active", "suspended", "closed"]);
export const vendorApprovalStatusEnum = pgEnum("vendor_approval_status", [
  "pending",
  "approved",
  "rejected",
]);
export const vendorMembershipRoleEnum = pgEnum("vendor_membership_role", [
  "owner",
  "manager",
  "staff",
  "viewer",
]);
export const vendorMembershipStatusEnum = pgEnum("vendor_membership_status", [
  "active",
  "invited",
  "suspended",
  "removed",
]);
export const vendorMenuStatusEnum = pgEnum("vendor_menu_status", [
  "draft",
  "published",
  "archived",
]);
export const vendorMenuItemStatusEnum = pgEnum("vendor_menu_item_status", ["active", "archived"]);
export const vendorMenuPackageStatusEnum = pgEnum("vendor_menu_package_status", [
  "active",
  "archived",
]);

export const fileStatusEnum = pgEnum("file_status", ["pending", "ready", "failed", "deleted"]);
export const fileVisibilityEnum = pgEnum("file_visibility", ["public", "private"]);

export const rfqStatusEnum = pgEnum("rfq_status", [
  "draft",
  "submitted",
  "vendor_reviewing",
  "clarification_requested",
  "quote_in_progress",
  "quote_sent",
  "negotiation",
  "accepted",
  "agreement_pending",
  "agreement_signed",
  "deposit_paid",
  "confirmed",
  "completed",
  "cancelled",
]);
export const rfqVendorTargetStatusEnum = pgEnum("rfq_vendor_target_status", [
  "invited",
  "viewed",
  "accepted",
  "rejected",
  "quote_sent",
  "expired",
  "cancelled",
]);
export const rfqRequirementTypeEnum = pgEnum("rfq_requirement_type", [
  "food",
  "equipment",
  "dietary",
  "service",
  "other",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "not_selected",
]);
export const quoteLineItemTypeEnum = pgEnum("quote_line_item_type", [
  "food",
  "service",
  "staffing",
  "travel",
  "rental",
  "fee",
  "tax",
  "gratuity",
  "service_charge",
  "overtime",
  "discount",
]);
export const paymentScheduleItemTypeEnum = pgEnum("payment_schedule_item_type", [
  "deposit",
  "milestone",
  "final_balance",
  "invoice",
  "onsite",
]);
export const paymentScheduleItemStatusEnum = pgEnum("payment_schedule_item_status", [
  "pending",
  "due",
  "paid",
  "waived",
  "cancelled",
  "failed",
]);

export const agreementStatusEnum = pgEnum("agreement_status", [
  "draft",
  "pending_signature",
  "signed",
  "cancelled",
  "expired",
]);
export const agreementSignatureRoleEnum = pgEnum("agreement_signature_role", [
  "customer",
  "vendor",
  "platform_admin",
]);

export const messageThreadStatusEnum = pgEnum("message_thread_status", [
  "open",
  "closed",
  "archived",
]);
export const messageStatusEnum = pgEnum("message_status", ["visible", "deleted"]);

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "confirmed_catering",
  "manual_booking",
  "food_truck_location",
  "festival",
  "blocked_time",
]);
export const calendarEventStatusEnum = pgEnum("calendar_event_status", [
  "tentative",
  "confirmed",
  "blocking",
  "cancelled",
  "completed",
]);
export const cateringEventStatusEnum = pgEnum("catering_event_status", [
  "pending_deposit",
  "confirmed",
  "completed",
  "cancelled",
]);
export const availabilityExceptionTypeEnum = pgEnum("availability_exception_type", [
  "blackout",
  "special_hours",
  "capacity_limit",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "deposit",
  "milestone",
  "final_balance",
  "invoice",
  "onsite",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "requires_payment",
  "checkout_created",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refund_pending",
  "partially_refunded",
  "refunded",
]);
export const paymentAttemptStatusEnum = pgEnum("payment_attempt_status", [
  "checkout_pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]);
export const refundStatusEnum = pgEnum("refund_status", [
  "requested",
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "in_transit",
  "paid",
  "failed",
  "cancelled",
]);
export const stripeWebhookStatusEnum = pgEnum("stripe_webhook_status", [
  "received",
  "processed",
  "failed",
  "ignored",
]);

export const platformFeeStatusEnum = pgEnum("platform_fee_status", [
  "pending_invoice",
  "invoiced",
  "paid",
  "void",
  "adjusted",
]);
export const vendorInvoiceStatusEnum = pgEnum("vendor_invoice_status", [
  "draft",
  "issued",
  "paid",
  "overdue",
  "void",
  "adjusted",
]);
export const vendorInvoiceLineItemTypeEnum = pgEnum("vendor_invoice_line_item_type", [
  "agreement_fee",
  "adjustment",
  "credit",
]);

export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email", "sms"]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);
export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "processed",
  "failed",
  "dead_letter",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone"),
    status: userStatusEnum("status").notNull().default("pending_verification"),
    globalRoles: jsonb("global_roles")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
    index("users_status_idx").on(table.status),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: sessionStatusEnum("status").notNull().default("active"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sessions_user_status_idx").on(table.userId, table.status),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    tokenFamilyId: uuid("token_family_id").notNull(),
    status: refreshTokenStatusEnum("status").notNull().default("active"),
    replacedByTokenId: uuid("replaced_by_token_id").references((): AnyPgColumn => refreshTokens.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("refresh_tokens_token_hash_unique").on(table.tokenHash),
    index("refresh_tokens_session_status_idx").on(table.sessionId, table.status),
    index("refresh_tokens_family_idx").on(table.tokenFamilyId),
  ],
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessName: text("business_name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: vendorStatusEnum("status").notNull().default("active"),
    approvalStatus: vendorApprovalStatusEnum("approval_status").notNull().default("pending"),
    isPublished: boolean("is_published").notNull().default(false),
    primaryContactUserId: uuid("primary_contact_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    stripeConnectAccountId: text("stripe_connect_account_id"),
    stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
    stripeDetailsSubmitted: boolean("stripe_details_submitted").notNull().default(false),
    stripeDisabledReason: text("stripe_disabled_reason"),
    cateringMinimumCents: integer("catering_minimum_cents"),
    pricingSummary: text("pricing_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("vendors_slug_unique").on(table.slug),
    uniqueIndex("vendors_stripe_connect_account_unique").on(table.stripeConnectAccountId),
    index("vendors_marketplace_idx").on(table.status, table.approvalStatus, table.isPublished),
    check(
      "vendors_catering_minimum_non_negative",
      sql`${table.cateringMinimumCents} IS NULL OR ${table.cateringMinimumCents} >= 0`,
    ),
  ],
);

export const vendorMemberships = pgTable(
  "vendor_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: vendorMembershipRoleEnum("role").notNull(),
    status: vendorMembershipStatusEnum("status").notNull().default("invited"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("vendor_memberships_vendor_user_unique").on(table.vendorId, table.userId),
    index("vendor_memberships_user_status_idx").on(table.userId, table.status),
    index("vendor_memberships_vendor_role_idx").on(table.vendorId, table.role),
  ],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storageProvider: text("storage_provider").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum"),
    visibility: fileVisibilityEnum("visibility").notNull().default("private"),
    status: fileStatusEnum("status").notNull().default("pending"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("files_storage_object_unique").on(
      table.storageProvider,
      table.bucket,
      table.objectKey,
    ),
    index("files_vendor_created_idx").on(table.vendorId, table.createdAt),
    check("files_size_positive", sql`${table.sizeBytes} > 0`),
  ],
);

export const vendorProfiles = pgTable("vendor_profiles", {
  vendorId: uuid("vendor_id")
    .primaryKey()
    .references(() => vendors.id, { onDelete: "cascade" }),
  headline: text("headline"),
  publicDescription: text("public_description"),
  ownerContactName: text("owner_contact_name"),
  businessPhone: text("business_phone"),
  businessEmail: text("business_email"),
  websiteUrl: text("website_url"),
  socialLinks: jsonb("social_links")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  serviceStyles: jsonb("service_styles")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  dietaryAccommodations: jsonb("dietary_accommodations")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  operationalHours: jsonb("operational_hours")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  coverImageFileId: uuid("cover_image_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  galleryFileIds: jsonb("gallery_file_ids")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  averageResponseTimeMinutes: integer("average_response_time_minutes"),
  businessLicenseMetadata: jsonb("business_license_metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  insuranceMetadata: jsonb("insurance_metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const cuisines = pgTable(
  "cuisines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("cuisines_slug_unique").on(table.slug)],
);

export const vendorCuisines = pgTable(
  "vendor_cuisines",
  {
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    cuisineId: uuid("cuisine_id")
      .notNull()
      .references(() => cuisines.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.vendorId, table.cuisineId] }),
    index("vendor_cuisines_cuisine_vendor_idx").on(table.cuisineId, table.vendorId),
  ],
);

export const vendorServiceAreas = pgTable(
  "vendor_service_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    metroArea: text("metro_area").notNull(),
    city: text("city"),
    state: text("state").notNull(),
    postalCode: text("postal_code"),
    radiusMiles: integer("radius_miles"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_service_areas_marketplace_idx").on(table.metroArea, table.state),
    index("vendor_service_areas_vendor_idx").on(table.vendorId),
    check(
      "vendor_service_areas_radius_positive",
      sql`${table.radiusMiles} IS NULL OR ${table.radiusMiles} > 0`,
    ),
  ],
);

export const vendorOperatingSettings = pgTable(
  "vendor_operating_settings",
  {
    vendorId: uuid("vendor_id")
      .primaryKey()
      .references(() => vendors.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull().default("America/New_York"),
    minimumLeadTimeDays: integer("minimum_lead_time_days").notNull().default(7),
    travelRadiusMiles: integer("travel_radius_miles"),
    minimumGuestCount: integer("minimum_guest_count"),
    maxDailyBookings: integer("max_daily_bookings"),
    defaultSetupMinutes: integer("default_setup_minutes").notNull().default(60),
    defaultTravelBufferMinutes: integer("default_travel_buffer_minutes").notNull().default(30),
    quoteResponseTargetHours: integer("quote_response_target_hours"),
    requestAnywayOnBlackout: boolean("request_anyway_on_blackout").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("vendor_operating_settings_lead_time_minimum", sql`${table.minimumLeadTimeDays} >= 7`),
    check(
      "vendor_operating_settings_travel_radius_positive",
      sql`${table.travelRadiusMiles} IS NULL OR ${table.travelRadiusMiles} > 0`,
    ),
    check(
      "vendor_operating_settings_minimum_guest_positive",
      sql`${table.minimumGuestCount} IS NULL OR ${table.minimumGuestCount} > 0`,
    ),
    check(
      "vendor_operating_settings_max_daily_positive",
      sql`${table.maxDailyBookings} IS NULL OR ${table.maxDailyBookings} > 0`,
    ),
    check("vendor_operating_settings_setup_non_negative", sql`${table.defaultSetupMinutes} >= 0`),
    check(
      "vendor_operating_settings_travel_buffer_non_negative",
      sql`${table.defaultTravelBufferMinutes} >= 0`,
    ),
    check(
      "vendor_operating_settings_response_target_positive",
      sql`${table.quoteResponseTargetHours} IS NULL OR ${table.quoteResponseTargetHours} > 0`,
    ),
  ],
);

export const vendorMenus = pgTable(
  "vendor_menus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: vendorMenuStatusEnum("status").notNull().default("draft"),
    isPublic: boolean("is_public").notNull().default(false),
    minimumGuestCount: integer("minimum_guest_count"),
    maximumGuestCount: integer("maximum_guest_count"),
    prepLeadTimeHours: integer("prep_lead_time_hours"),
    seasonalStartDate: date("seasonal_start_date"),
    seasonalEndDate: date("seasonal_end_date"),
    serviceStyles: jsonb("service_styles")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dietaryTags: jsonb("dietary_tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("vendor_menus_vendor_status_idx").on(table.vendorId, table.status, table.createdAt),
    check(
      "vendor_menus_min_guest_positive",
      sql`${table.minimumGuestCount} IS NULL OR ${table.minimumGuestCount} > 0`,
    ),
    check(
      "vendor_menus_max_guest_positive",
      sql`${table.maximumGuestCount} IS NULL OR ${table.maximumGuestCount} > 0`,
    ),
    check(
      "vendor_menus_guest_range",
      sql`${table.minimumGuestCount} IS NULL OR ${table.maximumGuestCount} IS NULL OR ${table.minimumGuestCount} <= ${table.maximumGuestCount}`,
    ),
    check(
      "vendor_menus_prep_lead_time_non_negative",
      sql`${table.prepLeadTimeHours} IS NULL OR ${table.prepLeadTimeHours} >= 0`,
    ),
    check(
      "vendor_menus_seasonal_date_range",
      sql`${table.seasonalStartDate} IS NULL OR ${table.seasonalEndDate} IS NULL OR ${table.seasonalStartDate} <= ${table.seasonalEndDate}`,
    ),
  ],
);

export const vendorMenuItems = pgTable(
  "vendor_menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => vendorMenus.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    priceCents: integer("price_cents"),
    dietaryTags: jsonb("dietary_tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    status: vendorMenuItemStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("vendor_menu_items_menu_sort_idx").on(table.menuId, table.sortOrder),
    index("vendor_menu_items_vendor_idx").on(table.vendorId),
    check(
      "vendor_menu_items_price_non_negative",
      sql`${table.priceCents} IS NULL OR ${table.priceCents} >= 0`,
    ),
  ],
);

export const vendorMenuPackages = pgTable(
  "vendor_menu_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => vendorMenus.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents"),
    pricingModel: text("pricing_model").notNull().default("fixed"),
    minimumGuestCount: integer("minimum_guest_count"),
    maximumGuestCount: integer("maximum_guest_count"),
    includedItemIds: jsonb("included_item_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dietaryTags: jsonb("dietary_tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    status: vendorMenuPackageStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("vendor_menu_packages_menu_sort_idx").on(table.menuId, table.sortOrder),
    index("vendor_menu_packages_vendor_idx").on(table.vendorId),
    check(
      "vendor_menu_packages_price_non_negative",
      sql`${table.priceCents} IS NULL OR ${table.priceCents} >= 0`,
    ),
    check(
      "vendor_menu_packages_min_guest_positive",
      sql`${table.minimumGuestCount} IS NULL OR ${table.minimumGuestCount} > 0`,
    ),
    check(
      "vendor_menu_packages_max_guest_positive",
      sql`${table.maximumGuestCount} IS NULL OR ${table.maximumGuestCount} > 0`,
    ),
    check(
      "vendor_menu_packages_guest_range",
      sql`${table.minimumGuestCount} IS NULL OR ${table.maximumGuestCount} IS NULL OR ${table.minimumGuestCount} <= ${table.maximumGuestCount}`,
    ),
  ],
);

export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code"),
  country: text("country").notNull().default("US"),
  timezone: text("timezone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rfqs = pgTable(
  "rfqs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventName: text("event_name").notNull(),
    eventType: text("event_type").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    venueAddressId: uuid("venue_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    indoorOutdoor: text("indoor_outdoor").notNull(),
    estimatedHeadcount: integer("estimated_headcount").notNull(),
    budgetMinCents: integer("budget_min_cents"),
    budgetMaxCents: integer("budget_max_cents"),
    quoteResponseDeadline: timestamp("quote_response_deadline", { withTimezone: true }),
    status: rfqStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("rfqs_customer_created_idx").on(table.customerUserId, table.createdAt),
    index("rfqs_status_created_idx").on(table.status, table.createdAt),
    check("rfqs_valid_time", sql`${table.startsAt} < ${table.endsAt}`),
    check("rfqs_positive_headcount", sql`${table.estimatedHeadcount} > 0`),
    check(
      "rfqs_non_negative_budget_min",
      sql`${table.budgetMinCents} IS NULL OR ${table.budgetMinCents} >= 0`,
    ),
    check(
      "rfqs_non_negative_budget_max",
      sql`${table.budgetMaxCents} IS NULL OR ${table.budgetMaxCents} >= 0`,
    ),
    check(
      "rfqs_budget_range",
      sql`${table.budgetMinCents} IS NULL OR ${table.budgetMaxCents} IS NULL OR ${table.budgetMinCents} <= ${table.budgetMaxCents}`,
    ),
  ],
);

export const rfqVendorTargets = pgTable(
  "rfq_vendor_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    status: rfqVendorTargetStatusEnum("status").notNull().default("invited"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rfq_vendor_targets_rfq_vendor_unique").on(table.rfqId, table.vendorId),
    index("rfq_vendor_targets_vendor_status_idx").on(table.vendorId, table.status, table.createdAt),
  ],
);

export const rfqRequirements = pgTable(
  "rfq_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    type: rfqRequirementTypeEnum("type").notNull(),
    label: text("label").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("rfq_requirements_rfq_type_idx").on(table.rfqId, table.type)],
);

export const rfqStatusHistory = pgTable(
  "rfq_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    fromStatus: rfqStatusEnum("from_status"),
    toStatus: rfqStatusEnum("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("rfq_status_history_rfq_created_idx").on(table.rfqId, table.createdAt)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    status: quoteStatusEnum("status").notNull().default("draft"),
    currentRevisionId: uuid("current_revision_id").references(
      (): AnyPgColumn => quoteRevisions.id,
      { onDelete: "set null" },
    ),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    feesCents: integer("fees_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    depositRequiredCents: integer("deposit_required_cents").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("quotes_rfq_vendor_unique").on(table.rfqId, table.vendorId),
    index("quotes_rfq_vendor_status_idx").on(table.rfqId, table.vendorId, table.status),
    check("quotes_subtotal_non_negative", sql`${table.subtotalCents} >= 0`),
    check("quotes_fees_non_negative", sql`${table.feesCents} >= 0`),
    check("quotes_tax_non_negative", sql`${table.taxCents} >= 0`),
    check("quotes_total_non_negative", sql`${table.totalCents} >= 0`),
    check("quotes_deposit_non_negative", sql`${table.depositRequiredCents} >= 0`),
  ],
);

export const quoteRevisions = pgTable(
  "quote_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    notes: text("notes"),
    serviceStyle: text("service_style"),
    menuSummary: text("menu_summary"),
    assumptions: jsonb("assumptions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    exclusions: jsonb("exclusions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    cancellationPolicySummary: text("cancellation_policy_summary"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    feesCents: integer("fees_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    depositRequiredCents: integer("deposit_required_cents").notNull().default(0),
    paymentSchedule: jsonb("payment_schedule")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("quote_revisions_quote_revision_number_unique").on(
      table.quoteId,
      table.revisionNumber,
    ),
    check("quote_revisions_revision_positive", sql`${table.revisionNumber} > 0`),
    check("quote_revisions_subtotal_non_negative", sql`${table.subtotalCents} >= 0`),
    check("quote_revisions_fees_non_negative", sql`${table.feesCents} >= 0`),
    check("quote_revisions_tax_non_negative", sql`${table.taxCents} >= 0`),
    check("quote_revisions_total_non_negative", sql`${table.totalCents} >= 0`),
    check("quote_revisions_deposit_non_negative", sql`${table.depositRequiredCents} >= 0`),
  ],
);

export const quoteLineItems = pgTable(
  "quote_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    quoteRevisionId: uuid("quote_revision_id")
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: "cascade" }),
    type: quoteLineItemTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit").notNull().default("each"),
    unitAmountCents: integer("unit_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    taxable: boolean("taxable").notNull().default(false),
    isOptional: boolean("is_optional").notNull().default(false),
    isInternal: boolean("is_internal").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("quote_line_items_revision_sort_idx").on(table.quoteRevisionId, table.sortOrder),
    check("quote_line_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "quote_line_items_unit_amount_discount_guard",
      sql`${table.type} = 'discount' OR ${table.unitAmountCents} >= 0`,
    ),
    check(
      "quote_line_items_total_amount_discount_guard",
      sql`${table.type} = 'discount' OR ${table.totalAmountCents} >= 0`,
    ),
  ],
);

export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),
    quoteRevisionId: uuid("quote_revision_id")
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: agreementStatusEnum("status").notNull().default("draft"),
    currentVersionId: uuid("current_version_id").references(
      (): AnyPgColumn => agreementVersions.id,
      { onDelete: "set null" },
    ),
    documentFileId: uuid("document_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    signedDocumentFileId: uuid("signed_document_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("agreements_quote_revision_unique").on(table.quoteRevisionId),
    index("agreements_vendor_status_idx").on(table.vendorId, table.status, table.createdAt),
    index("agreements_customer_status_idx").on(table.customerUserId, table.status, table.createdAt),
  ],
);

export const agreementVersions = pgTable(
  "agreement_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    termsSnapshot: jsonb("terms_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    documentFileId: uuid("document_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("agreement_versions_agreement_version_unique").on(
      table.agreementId,
      table.versionNumber,
    ),
    check("agreement_versions_version_positive", sql`${table.versionNumber} > 0`),
  ],
);

export const agreementSignatures = pgTable(
  "agreement_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "cascade" }),
    agreementVersionId: uuid("agreement_version_id")
      .notNull()
      .references(() => agreementVersions.id, { onDelete: "restrict" }),
    signerUserId: uuid("signer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    signerRole: agreementSignatureRoleEnum("signer_role").notNull(),
    typedName: text("typed_name").notNull(),
    signatureMetadata: jsonb("signature_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    signedDocumentFileId: uuid("signed_document_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("agreement_signatures_unique_signer_role").on(
      table.agreementId,
      table.signerRole,
      table.signerUserId,
    ),
  ],
);

export const paymentScheduleItems = pgTable(
  "payment_schedule_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteRevisionId: uuid("quote_revision_id")
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: "cascade" }),
    agreementId: uuid("agreement_id").references(() => agreements.id, { onDelete: "cascade" }),
    type: paymentScheduleItemTypeEnum("type").notNull(),
    status: paymentScheduleItemStatusEnum("status").notNull().default("pending"),
    label: text("label").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_schedule_items_agreement_status_idx").on(table.agreementId, table.status),
    index("payment_schedule_items_revision_sort_idx").on(table.quoteRevisionId, table.sortOrder),
    check("payment_schedule_items_amount_non_negative", sql`${table.amountCents} >= 0`),
  ],
);

export const messageThreads = pgTable(
  "message_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: messageThreadStatusEnum("status").notNull().default("open"),
    lastMessageId: uuid("last_message_id").references((): AnyPgColumn => messages.id, {
      onDelete: "set null",
    }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("message_threads_rfq_vendor_unique").on(table.rfqId, table.vendorId),
    index("message_threads_rfq_idx").on(table.rfqId),
    index("message_threads_vendor_updated_idx").on(table.vendorId, table.updatedAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body"),
    attachmentFileId: uuid("attachment_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    status: messageStatusEnum("status").notNull().default("visible"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("messages_thread_created_idx").on(table.threadId, table.createdAt),
    check(
      "messages_body_or_attachment_required",
      sql`${table.body} IS NOT NULL OR ${table.attachmentFileId} IS NOT NULL`,
    ),
  ],
);

export const threadReadStates = pgTable(
  "thread_read_states",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadMessageId: uuid("last_read_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.threadId, table.userId] }),
    index("thread_read_states_user_idx").on(table.userId),
  ],
);

export const cateringEvents = pgTable(
  "catering_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    rfqId: uuid("rfq_id").references(() => rfqs.id, { onDelete: "set null" }),
    agreementId: uuid("agreement_id").references(() => agreements.id, { onDelete: "set null" }),
    customerUserId: uuid("customer_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    venueAddressId: uuid("venue_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    status: cateringEventStatusEnum("status").notNull().default("pending_deposit"),
    source: text("source").notNull().default("agreement"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("catering_events_agreement_unique").on(table.agreementId),
    index("catering_events_vendor_range_idx").on(table.vendorId, table.startsAt, table.endsAt),
    check("catering_events_valid_time", sql`${table.startsAt} < ${table.endsAt}`),
  ],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    cateringEventId: uuid("catering_event_id").references(() => cateringEvents.id, {
      onDelete: "set null",
    }),
    type: calendarEventTypeEnum("type").notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    location: text("location"),
    venueAddressId: uuid("venue_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    status: calendarEventStatusEnum("status").notNull().default("tentative"),
    source: text("source").notNull().default("manual"),
    notes: text("notes"),
    isBlocking: boolean("is_blocking").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("calendar_events_catering_event_unique").on(table.cateringEventId),
    index("calendar_events_vendor_range_idx").on(table.vendorId, table.startsAt, table.endsAt),
    index("calendar_events_vendor_status_idx").on(table.vendorId, table.status),
    check("calendar_events_valid_time", sql`${table.startsAt} < ${table.endsAt}`),
  ],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startsAtLocal: time("starts_at_local").notNull(),
    endsAtLocal: time("ends_at_local").notNull(),
    timezone: text("timezone").notNull(),
    effectiveStartDate: date("effective_start_date"),
    effectiveEndDate: date("effective_end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("availability_rules_vendor_day_idx").on(table.vendorId, table.dayOfWeek),
    check("availability_rules_day_of_week_range", sql`${table.dayOfWeek} BETWEEN 0 AND 6`),
    check("availability_rules_valid_time", sql`${table.startsAtLocal} < ${table.endsAtLocal}`),
  ],
);

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    type: availabilityExceptionTypeEnum("type").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    reason: text("reason"),
    capacityLimit: integer("capacity_limit"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("availability_exceptions_vendor_range_idx").on(
      table.vendorId,
      table.startsAt,
      table.endsAt,
    ),
    check("availability_exceptions_valid_time", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "availability_exceptions_capacity_non_negative",
      sql`${table.capacityLimit} IS NULL OR ${table.capacityLimit} >= 0`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentScheduleItemId: uuid("payment_schedule_item_id").references(
      () => paymentScheduleItems.id,
      {
        onDelete: "set null",
      },
    ),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "restrict" }),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: paymentTypeEnum("type").notNull(),
    status: paymentStatusEnum("status").notNull().default("requires_payment"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    processingFeeCents: integer("processing_fee_cents").notNull().default(0),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payments_stripe_payment_intent_unique").on(table.stripePaymentIntentId),
    uniqueIndex("payments_stripe_checkout_session_unique").on(table.stripeCheckoutSessionId),
    index("payments_vendor_status_idx").on(table.vendorId, table.status, table.createdAt),
    index("payments_rfq_quote_idx").on(table.rfqId, table.quoteId),
    check("payments_amount_positive", sql`${table.amountCents} > 0`),
    check("payments_processing_fee_non_negative", sql`${table.processingFeeCents} >= 0`),
  ],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    status: paymentAttemptStatusEnum("status").notNull().default("checkout_pending"),
    idempotencyKey: text("idempotency_key"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    uniqueIndex("payment_attempts_idempotency_unique").on(table.idempotencyKey),
    index("payment_attempts_payment_status_idx").on(table.paymentId, table.status),
    check("payment_attempts_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    reason: text("reason"),
    status: refundStatusEnum("status").notNull().default("requested"),
    stripeRefundId: text("stripe_refund_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("refunds_stripe_refund_unique").on(table.stripeRefundId),
    index("refunds_payment_status_idx").on(table.paymentId, table.status),
    check("refunds_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    status: payoutStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    stripePayoutId: text("stripe_payout_id"),
    arrivalDate: date("arrival_date"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payouts_stripe_payout_unique").on(table.stripePayoutId),
    index("payouts_vendor_status_idx").on(table.vendorId, table.status, table.createdAt),
    check("payouts_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: stripeWebhookStatusEnum("status").notNull().default("received"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stripe_webhook_events_stripe_event_unique").on(table.stripeEventId),
    index("stripe_webhook_events_status_received_idx").on(table.status, table.receivedAt),
  ],
);

export const vendorBillingSettings = pgTable(
  "vendor_billing_settings",
  {
    vendorId: uuid("vendor_id")
      .primaryKey()
      .references(() => vendors.id, { onDelete: "cascade" }),
    agreementFeeBasisPoints: integer("agreement_fee_basis_points").notNull().default(0),
    billingEmail: text("billing_email"),
    invoiceTermsDays: integer("invoice_terms_days").notNull().default(30),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("vendor_billing_settings_fee_non_negative", sql`${table.agreementFeeBasisPoints} >= 0`),
    check("vendor_billing_settings_invoice_terms_positive", sql`${table.invoiceTermsDays} > 0`),
  ],
);

export const vendorInvoices = pgTable(
  "vendor_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    status: vendorInvoiceStatusEnum("status").notNull().default("draft"),
    billingPeriodStart: date("billing_period_start"),
    billingPeriodEnd: date("billing_period_end"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("vendor_invoices_invoice_number_unique").on(table.invoiceNumber),
    index("vendor_invoices_vendor_status_idx").on(table.vendorId, table.status, table.createdAt),
    check("vendor_invoices_subtotal_non_negative", sql`${table.subtotalCents} >= 0`),
    check("vendor_invoices_total_non_negative", sql`${table.totalCents} >= 0`),
  ],
);

export const platformAgreementFees = pgTable(
  "platform_agreement_fees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    signedAgreementTotalCents: integer("signed_agreement_total_cents").notNull(),
    feePercentageBasisPoints: integer("fee_percentage_basis_points").notNull(),
    feeAmountCents: integer("fee_amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: platformFeeStatusEnum("status").notNull().default("pending_invoice"),
    vendorInvoiceId: uuid("vendor_invoice_id").references(() => vendorInvoices.id, {
      onDelete: "set null",
    }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_agreement_fees_agreement_unique").on(table.agreementId),
    index("platform_agreement_fees_vendor_status_idx").on(
      table.vendorId,
      table.status,
      table.createdAt,
    ),
    check(
      "platform_agreement_fees_signed_total_non_negative",
      sql`${table.signedAgreementTotalCents} >= 0`,
    ),
    check(
      "platform_agreement_fees_percentage_non_negative",
      sql`${table.feePercentageBasisPoints} >= 0`,
    ),
    check("platform_agreement_fees_amount_non_negative", sql`${table.feeAmountCents} >= 0`),
  ],
);

export const vendorInvoiceLineItems = pgTable(
  "vendor_invoice_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorInvoiceId: uuid("vendor_invoice_id")
      .notNull()
      .references(() => vendorInvoices.id, { onDelete: "cascade" }),
    platformAgreementFeeId: uuid("platform_agreement_fee_id").references(
      () => platformAgreementFees.id,
      { onDelete: "restrict" },
    ),
    type: vendorInvoiceLineItemTypeEnum("type").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_invoice_line_items_invoice_idx").on(table.vendorInvoiceId),
    check("vendor_invoice_line_items_amount_not_zero", sql`${table.amountCents} <> 0`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outboxEventId: uuid("outbox_event_id").references(() => outboxEvents.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_user_outbox_type_unique").on(
      table.userId,
      table.outboxEventId,
      table.type,
    ),
    index("notifications_user_read_idx").on(table.userId, table.readAt, table.createdAt),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationType: text("notification_type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_preferences_user_type_channel_unique").on(
      table.userId,
      table.notificationType,
      table.channel,
    ),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationDeliveryStatusEnum("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notification_deliveries_status_retry_idx").on(table.status, table.nextRetryAt),
    uniqueIndex("notification_deliveries_notification_channel_unique").on(
      table.notificationId,
      table.channel,
    ),
    check("notification_deliveries_attempts_non_negative", sql`${table.attemptCount} >= 0`),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("outbox_events_claim_idx").on(table.status, table.availableAt, table.createdAt),
    check("outbox_events_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
    newState: jsonb("new_state").$type<Record<string, unknown>>(),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
    index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
  ],
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;
export type Vendor = InferSelectModel<typeof vendors>;
export type NewVendor = InferInsertModel<typeof vendors>;
export type VendorMembership = InferSelectModel<typeof vendorMemberships>;
export type NewVendorMembership = InferInsertModel<typeof vendorMemberships>;
export type VendorOperatingSettings = InferSelectModel<typeof vendorOperatingSettings>;
export type NewVendorOperatingSettings = InferInsertModel<typeof vendorOperatingSettings>;
export type VendorMenu = InferSelectModel<typeof vendorMenus>;
export type NewVendorMenu = InferInsertModel<typeof vendorMenus>;
export type VendorMenuItem = InferSelectModel<typeof vendorMenuItems>;
export type NewVendorMenuItem = InferInsertModel<typeof vendorMenuItems>;
export type VendorMenuPackage = InferSelectModel<typeof vendorMenuPackages>;
export type NewVendorMenuPackage = InferInsertModel<typeof vendorMenuPackages>;
export type Rfq = InferSelectModel<typeof rfqs>;
export type NewRfq = InferInsertModel<typeof rfqs>;
export type Quote = InferSelectModel<typeof quotes>;
export type NewQuote = InferInsertModel<typeof quotes>;
export type Agreement = InferSelectModel<typeof agreements>;
export type NewAgreement = InferInsertModel<typeof agreements>;
export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;
export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type NotificationPreference = InferSelectModel<typeof notificationPreferences>;
export type NewNotificationPreference = InferInsertModel<typeof notificationPreferences>;
export type NotificationDelivery = InferSelectModel<typeof notificationDeliveries>;
export type NewNotificationDelivery = InferInsertModel<typeof notificationDeliveries>;
export type OutboxEvent = InferSelectModel<typeof outboxEvents>;
export type NewOutboxEvent = InferInsertModel<typeof outboxEvents>;
