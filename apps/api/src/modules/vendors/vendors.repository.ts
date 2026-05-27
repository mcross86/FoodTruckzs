import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  auditLogs,
  availabilityExceptions,
  availabilityRules,
  cuisines,
  vendorBillingSettings,
  vendorCuisines,
  vendorMenuItems,
  vendorMenuPackages,
  vendorMenus,
  vendorMemberships,
  vendorOperatingSettings,
  vendorProfiles,
  vendors,
  vendorServiceAreas,
  type NewVendor,
  type NewVendorMembership,
  type Vendor,
  type VendorMembership,
} from "../../db/schema/index.js";
import type {
  CreateCuisineDto,
  CreateMenuDto,
  CreateMenuItemDto,
  CreateMenuPackageDto,
  ReplaceAvailabilityDto,
  ReplaceServiceAreasDto,
  UpdateBillingSettingsDto,
  UpdateCuisineDto,
  UpdateMenuDto,
  UpdateMenuItemDto,
  UpdateMenuPackageDto,
  UpdateVendorProfileDto,
} from "./vendors.dto.js";

type VendorDb = Database | Transaction;

type AuditLogRow = typeof auditLogs.$inferSelect;
type VendorProfileRow = typeof vendorProfiles.$inferSelect;
type VendorServiceAreaRow = typeof vendorServiceAreas.$inferSelect;
type CuisineRow = typeof cuisines.$inferSelect;
type VendorOperatingSettingsRow = typeof vendorOperatingSettings.$inferSelect;
type AvailabilityRuleRow = typeof availabilityRules.$inferSelect;
type AvailabilityExceptionRow = typeof availabilityExceptions.$inferSelect;
type VendorBillingSettingsRow = typeof vendorBillingSettings.$inferSelect;
type VendorMenuRow = typeof vendorMenus.$inferSelect;
type VendorMenuItemRow = typeof vendorMenuItems.$inferSelect;
type VendorMenuPackageRow = typeof vendorMenuPackages.$inferSelect;

export type VendorSetupRecord = {
  billingSettings: VendorBillingSettingsRow | null;
  cuisines: CuisineRow[];
  memberships: VendorMembership[];
  operatingSettings: VendorOperatingSettingsRow | null;
  profile: VendorProfileRow | null;
  serviceAreas: VendorServiceAreaRow[];
  vendor: Vendor;
};

export type AvailabilityRecord = {
  exceptions: AvailabilityExceptionRow[];
  rules: AvailabilityRuleRow[];
  settings: VendorOperatingSettingsRow | null;
};

export type MenuDetailRecord = {
  items: VendorMenuItemRow[];
  menu: VendorMenuRow;
  packages: VendorMenuPackageRow[];
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

function now(): Date {
  return new Date();
}

export type CreateVendorInput = Pick<
  NewVendor,
  | "businessName"
  | "cateringMinimumCents"
  | "description"
  | "pricingSummary"
  | "primaryContactUserId"
  | "slug"
  | "status"
>;

export type VendorRepository = {
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createCuisine: (input: CreateCuisineDto) => Promise<CuisineRow>;
  createMembership: (
    input: Pick<NewVendorMembership, "role" | "status" | "userId" | "vendorId">,
  ) => Promise<VendorMembership>;
  createMenu: (vendorId: string, input: CreateMenuDto) => Promise<MenuDetailRecord>;
  createMenuItem: (
    vendorId: string,
    menuId: string,
    input: CreateMenuItemDto,
  ) => Promise<VendorMenuItemRow>;
  createMenuPackage: (
    vendorId: string,
    menuId: string,
    input: CreateMenuPackageDto,
  ) => Promise<VendorMenuPackageRow>;
  createVendor: (input: CreateVendorInput) => Promise<Vendor>;
  deleteMembership: (vendorId: string, membershipId: string) => Promise<VendorMembership | null>;
  findBillingSettingsByVendorId: (vendorId: string) => Promise<VendorBillingSettingsRow | null>;
  findCuisineById: (cuisineId: string) => Promise<CuisineRow | null>;
  findCuisinesByIds: (cuisineIds: string[]) => Promise<CuisineRow[]>;
  findMenuDetail: (vendorId: string, menuId: string) => Promise<MenuDetailRecord | null>;
  findMembershipById: (vendorId: string, membershipId: string) => Promise<VendorMembership | null>;
  findVendorById: (vendorId: string) => Promise<Vendor | null>;
  findVendorSetup: (vendorId: string) => Promise<VendorSetupRecord | null>;
  getAvailability: (vendorId: string) => Promise<AvailabilityRecord>;
  listActiveOwnerMemberships: (vendorId: string) => Promise<VendorMembership[]>;
  listCuisines: () => Promise<CuisineRow[]>;
  listMemberships: (vendorId: string) => Promise<VendorMembership[]>;
  listMenus: (vendorId: string) => Promise<MenuDetailRecord[]>;
  replaceAvailability: (
    vendorId: string,
    input: ReplaceAvailabilityDto,
  ) => Promise<AvailabilityRecord>;
  replaceServiceAreas: (
    vendorId: string,
    input: ReplaceServiceAreasDto,
  ) => Promise<VendorServiceAreaRow[]>;
  replaceVendorCuisines: (vendorId: string, cuisineIds: string[]) => Promise<CuisineRow[]>;
  softDeleteMenu: (
    vendorId: string,
    menuId: string,
    deletedAt: Date,
  ) => Promise<MenuDetailRecord | null>;
  softDeleteVendor: (vendorId: string, deletedAt: Date) => Promise<Vendor | null>;
  transaction: <T>(callback: (repo: VendorRepository) => Promise<T>) => Promise<T>;
  updateBillingSettings: (
    vendorId: string,
    input: UpdateBillingSettingsDto,
  ) => Promise<VendorBillingSettingsRow>;
  updateCuisine: (cuisineId: string, input: UpdateCuisineDto) => Promise<CuisineRow | null>;
  updateMembership: (
    vendorId: string,
    membershipId: string,
    input: Partial<Pick<VendorMembership, "role" | "status">>,
  ) => Promise<VendorMembership | null>;
  updateMenu: (
    vendorId: string,
    menuId: string,
    input: UpdateMenuDto,
  ) => Promise<MenuDetailRecord | null>;
  updateMenuItem: (
    vendorId: string,
    menuId: string,
    itemId: string,
    input: UpdateMenuItemDto,
  ) => Promise<VendorMenuItemRow | null>;
  updateMenuPackage: (
    vendorId: string,
    menuId: string,
    packageId: string,
    input: UpdateMenuPackageDto,
  ) => Promise<VendorMenuPackageRow | null>;
  updateVendorProfile: (
    vendorId: string,
    input: UpdateVendorProfileDto,
  ) => Promise<VendorSetupRecord | null>;
  upsertBillingSettings: (
    vendorId: string,
    input?: Partial<UpdateBillingSettingsDto>,
  ) => Promise<VendorBillingSettingsRow>;
  upsertOperatingSettings: (
    vendorId: string,
    input: Partial<ReplaceAvailabilityDto["settings"]>,
  ) => Promise<VendorOperatingSettingsRow>;
  upsertProfile: (
    vendorId: string,
    input: Pick<
      UpdateVendorProfileDto,
      | "averageResponseTimeMinutes"
      | "businessEmail"
      | "businessPhone"
      | "dietaryAccommodations"
      | "headline"
      | "ownerContactName"
      | "publicDescription"
      | "serviceStyles"
      | "socialLinks"
      | "websiteUrl"
    > & {
      businessLicenseMetadata?: Record<string, unknown>;
      insuranceMetadata?: Record<string, unknown>;
    },
  ) => Promise<VendorProfileRow>;
};

export class DrizzleVendorRepository implements VendorRepository {
  constructor(private readonly db: VendorDb) {}

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async createVendor(input: CreateVendorInput): Promise<Vendor> {
    const [vendor] = await this.db.insert(vendors).values(input).returning();
    return requireReturnedRow(vendor);
  }

  async findVendorById(vendorId: string): Promise<Vendor | null> {
    const [vendor] = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .limit(1);

    return vendor ?? null;
  }

  async softDeleteVendor(vendorId: string, deletedAt: Date): Promise<Vendor | null> {
    const [vendor] = await this.db
      .update(vendors)
      .set({
        deletedAt,
        isPublished: false,
        status: "closed",
        updatedAt: deletedAt,
      })
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .returning();

    return vendor ?? null;
  }

  async upsertProfile(
    vendorId: string,
    input: Pick<
      UpdateVendorProfileDto,
      | "averageResponseTimeMinutes"
      | "businessEmail"
      | "businessPhone"
      | "dietaryAccommodations"
      | "headline"
      | "ownerContactName"
      | "publicDescription"
      | "serviceStyles"
      | "socialLinks"
      | "websiteUrl"
    > & {
      businessLicenseMetadata?: Record<string, unknown>;
      insuranceMetadata?: Record<string, unknown>;
    },
  ): Promise<VendorProfileRow> {
    const updatedAt = now();
    const [profile] = await this.db
      .insert(vendorProfiles)
      .values({
        averageResponseTimeMinutes: input.averageResponseTimeMinutes,
        businessEmail: input.businessEmail,
        businessLicenseMetadata: input.businessLicenseMetadata,
        businessPhone: input.businessPhone,
        dietaryAccommodations: input.dietaryAccommodations,
        headline: input.headline,
        insuranceMetadata: input.insuranceMetadata,
        ownerContactName: input.ownerContactName,
        publicDescription: input.publicDescription,
        serviceStyles: input.serviceStyles,
        socialLinks: input.socialLinks,
        updatedAt,
        vendorId,
        websiteUrl: input.websiteUrl,
      })
      .onConflictDoUpdate({
        set: {
          averageResponseTimeMinutes: input.averageResponseTimeMinutes,
          businessEmail: input.businessEmail,
          businessLicenseMetadata: input.businessLicenseMetadata,
          businessPhone: input.businessPhone,
          dietaryAccommodations: input.dietaryAccommodations,
          headline: input.headline,
          insuranceMetadata: input.insuranceMetadata,
          ownerContactName: input.ownerContactName,
          publicDescription: input.publicDescription,
          serviceStyles: input.serviceStyles,
          socialLinks: input.socialLinks,
          updatedAt,
          websiteUrl: input.websiteUrl,
        },
        target: vendorProfiles.vendorId,
      })
      .returning();

    return requireReturnedRow(profile);
  }

  async updateVendorProfile(
    vendorId: string,
    input: UpdateVendorProfileDto,
  ): Promise<VendorSetupRecord | null> {
    const updatedAt = now();
    const vendorUpdate: Partial<typeof vendors.$inferInsert> = {
      updatedAt,
    };

    if (input.businessName !== undefined) {
      vendorUpdate.businessName = input.businessName;
    }
    if (input.cateringMinimumCents !== undefined) {
      vendorUpdate.cateringMinimumCents = input.cateringMinimumCents;
    }
    if (input.isPublished !== undefined) {
      vendorUpdate.isPublished = input.isPublished;
    }
    if (input.pricingSummary !== undefined) {
      vendorUpdate.pricingSummary = input.pricingSummary;
    }

    await this.db
      .update(vendors)
      .set(vendorUpdate)
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)));

    const profileUpdate: typeof vendorProfiles.$inferInsert = {
      updatedAt,
      vendorId,
    };

    if (input.dietaryAccommodations !== undefined) {
      profileUpdate.dietaryAccommodations = input.dietaryAccommodations;
    }
    if (input.averageResponseTimeMinutes !== undefined) {
      profileUpdate.averageResponseTimeMinutes = input.averageResponseTimeMinutes;
    }
    if (input.businessEmail !== undefined) {
      profileUpdate.businessEmail = input.businessEmail;
    }
    if (input.businessPhone !== undefined) {
      profileUpdate.businessPhone = input.businessPhone;
    }
    if (input.headline !== undefined) {
      profileUpdate.headline = input.headline;
    }
    if (input.ownerContactName !== undefined) {
      profileUpdate.ownerContactName = input.ownerContactName;
    }
    if (input.publicDescription !== undefined) {
      profileUpdate.publicDescription = input.publicDescription;
    }
    if (input.serviceStyles !== undefined) {
      profileUpdate.serviceStyles = input.serviceStyles;
    }
    if (input.socialLinks !== undefined) {
      profileUpdate.socialLinks = input.socialLinks;
    }
    if (input.websiteUrl !== undefined) {
      profileUpdate.websiteUrl = input.websiteUrl;
    }

    if (Object.keys(profileUpdate).length > 2) {
      await this.db.insert(vendorProfiles).values(profileUpdate).onConflictDoUpdate({
        set: profileUpdate,
        target: vendorProfiles.vendorId,
      });
    }

    return this.findVendorSetup(vendorId);
  }

  async upsertOperatingSettings(
    vendorId: string,
    input: Partial<ReplaceAvailabilityDto["settings"]>,
  ): Promise<VendorOperatingSettingsRow> {
    const updatedAt = now();
    const [settings] = await this.db
      .insert(vendorOperatingSettings)
      .values({
        defaultSetupMinutes: input.defaultSetupMinutes,
        defaultTravelBufferMinutes: input.defaultTravelBufferMinutes,
        maxDailyBookings: input.maxDailyBookings,
        minimumGuestCount: input.minimumGuestCount,
        minimumLeadTimeDays: input.minimumLeadTimeDays,
        quoteResponseTargetHours: input.quoteResponseTargetHours,
        requestAnywayOnBlackout: input.requestAnywayOnBlackout,
        timezone: input.timezone,
        travelRadiusMiles: input.travelRadiusMiles,
        updatedAt,
        vendorId,
      })
      .onConflictDoUpdate({
        set: {
          defaultSetupMinutes: input.defaultSetupMinutes,
          defaultTravelBufferMinutes: input.defaultTravelBufferMinutes,
          maxDailyBookings: input.maxDailyBookings,
          minimumGuestCount: input.minimumGuestCount,
          minimumLeadTimeDays: input.minimumLeadTimeDays,
          quoteResponseTargetHours: input.quoteResponseTargetHours,
          requestAnywayOnBlackout: input.requestAnywayOnBlackout,
          timezone: input.timezone,
          travelRadiusMiles: input.travelRadiusMiles,
          updatedAt,
        },
        target: vendorOperatingSettings.vendorId,
      })
      .returning();

    return requireReturnedRow(settings);
  }

  async createMembership(
    input: Pick<NewVendorMembership, "role" | "status" | "userId" | "vendorId">,
  ): Promise<VendorMembership> {
    const [membership] = await this.db.insert(vendorMemberships).values(input).returning();
    return requireReturnedRow(membership);
  }

  async listMemberships(vendorId: string): Promise<VendorMembership[]> {
    return this.db
      .select()
      .from(vendorMemberships)
      .where(eq(vendorMemberships.vendorId, vendorId))
      .orderBy(asc(vendorMemberships.createdAt));
  }

  async findMembershipById(
    vendorId: string,
    membershipId: string,
  ): Promise<VendorMembership | null> {
    const [membership] = await this.db
      .select()
      .from(vendorMemberships)
      .where(and(eq(vendorMemberships.vendorId, vendorId), eq(vendorMemberships.id, membershipId)))
      .limit(1);

    return membership ?? null;
  }

  async listActiveOwnerMemberships(vendorId: string): Promise<VendorMembership[]> {
    return this.db
      .select()
      .from(vendorMemberships)
      .where(
        and(
          eq(vendorMemberships.vendorId, vendorId),
          eq(vendorMemberships.role, "owner"),
          eq(vendorMemberships.status, "active"),
        ),
      );
  }

  async updateMembership(
    vendorId: string,
    membershipId: string,
    input: Partial<Pick<VendorMembership, "role" | "status">>,
  ): Promise<VendorMembership | null> {
    const [membership] = await this.db
      .update(vendorMemberships)
      .set({
        ...input,
        updatedAt: now(),
      })
      .where(and(eq(vendorMemberships.vendorId, vendorId), eq(vendorMemberships.id, membershipId)))
      .returning();

    return membership ?? null;
  }

  async deleteMembership(vendorId: string, membershipId: string): Promise<VendorMembership | null> {
    return this.updateMembership(vendorId, membershipId, { status: "removed" });
  }

  async listCuisines(): Promise<CuisineRow[]> {
    return this.db.select().from(cuisines).orderBy(asc(cuisines.name));
  }

  async findCuisineById(cuisineId: string): Promise<CuisineRow | null> {
    const [cuisine] = await this.db.select().from(cuisines).where(eq(cuisines.id, cuisineId));
    return cuisine ?? null;
  }

  async findCuisinesByIds(cuisineIds: string[]): Promise<CuisineRow[]> {
    if (cuisineIds.length === 0) {
      return [];
    }

    return this.db.select().from(cuisines).where(inArray(cuisines.id, cuisineIds));
  }

  async createCuisine(input: CreateCuisineDto): Promise<CuisineRow> {
    const [cuisine] = await this.db.insert(cuisines).values(input).returning();
    return requireReturnedRow(cuisine);
  }

  async updateCuisine(cuisineId: string, input: UpdateCuisineDto): Promise<CuisineRow | null> {
    const [cuisine] = await this.db
      .update(cuisines)
      .set(input)
      .where(eq(cuisines.id, cuisineId))
      .returning();

    return cuisine ?? null;
  }

  async replaceVendorCuisines(vendorId: string, cuisineIds: string[]): Promise<CuisineRow[]> {
    await this.db.delete(vendorCuisines).where(eq(vendorCuisines.vendorId, vendorId));

    if (cuisineIds.length > 0) {
      await this.db
        .insert(vendorCuisines)
        .values(cuisineIds.map((cuisineId) => ({ cuisineId, vendorId })));
    }

    return this.findCuisinesByIds(cuisineIds);
  }

  async replaceServiceAreas(
    vendorId: string,
    input: ReplaceServiceAreasDto,
  ): Promise<VendorServiceAreaRow[]> {
    await this.db.delete(vendorServiceAreas).where(eq(vendorServiceAreas.vendorId, vendorId));

    const inserted = await this.db
      .insert(vendorServiceAreas)
      .values(input.serviceAreas.map((area) => ({ ...area, vendorId })))
      .returning();

    return inserted;
  }

  async getAvailability(vendorId: string): Promise<AvailabilityRecord> {
    const [settings] = await this.db
      .select()
      .from(vendorOperatingSettings)
      .where(eq(vendorOperatingSettings.vendorId, vendorId))
      .limit(1);
    const rules = await this.db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.vendorId, vendorId))
      .orderBy(asc(availabilityRules.dayOfWeek), asc(availabilityRules.startsAtLocal));
    const exceptions = await this.db
      .select()
      .from(availabilityExceptions)
      .where(eq(availabilityExceptions.vendorId, vendorId))
      .orderBy(asc(availabilityExceptions.startsAt));

    return {
      exceptions,
      rules,
      settings: settings ?? null,
    };
  }

  async replaceAvailability(
    vendorId: string,
    input: ReplaceAvailabilityDto,
  ): Promise<AvailabilityRecord> {
    await this.upsertOperatingSettings(vendorId, input.settings);
    await this.db.delete(availabilityRules).where(eq(availabilityRules.vendorId, vendorId));
    await this.db
      .delete(availabilityExceptions)
      .where(eq(availabilityExceptions.vendorId, vendorId));

    if (input.rules.length > 0) {
      await this.db.insert(availabilityRules).values(
        input.rules.map((rule) => ({
          ...rule,
          vendorId,
        })),
      );
    }

    if (input.exceptions.length > 0) {
      await this.db.insert(availabilityExceptions).values(
        input.exceptions.map((exception) => ({
          ...exception,
          endsAt: new Date(exception.endsAt),
          startsAt: new Date(exception.startsAt),
          vendorId,
        })),
      );
    }

    return this.getAvailability(vendorId);
  }

  async createMenu(vendorId: string, input: CreateMenuDto): Promise<MenuDetailRecord> {
    const [menu] = await this.db
      .insert(vendorMenus)
      .values({
        description: input.description,
        dietaryTags: input.dietaryTags,
        isPublic: input.isPublic,
        maximumGuestCount: input.maximumGuestCount,
        minimumGuestCount: input.minimumGuestCount,
        name: input.name,
        prepLeadTimeHours: input.prepLeadTimeHours,
        seasonalEndDate: input.seasonalEndDate,
        seasonalStartDate: input.seasonalStartDate,
        serviceStyles: input.serviceStyles,
        status: input.status,
        vendorId,
      })
      .returning();
    const createdMenu = requireReturnedRow(menu);

    if (input.items.length > 0) {
      await this.db
        .insert(vendorMenuItems)
        .values(input.items.map((item) => ({ ...item, menuId: createdMenu.id, vendorId })));
    }

    if (input.packages.length > 0) {
      await this.db.insert(vendorMenuPackages).values(
        input.packages.map((menuPackage) => ({
          ...menuPackage,
          menuId: createdMenu.id,
          vendorId,
        })),
      );
    }

    const menuDetail = await this.findMenuDetail(vendorId, createdMenu.id);

    if (menuDetail === null) {
      throw new Error("Created menu could not be loaded.");
    }

    return menuDetail;
  }

  async listMenus(vendorId: string): Promise<MenuDetailRecord[]> {
    const menus = await this.db
      .select()
      .from(vendorMenus)
      .where(and(eq(vendorMenus.vendorId, vendorId), isNull(vendorMenus.deletedAt)))
      .orderBy(asc(vendorMenus.createdAt));

    return Promise.all(menus.map((menu) => this.findMenuDetail(vendorId, menu.id))).then(
      (details) => details.filter((detail): detail is MenuDetailRecord => detail !== null),
    );
  }

  async findMenuDetail(vendorId: string, menuId: string): Promise<MenuDetailRecord | null> {
    const [menu] = await this.db
      .select()
      .from(vendorMenus)
      .where(
        and(
          eq(vendorMenus.id, menuId),
          eq(vendorMenus.vendorId, vendorId),
          isNull(vendorMenus.deletedAt),
        ),
      )
      .limit(1);

    if (!menu) {
      return null;
    }

    const [items, packages] = await Promise.all([
      this.db
        .select()
        .from(vendorMenuItems)
        .where(
          and(
            eq(vendorMenuItems.menuId, menuId),
            eq(vendorMenuItems.vendorId, vendorId),
            isNull(vendorMenuItems.deletedAt),
          ),
        )
        .orderBy(asc(vendorMenuItems.sortOrder), asc(vendorMenuItems.createdAt)),
      this.db
        .select()
        .from(vendorMenuPackages)
        .where(
          and(
            eq(vendorMenuPackages.menuId, menuId),
            eq(vendorMenuPackages.vendorId, vendorId),
            isNull(vendorMenuPackages.deletedAt),
          ),
        )
        .orderBy(asc(vendorMenuPackages.sortOrder), asc(vendorMenuPackages.createdAt)),
    ]);

    return {
      items,
      menu,
      packages,
    };
  }

  async updateMenu(
    vendorId: string,
    menuId: string,
    input: UpdateMenuDto,
  ): Promise<MenuDetailRecord | null> {
    await this.db
      .update(vendorMenus)
      .set({
        ...input,
        updatedAt: now(),
      })
      .where(
        and(
          eq(vendorMenus.id, menuId),
          eq(vendorMenus.vendorId, vendorId),
          isNull(vendorMenus.deletedAt),
        ),
      );

    return this.findMenuDetail(vendorId, menuId);
  }

  async softDeleteMenu(
    vendorId: string,
    menuId: string,
    deletedAt: Date,
  ): Promise<MenuDetailRecord | null> {
    await this.db
      .update(vendorMenus)
      .set({
        deletedAt,
        status: "archived",
        updatedAt: deletedAt,
      })
      .where(
        and(
          eq(vendorMenus.id, menuId),
          eq(vendorMenus.vendorId, vendorId),
          isNull(vendorMenus.deletedAt),
        ),
      );

    return this.findMenuDetail(vendorId, menuId);
  }

  async createMenuItem(
    vendorId: string,
    menuId: string,
    input: CreateMenuItemDto,
  ): Promise<VendorMenuItemRow> {
    const [item] = await this.db
      .insert(vendorMenuItems)
      .values({
        ...input,
        menuId,
        vendorId,
      })
      .returning();

    return requireReturnedRow(item);
  }

  async updateMenuItem(
    vendorId: string,
    menuId: string,
    itemId: string,
    input: UpdateMenuItemDto,
  ): Promise<VendorMenuItemRow | null> {
    const [item] = await this.db
      .update(vendorMenuItems)
      .set({
        ...input,
        updatedAt: now(),
      })
      .where(
        and(
          eq(vendorMenuItems.id, itemId),
          eq(vendorMenuItems.menuId, menuId),
          eq(vendorMenuItems.vendorId, vendorId),
          isNull(vendorMenuItems.deletedAt),
        ),
      )
      .returning();

    return item ?? null;
  }

  async createMenuPackage(
    vendorId: string,
    menuId: string,
    input: CreateMenuPackageDto,
  ): Promise<VendorMenuPackageRow> {
    const [menuPackage] = await this.db
      .insert(vendorMenuPackages)
      .values({
        ...input,
        menuId,
        vendorId,
      })
      .returning();

    return requireReturnedRow(menuPackage);
  }

  async updateMenuPackage(
    vendorId: string,
    menuId: string,
    packageId: string,
    input: UpdateMenuPackageDto,
  ): Promise<VendorMenuPackageRow | null> {
    const [menuPackage] = await this.db
      .update(vendorMenuPackages)
      .set({
        ...input,
        updatedAt: now(),
      })
      .where(
        and(
          eq(vendorMenuPackages.id, packageId),
          eq(vendorMenuPackages.menuId, menuId),
          eq(vendorMenuPackages.vendorId, vendorId),
          isNull(vendorMenuPackages.deletedAt),
        ),
      )
      .returning();

    return menuPackage ?? null;
  }

  async findBillingSettingsByVendorId(vendorId: string): Promise<VendorBillingSettingsRow | null> {
    const [settings] = await this.db
      .select()
      .from(vendorBillingSettings)
      .where(eq(vendorBillingSettings.vendorId, vendorId))
      .limit(1);

    return settings ?? null;
  }

  async upsertBillingSettings(
    vendorId: string,
    input: Partial<UpdateBillingSettingsDto> = {},
  ): Promise<VendorBillingSettingsRow> {
    const updatedAt = now();
    const [settings] = await this.db
      .insert(vendorBillingSettings)
      .values({
        agreementFeeBasisPoints: input.agreementFeeBasisPoints,
        billingEmail: input.billingEmail,
        invoiceTermsDays: input.invoiceTermsDays,
        updatedAt,
        vendorId,
      })
      .onConflictDoUpdate({
        set: {
          agreementFeeBasisPoints: input.agreementFeeBasisPoints,
          billingEmail: input.billingEmail,
          invoiceTermsDays: input.invoiceTermsDays,
          updatedAt,
        },
        target: vendorBillingSettings.vendorId,
      })
      .returning();

    return requireReturnedRow(settings);
  }

  async updateBillingSettings(
    vendorId: string,
    input: UpdateBillingSettingsDto,
  ): Promise<VendorBillingSettingsRow> {
    return this.upsertBillingSettings(vendorId, input);
  }

  async findVendorSetup(vendorId: string): Promise<VendorSetupRecord | null> {
    const vendor = await this.findVendorById(vendorId);

    if (!vendor) {
      return null;
    }

    const [profile, memberships, cuisineRows, serviceAreas, operatingSettings, billingSettings] =
      await Promise.all([
        this.db
          .select()
          .from(vendorProfiles)
          .where(and(eq(vendorProfiles.vendorId, vendorId), isNull(vendorProfiles.deletedAt)))
          .limit(1),
        this.listMemberships(vendorId),
        this.db
          .select({
            createdAt: cuisines.createdAt,
            id: cuisines.id,
            isActive: cuisines.isActive,
            name: cuisines.name,
            slug: cuisines.slug,
          })
          .from(vendorCuisines)
          .innerJoin(cuisines, eq(vendorCuisines.cuisineId, cuisines.id))
          .where(eq(vendorCuisines.vendorId, vendorId))
          .orderBy(asc(cuisines.name)),
        this.db
          .select()
          .from(vendorServiceAreas)
          .where(eq(vendorServiceAreas.vendorId, vendorId))
          .orderBy(asc(vendorServiceAreas.metroArea), asc(vendorServiceAreas.city)),
        this.db
          .select()
          .from(vendorOperatingSettings)
          .where(eq(vendorOperatingSettings.vendorId, vendorId))
          .limit(1),
        this.findBillingSettingsByVendorId(vendorId),
      ]);

    return {
      billingSettings,
      cuisines: cuisineRows,
      memberships,
      operatingSettings: operatingSettings[0] ?? null,
      profile: profile[0] ?? null,
      serviceAreas,
      vendor,
    };
  }

  async transaction<T>(callback: (repo: VendorRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleVendorRepository(tx)));
    }

    return callback(this);
  }
}

export function createUnavailableVendorRepository(): VendorRepository {
  const unavailable = async () => {
    throw new Error("Vendor repository is unavailable because no database client was provided.");
  };

  return {
    createAuditLog: unavailable,
    createCuisine: unavailable,
    createMembership: unavailable,
    createMenu: unavailable,
    createMenuItem: unavailable,
    createMenuPackage: unavailable,
    createVendor: unavailable,
    deleteMembership: unavailable,
    findBillingSettingsByVendorId: unavailable,
    findCuisineById: unavailable,
    findCuisinesByIds: unavailable,
    findMenuDetail: unavailable,
    findMembershipById: unavailable,
    findVendorById: unavailable,
    findVendorSetup: unavailable,
    getAvailability: unavailable,
    listActiveOwnerMemberships: unavailable,
    listCuisines: unavailable,
    listMemberships: unavailable,
    listMenus: unavailable,
    replaceAvailability: unavailable,
    replaceServiceAreas: unavailable,
    replaceVendorCuisines: unavailable,
    softDeleteMenu: unavailable,
    softDeleteVendor: unavailable,
    transaction: async (callback) => callback(createUnavailableVendorRepository()),
    updateBillingSettings: unavailable,
    updateCuisine: unavailable,
    updateMembership: unavailable,
    updateMenu: unavailable,
    updateMenuItem: unavailable,
    updateMenuPackage: unavailable,
    updateVendorProfile: unavailable,
    upsertBillingSettings: unavailable,
    upsertOperatingSettings: unavailable,
    upsertProfile: unavailable,
  };
}
