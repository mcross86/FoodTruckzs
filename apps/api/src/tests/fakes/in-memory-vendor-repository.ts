import { randomUUID } from "node:crypto";

import type {
  auditLogs,
  availabilityExceptions,
  availabilityRules,
  cuisines,
  vendorBillingSettings,
  vendorMenuItems,
  vendorMenuPackages,
  vendorMenus,
  vendorOperatingSettings,
  vendorProfiles,
  vendorServiceAreas,
  Vendor,
  VendorMembership,
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
} from "../../modules/vendors/vendors.dto.js";
import type {
  AvailabilityRecord,
  CreateVendorInput,
  MenuDetailRecord,
  VendorRepository,
  VendorSetupRecord,
} from "../../modules/vendors/vendors.repository.js";

type VendorProfileRow = typeof vendorProfiles.$inferSelect;
type AuditLogRow = typeof auditLogs.$inferSelect;
type VendorServiceAreaRow = typeof vendorServiceAreas.$inferSelect;
type CuisineRow = typeof cuisines.$inferSelect;
type VendorOperatingSettingsRow = typeof vendorOperatingSettings.$inferSelect;
type AvailabilityRuleRow = typeof availabilityRules.$inferSelect;
type AvailabilityExceptionRow = typeof availabilityExceptions.$inferSelect;
type VendorBillingSettingsRow = typeof vendorBillingSettings.$inferSelect;
type VendorMenuRow = typeof vendorMenus.$inferSelect;
type VendorMenuItemRow = typeof vendorMenuItems.$inferSelect;
type VendorMenuPackageRow = typeof vendorMenuPackages.$inferSelect;

function now(): Date {
  return new Date();
}

function requireMapValue<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected in-memory record to exist.");
  }

  return value;
}

export class InMemoryVendorRepository implements VendorRepository {
  readonly auditLogs = new Map<string, AuditLogRow>();
  readonly availabilityExceptions = new Map<string, AvailabilityExceptionRow>();
  readonly availabilityRules = new Map<string, AvailabilityRuleRow>();
  readonly billingSettings = new Map<string, VendorBillingSettingsRow>();
  readonly cuisines = new Map<string, CuisineRow>();
  readonly menuItems = new Map<string, VendorMenuItemRow>();
  readonly menuPackages = new Map<string, VendorMenuPackageRow>();
  readonly menus = new Map<string, VendorMenuRow>();
  readonly memberships = new Map<string, VendorMembership>();
  readonly operatingSettings = new Map<string, VendorOperatingSettingsRow>();
  readonly profiles = new Map<string, VendorProfileRow>();
  readonly serviceAreas = new Map<string, VendorServiceAreaRow>();
  readonly vendorCuisineIds = new Map<string, Set<string>>();
  readonly vendors = new Map<string, Vendor>();

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const auditLog: AuditLogRow = {
      action: input.action,
      actorRole: input.actorRole ?? null,
      actorUserId: input.actorUserId ?? null,
      createdAt: now(),
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      id: randomUUID(),
      ipAddress: input.ipAddress ?? null,
      newState: input.newState ?? null,
      previousState: input.previousState ?? null,
      requestId: input.requestId ?? null,
      userAgent: input.userAgent ?? null,
      vendorId: input.vendorId ?? null,
    };

    this.auditLogs.set(auditLog.id, auditLog);
    return auditLog;
  }

  async createVendor(input: CreateVendorInput): Promise<Vendor> {
    const createdAt = now();
    const vendor: Vendor = {
      approvalStatus: "pending",
      businessName: input.businessName,
      cateringMinimumCents: input.cateringMinimumCents ?? null,
      createdAt,
      deletedAt: null,
      description: input.description ?? null,
      id: randomUUID(),
      isPublished: false,
      pricingSummary: input.pricingSummary ?? null,
      primaryContactUserId: input.primaryContactUserId ?? null,
      slug: input.slug,
      status: input.status ?? "active",
      stripeConnectAccountId: null,
      stripeChargesEnabled: false,
      stripeDetailsSubmitted: false,
      stripeDisabledReason: null,
      stripePayoutsEnabled: false,
      updatedAt: createdAt,
    };

    this.vendors.set(vendor.id, vendor);
    return vendor;
  }

  async findVendorById(vendorId: string): Promise<Vendor | null> {
    const vendor = this.vendors.get(vendorId);
    return vendor && vendor.deletedAt === null ? vendor : null;
  }

  async softDeleteVendor(vendorId: string, deletedAt: Date): Promise<Vendor | null> {
    const vendor = this.vendors.get(vendorId);

    if (!vendor) {
      return null;
    }

    const updatedVendor: Vendor = {
      ...vendor,
      deletedAt,
      isPublished: false,
      status: "closed",
      updatedAt: deletedAt,
    };
    this.vendors.set(vendorId, updatedVendor);
    return updatedVendor;
  }

  async upsertProfile(
    vendorId: string,
    input: Parameters<VendorRepository["upsertProfile"]>[1],
  ): Promise<VendorProfileRow> {
    const createdAt = this.profiles.get(vendorId)?.createdAt ?? now();
    const profile: VendorProfileRow = {
      averageResponseTimeMinutes: input.averageResponseTimeMinutes ?? null,
      businessEmail: input.businessEmail ?? null,
      businessLicenseMetadata: input.businessLicenseMetadata ?? {},
      businessPhone: input.businessPhone ?? null,
      coverImageFileId: null,
      createdAt,
      deletedAt: null,
      dietaryAccommodations: input.dietaryAccommodations ?? [],
      galleryFileIds: [],
      headline: input.headline ?? null,
      insuranceMetadata: input.insuranceMetadata ?? {},
      operationalHours: {},
      ownerContactName: input.ownerContactName ?? null,
      publicDescription: input.publicDescription ?? null,
      serviceStyles: input.serviceStyles ?? [],
      socialLinks: input.socialLinks ?? {},
      updatedAt: now(),
      vendorId,
      websiteUrl: input.websiteUrl ?? null,
    };

    this.profiles.set(vendorId, profile);
    return profile;
  }

  async updateVendorProfile(
    vendorId: string,
    input: UpdateVendorProfileDto,
  ): Promise<VendorSetupRecord | null> {
    const vendor = this.vendors.get(vendorId);

    if (!vendor) {
      return null;
    }

    this.vendors.set(vendorId, {
      ...vendor,
      businessName: input.businessName ?? vendor.businessName,
      cateringMinimumCents: input.cateringMinimumCents ?? vendor.cateringMinimumCents,
      isPublished: input.isPublished ?? vendor.isPublished,
      pricingSummary: input.pricingSummary ?? vendor.pricingSummary,
      updatedAt: now(),
    });

    const existingProfile = this.profiles.get(vendorId);

    if (existingProfile) {
      this.profiles.set(vendorId, {
        ...existingProfile,
        averageResponseTimeMinutes:
          input.averageResponseTimeMinutes ?? existingProfile.averageResponseTimeMinutes,
        businessEmail: input.businessEmail ?? existingProfile.businessEmail,
        businessPhone: input.businessPhone ?? existingProfile.businessPhone,
        dietaryAccommodations: input.dietaryAccommodations ?? existingProfile.dietaryAccommodations,
        headline: input.headline ?? existingProfile.headline,
        ownerContactName: input.ownerContactName ?? existingProfile.ownerContactName,
        publicDescription: input.publicDescription ?? existingProfile.publicDescription,
        serviceStyles: input.serviceStyles ?? existingProfile.serviceStyles,
        socialLinks: input.socialLinks ?? existingProfile.socialLinks,
        updatedAt: now(),
        websiteUrl: input.websiteUrl ?? existingProfile.websiteUrl,
      });
    }

    return this.findVendorSetup(vendorId);
  }

  async upsertOperatingSettings(
    vendorId: string,
    input: Partial<ReplaceAvailabilityDto["settings"]>,
  ): Promise<VendorOperatingSettingsRow> {
    const existing = this.operatingSettings.get(vendorId);
    const settings: VendorOperatingSettingsRow = {
      createdAt: existing?.createdAt ?? now(),
      defaultSetupMinutes: input.defaultSetupMinutes ?? existing?.defaultSetupMinutes ?? 60,
      defaultTravelBufferMinutes:
        input.defaultTravelBufferMinutes ?? existing?.defaultTravelBufferMinutes ?? 30,
      maxDailyBookings: input.maxDailyBookings ?? existing?.maxDailyBookings ?? null,
      minimumGuestCount: input.minimumGuestCount ?? existing?.minimumGuestCount ?? null,
      minimumLeadTimeDays: input.minimumLeadTimeDays ?? existing?.minimumLeadTimeDays ?? 7,
      quoteResponseTargetHours:
        input.quoteResponseTargetHours ?? existing?.quoteResponseTargetHours ?? null,
      requestAnywayOnBlackout:
        input.requestAnywayOnBlackout ?? existing?.requestAnywayOnBlackout ?? false,
      timezone: input.timezone ?? existing?.timezone ?? "America/New_York",
      travelRadiusMiles: input.travelRadiusMiles ?? existing?.travelRadiusMiles ?? null,
      updatedAt: now(),
      vendorId,
    };

    this.operatingSettings.set(vendorId, settings);
    return settings;
  }

  async createMembership(input: {
    role: VendorMembership["role"];
    status?: VendorMembership["status"];
    userId: string;
    vendorId: string;
  }): Promise<VendorMembership> {
    const createdAt = now();
    const membership: VendorMembership = {
      createdAt,
      id: randomUUID(),
      invitedByUserId: null,
      role: input.role,
      status: input.status ?? "invited",
      updatedAt: createdAt,
      userId: input.userId,
      vendorId: input.vendorId,
    };

    this.memberships.set(membership.id, membership);
    return membership;
  }

  async listMemberships(vendorId: string): Promise<VendorMembership[]> {
    return [...this.memberships.values()].filter((membership) => membership.vendorId === vendorId);
  }

  async findMembershipById(
    vendorId: string,
    membershipId: string,
  ): Promise<VendorMembership | null> {
    const membership = this.memberships.get(membershipId);
    return membership?.vendorId === vendorId ? membership : null;
  }

  async listActiveOwnerMemberships(vendorId: string): Promise<VendorMembership[]> {
    return [...this.memberships.values()].filter(
      (membership) =>
        membership.vendorId === vendorId &&
        membership.role === "owner" &&
        membership.status === "active",
    );
  }

  async updateMembership(
    vendorId: string,
    membershipId: string,
    input: Partial<Pick<VendorMembership, "role" | "status">>,
  ): Promise<VendorMembership | null> {
    const membership = await this.findMembershipById(vendorId, membershipId);

    if (!membership) {
      return null;
    }

    const updatedMembership = {
      ...membership,
      ...input,
      updatedAt: now(),
    };
    this.memberships.set(membershipId, updatedMembership);
    return updatedMembership;
  }

  async deleteMembership(vendorId: string, membershipId: string): Promise<VendorMembership | null> {
    return this.updateMembership(vendorId, membershipId, { status: "removed" });
  }

  async listCuisines(): Promise<CuisineRow[]> {
    return [...this.cuisines.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async findCuisineById(cuisineId: string): Promise<CuisineRow | null> {
    return this.cuisines.get(cuisineId) ?? null;
  }

  async findCuisinesByIds(cuisineIds: string[]): Promise<CuisineRow[]> {
    return cuisineIds
      .map((cuisineId) => this.cuisines.get(cuisineId))
      .filter((cuisine): cuisine is CuisineRow => cuisine !== undefined);
  }

  async createCuisine(input: CreateCuisineDto): Promise<CuisineRow> {
    const cuisine: CuisineRow = {
      createdAt: now(),
      id: randomUUID(),
      isActive: input.isActive,
      name: input.name,
      slug: input.slug,
    };

    this.cuisines.set(cuisine.id, cuisine);
    return cuisine;
  }

  async updateCuisine(cuisineId: string, input: UpdateCuisineDto): Promise<CuisineRow | null> {
    const cuisine = this.cuisines.get(cuisineId);

    if (!cuisine) {
      return null;
    }

    const updatedCuisine = {
      ...cuisine,
      ...input,
    };
    this.cuisines.set(cuisineId, updatedCuisine);
    return updatedCuisine;
  }

  async replaceVendorCuisines(vendorId: string, cuisineIds: string[]): Promise<CuisineRow[]> {
    const vendor = requireMapValue(this.vendors.get(vendorId));
    this.vendorCuisineIds.set(vendorId, new Set(cuisineIds));
    this.vendors.set(vendorId, {
      ...vendor,
      updatedAt: now(),
    });
    return this.findCuisinesByIds(cuisineIds);
  }

  async replaceServiceAreas(
    vendorId: string,
    input: ReplaceServiceAreasDto,
  ): Promise<VendorServiceAreaRow[]> {
    for (const [id, area] of this.serviceAreas) {
      if (area.vendorId === vendorId) {
        this.serviceAreas.delete(id);
      }
    }

    const rows = input.serviceAreas.map((area): VendorServiceAreaRow => {
      const row = {
        city: area.city ?? null,
        createdAt: now(),
        id: randomUUID(),
        metroArea: area.metroArea,
        postalCode: area.postalCode ?? null,
        radiusMiles: area.radiusMiles ?? null,
        state: area.state,
        vendorId,
      };
      this.serviceAreas.set(row.id, row);
      return row;
    });

    return rows;
  }

  async getAvailability(vendorId: string): Promise<AvailabilityRecord> {
    return {
      exceptions: [...this.availabilityExceptions.values()].filter(
        (exception) => exception.vendorId === vendorId,
      ),
      rules: [...this.availabilityRules.values()].filter((rule) => rule.vendorId === vendorId),
      settings: this.operatingSettings.get(vendorId) ?? null,
    };
  }

  async replaceAvailability(
    vendorId: string,
    input: ReplaceAvailabilityDto,
  ): Promise<AvailabilityRecord> {
    await this.upsertOperatingSettings(vendorId, input.settings);

    for (const [id, rule] of this.availabilityRules) {
      if (rule.vendorId === vendorId) {
        this.availabilityRules.delete(id);
      }
    }

    for (const [id, exception] of this.availabilityExceptions) {
      if (exception.vendorId === vendorId) {
        this.availabilityExceptions.delete(id);
      }
    }

    for (const rule of input.rules) {
      const id = randomUUID();
      this.availabilityRules.set(id, {
        ...rule,
        createdAt: now(),
        effectiveEndDate: rule.effectiveEndDate ?? null,
        effectiveStartDate: rule.effectiveStartDate ?? null,
        id,
        updatedAt: now(),
        vendorId,
      });
    }

    for (const exception of input.exceptions) {
      const id = randomUUID();
      this.availabilityExceptions.set(id, {
        ...exception,
        capacityLimit: exception.capacityLimit ?? null,
        createdAt: now(),
        endsAt: new Date(exception.endsAt),
        id,
        reason: exception.reason ?? null,
        startsAt: new Date(exception.startsAt),
        updatedAt: now(),
        vendorId,
      });
    }

    return this.getAvailability(vendorId);
  }

  async createMenu(vendorId: string, input: CreateMenuDto): Promise<MenuDetailRecord> {
    const createdAt = now();
    const menu: VendorMenuRow = {
      createdAt,
      deletedAt: null,
      description: input.description ?? null,
      dietaryTags: input.dietaryTags,
      id: randomUUID(),
      isPublic: input.isPublic,
      maximumGuestCount: input.maximumGuestCount ?? null,
      minimumGuestCount: input.minimumGuestCount ?? null,
      name: input.name,
      prepLeadTimeHours: input.prepLeadTimeHours ?? null,
      seasonalEndDate: input.seasonalEndDate ?? null,
      seasonalStartDate: input.seasonalStartDate ?? null,
      serviceStyles: input.serviceStyles,
      status: input.status,
      updatedAt: createdAt,
      vendorId,
    };

    this.menus.set(menu.id, menu);

    for (const item of input.items) {
      await this.createMenuItem(vendorId, menu.id, item);
    }

    for (const menuPackage of input.packages) {
      await this.createMenuPackage(vendorId, menu.id, menuPackage);
    }

    const menuDetail = await this.findMenuDetail(vendorId, menu.id);

    if (menuDetail === null) {
      throw new Error("Created menu could not be loaded.");
    }

    return menuDetail;
  }

  async listMenus(vendorId: string): Promise<MenuDetailRecord[]> {
    return Promise.all(
      [...this.menus.values()]
        .filter((menu) => menu.vendorId === vendorId && menu.deletedAt === null)
        .map((menu) => this.findMenuDetail(vendorId, menu.id)),
    ).then((details) => details.filter((detail): detail is MenuDetailRecord => detail !== null));
  }

  async findMenuDetail(vendorId: string, menuId: string): Promise<MenuDetailRecord | null> {
    const menu = this.menus.get(menuId);

    if (!menu || menu.vendorId !== vendorId || menu.deletedAt !== null) {
      return null;
    }

    return {
      items: [...this.menuItems.values()].filter(
        (item) => item.vendorId === vendorId && item.menuId === menuId && item.deletedAt === null,
      ),
      menu,
      packages: [...this.menuPackages.values()].filter(
        (menuPackage) =>
          menuPackage.vendorId === vendorId &&
          menuPackage.menuId === menuId &&
          menuPackage.deletedAt === null,
      ),
    };
  }

  async updateMenu(
    vendorId: string,
    menuId: string,
    input: UpdateMenuDto,
  ): Promise<MenuDetailRecord | null> {
    const menu = this.menus.get(menuId);

    if (!menu || menu.vendorId !== vendorId) {
      return null;
    }

    this.menus.set(menuId, {
      ...menu,
      ...input,
      updatedAt: now(),
    });
    return this.findMenuDetail(vendorId, menuId);
  }

  async softDeleteMenu(
    vendorId: string,
    menuId: string,
    deletedAt: Date,
  ): Promise<MenuDetailRecord | null> {
    const existing = await this.findMenuDetail(vendorId, menuId);
    const menu = this.menus.get(menuId);

    if (!menu || !existing) {
      return null;
    }

    this.menus.set(menuId, {
      ...menu,
      deletedAt,
      status: "archived",
      updatedAt: deletedAt,
    });
    return existing;
  }

  async createMenuItem(
    vendorId: string,
    menuId: string,
    input: CreateMenuItemDto,
  ): Promise<VendorMenuItemRow> {
    const item: VendorMenuItemRow = {
      category: input.category ?? null,
      createdAt: now(),
      deletedAt: null,
      description: input.description ?? null,
      dietaryTags: input.dietaryTags,
      id: randomUUID(),
      isAvailable: input.isAvailable,
      menuId,
      name: input.name,
      priceCents: input.priceCents ?? null,
      sortOrder: input.sortOrder,
      status: "active",
      updatedAt: now(),
      vendorId,
    };

    this.menuItems.set(item.id, item);
    return item;
  }

  async updateMenuItem(
    vendorId: string,
    menuId: string,
    itemId: string,
    input: UpdateMenuItemDto,
  ): Promise<VendorMenuItemRow | null> {
    const item = this.menuItems.get(itemId);

    if (!item || item.vendorId !== vendorId || item.menuId !== menuId) {
      return null;
    }

    const updatedItem = {
      ...item,
      ...input,
      updatedAt: now(),
    };
    this.menuItems.set(itemId, updatedItem);
    return updatedItem;
  }

  async createMenuPackage(
    vendorId: string,
    menuId: string,
    input: CreateMenuPackageDto,
  ): Promise<VendorMenuPackageRow> {
    const menuPackage: VendorMenuPackageRow = {
      createdAt: now(),
      deletedAt: null,
      description: input.description ?? null,
      dietaryTags: input.dietaryTags,
      id: randomUUID(),
      includedItemIds: input.includedItemIds,
      isAvailable: input.isAvailable,
      maximumGuestCount: input.maximumGuestCount ?? null,
      menuId,
      minimumGuestCount: input.minimumGuestCount ?? null,
      name: input.name,
      priceCents: input.priceCents ?? null,
      pricingModel: input.pricingModel,
      sortOrder: input.sortOrder,
      status: "active",
      updatedAt: now(),
      vendorId,
    };

    this.menuPackages.set(menuPackage.id, menuPackage);
    return menuPackage;
  }

  async updateMenuPackage(
    vendorId: string,
    menuId: string,
    packageId: string,
    input: UpdateMenuPackageDto,
  ): Promise<VendorMenuPackageRow | null> {
    const menuPackage = this.menuPackages.get(packageId);

    if (!menuPackage || menuPackage.vendorId !== vendorId || menuPackage.menuId !== menuId) {
      return null;
    }

    const updatedPackage = {
      ...menuPackage,
      ...input,
      updatedAt: now(),
    };
    this.menuPackages.set(packageId, updatedPackage);
    return updatedPackage;
  }

  async findBillingSettingsByVendorId(vendorId: string): Promise<VendorBillingSettingsRow | null> {
    return this.billingSettings.get(vendorId) ?? null;
  }

  async upsertBillingSettings(
    vendorId: string,
    input: Partial<UpdateBillingSettingsDto> = {},
  ): Promise<VendorBillingSettingsRow> {
    const existing = this.billingSettings.get(vendorId);
    const settings: VendorBillingSettingsRow = {
      agreementFeeBasisPoints:
        input.agreementFeeBasisPoints ?? existing?.agreementFeeBasisPoints ?? 0,
      billingEmail: input.billingEmail ?? existing?.billingEmail ?? null,
      createdAt: existing?.createdAt ?? now(),
      invoiceTermsDays: input.invoiceTermsDays ?? existing?.invoiceTermsDays ?? 30,
      updatedAt: now(),
      vendorId,
    };

    this.billingSettings.set(vendorId, settings);
    return settings;
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

    return {
      billingSettings: await this.findBillingSettingsByVendorId(vendorId),
      cuisines: [...(this.vendorCuisineIds.get(vendorId) ?? new Set<string>())]
        .map((cuisineId) => this.cuisines.get(cuisineId))
        .filter((cuisine): cuisine is CuisineRow => cuisine !== undefined),
      memberships: await this.listMemberships(vendorId),
      operatingSettings: this.operatingSettings.get(vendorId) ?? null,
      profile: this.profiles.get(vendorId) ?? null,
      serviceAreas: [...this.serviceAreas.values()].filter((area) => area.vendorId === vendorId),
      vendor,
    };
  }

  async transaction<T>(callback: (repo: VendorRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }
}
