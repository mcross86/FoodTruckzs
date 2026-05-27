import { randomUUID } from "node:crypto";

import type { VendorRole } from "../auth/auth.types.js";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type {
  CreateCuisineDto,
  CreateMembershipDto,
  CreateMenuDto,
  CreateMenuItemDto,
  CreateMenuPackageDto,
  CreateVendorAccountDto,
  ReplaceAvailabilityDto,
  ReplaceServiceAreasDto,
  ReplaceVendorCuisinesDto,
  UpdateBillingSettingsDto,
  UpdateCuisineDto,
  UpdateMembershipDto,
  UpdateMenuDto,
  UpdateMenuItemDto,
  UpdateMenuPackageDto,
  UpdateVendorProfileDto,
} from "./vendors.dto.js";
import type { VendorRepository } from "./vendors.repository.js";

type Actor = Pick<RequestContext, "requestId" | "userId">;

export type VendorService = {
  createCuisine: (input: CreateCuisineDto) => Promise<unknown>;
  createMembership: (vendorId: string, input: CreateMembershipDto) => Promise<unknown>;
  createMenu: (vendorId: string, input: CreateMenuDto) => Promise<unknown>;
  createMenuItem: (vendorId: string, menuId: string, input: CreateMenuItemDto) => Promise<unknown>;
  createMenuPackage: (
    vendorId: string,
    menuId: string,
    input: CreateMenuPackageDto,
  ) => Promise<unknown>;
  createVendorAccount: (actor: Actor, input: CreateVendorAccountDto) => Promise<unknown>;
  deleteMembership: (vendorId: string, membershipId: string) => Promise<unknown>;
  deleteMenu: (vendorId: string, menuId: string) => Promise<unknown>;
  deleteVendorAccount: (vendorId: string) => Promise<unknown>;
  getAvailability: (vendorId: string) => Promise<unknown>;
  getBillingSettings: (vendorId: string) => Promise<unknown>;
  getMenu: (vendorId: string, menuId: string) => Promise<unknown>;
  getVendorProfile: (vendorId: string) => Promise<unknown>;
  listCuisines: () => Promise<unknown>;
  listMemberships: (vendorId: string) => Promise<unknown>;
  listMenus: (vendorId: string) => Promise<unknown>;
  replaceAvailability: (vendorId: string, input: ReplaceAvailabilityDto) => Promise<unknown>;
  replaceServiceAreas: (vendorId: string, input: ReplaceServiceAreasDto) => Promise<unknown>;
  replaceVendorCuisines: (vendorId: string, input: ReplaceVendorCuisinesDto) => Promise<unknown>;
  updateBillingSettings: (
    actor: RequestContext,
    vendorId: string,
    input: UpdateBillingSettingsDto,
  ) => Promise<unknown>;
  updateCuisine: (cuisineId: string, input: UpdateCuisineDto) => Promise<unknown>;
  updateMembership: (
    vendorId: string,
    membershipId: string,
    input: UpdateMembershipDto,
  ) => Promise<unknown>;
  updateMenu: (vendorId: string, menuId: string, input: UpdateMenuDto) => Promise<unknown>;
  updateMenuItem: (
    vendorId: string,
    menuId: string,
    itemId: string,
    input: UpdateMenuItemDto,
  ) => Promise<unknown>;
  updateMenuPackage: (
    vendorId: string,
    menuId: string,
    packageId: string,
    input: UpdateMenuPackageDto,
  ) => Promise<unknown>;
  updateVendorProfile: (vendorId: string, input: UpdateVendorProfileDto) => Promise<unknown>;
};

export type VendorServiceDeps = {
  repository: VendorRepository;
};

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return `${base || "vendor"}-${randomUUID().slice(0, 8)}`;
}

function assertVendorFound<T>(record: T | null): T {
  if (record === null) {
    throw new NotFoundError("Vendor resource was not found.");
  }

  return record;
}

function assertRequiredSetup(input: CreateVendorAccountDto): void {
  if (input.cateringMinimumCents === undefined) {
    throw new ValidationError("Catering minimum is required for vendor setup.");
  }

  if (input.cuisineIds.length === 0) {
    throw new ValidationError("At least one cuisine is required for vendor setup.");
  }

  if (input.serviceAreas.length === 0) {
    throw new ValidationError("At least one service area is required for vendor setup.");
  }

  if (input.serviceStyles.length === 0) {
    throw new ValidationError("At least one service style is required for vendor setup.");
  }
}

function assertGuestRange(minimum?: number, maximum?: number): void {
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new ValidationError("Minimum guest count cannot exceed maximum guest count.");
  }
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);

  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function assertAvailability(input: ReplaceAvailabilityDto): void {
  for (const rule of input.rules) {
    if (timeToMinutes(rule.startsAtLocal) >= timeToMinutes(rule.endsAtLocal)) {
      throw new ValidationError("Availability rule start time must be before end time.");
    }
  }

  for (const exception of input.exceptions) {
    if (new Date(exception.startsAt).getTime() >= new Date(exception.endsAt).getTime()) {
      throw new ValidationError("Availability exception start time must be before end time.");
    }
  }

  const rulesByDay = new Map<number, ReplaceAvailabilityDto["rules"]>();

  for (const rule of input.rules) {
    const rules = rulesByDay.get(rule.dayOfWeek) ?? [];
    rules.push(rule);
    rulesByDay.set(rule.dayOfWeek, rules);
  }

  for (const rules of rulesByDay.values()) {
    const sortedRules = [...rules].sort(
      (left, right) => timeToMinutes(left.startsAtLocal) - timeToMinutes(right.startsAtLocal),
    );

    for (let index = 1; index < sortedRules.length; index += 1) {
      const previousRule = sortedRules[index - 1]!;
      const currentRule = sortedRules[index]!;

      if (timeToMinutes(currentRule.startsAtLocal) < timeToMinutes(previousRule.endsAtLocal)) {
        throw new ConflictError("Availability windows cannot overlap for the same day.");
      }
    }
  }
}

function assertMenuInput(input: CreateMenuDto | UpdateMenuDto): void {
  assertGuestRange(input.minimumGuestCount, input.maximumGuestCount);

  if (
    input.seasonalStartDate !== undefined &&
    input.seasonalEndDate !== undefined &&
    input.seasonalStartDate > input.seasonalEndDate
  ) {
    throw new ValidationError("Seasonal start date cannot be after seasonal end date.");
  }
}

function assertPackageInput(input: CreateMenuPackageDto | UpdateMenuPackageDto): void {
  assertGuestRange(input.minimumGuestCount, input.maximumGuestCount);
}

async function assertVendorExists(repository: VendorRepository, vendorId: string): Promise<void> {
  assertVendorFound(await repository.findVendorById(vendorId));
}

async function assertCuisinesExist(
  repository: VendorRepository,
  cuisineIds: string[],
): Promise<void> {
  const cuisines = await repository.findCuisinesByIds(cuisineIds);
  const foundCuisineIds = new Set(cuisines.map((cuisine) => cuisine.id));
  const missingCuisineId = cuisineIds.find((cuisineId) => !foundCuisineIds.has(cuisineId));

  if (missingCuisineId) {
    throw new NotFoundError("Cuisine category was not found.");
  }
}

async function assertCanChangeMembership(
  repository: VendorRepository,
  vendorId: string,
  membershipId: string,
  nextRole?: VendorRole,
  nextStatus?: "active" | "invited" | "suspended" | "removed",
): Promise<void> {
  const membership = assertVendorFound(await repository.findMembershipById(vendorId, membershipId));

  if (membership.role !== "owner" || membership.status !== "active") {
    return;
  }

  const wouldStopBeingActiveOwner =
    (nextRole !== undefined && nextRole !== "owner") ||
    (nextStatus !== undefined && nextStatus !== "active");

  if (!wouldStopBeingActiveOwner) {
    return;
  }

  const activeOwners = await repository.listActiveOwnerMemberships(vendorId);

  if (activeOwners.length <= 1) {
    throw new BusinessRuleError("Vendor must keep at least one active owner.");
  }
}

export function createVendorService(deps: VendorServiceDeps): VendorService {
  const { repository } = deps;

  return {
    async createVendorAccount(actor, input) {
      if (!actor.userId) {
        throw new ValidationError("Authenticated user is required to create a vendor.");
      }

      assertRequiredSetup(input);
      await assertCuisinesExist(repository, input.cuisineIds);

      return repository.transaction(async (repo) => {
        const vendor = await repo.createVendor({
          businessName: input.businessName,
          cateringMinimumCents: input.cateringMinimumCents,
          description: input.description,
          pricingSummary: input.pricingSummary,
          primaryContactUserId: actor.userId,
          slug: slugify(input.businessName),
          status: "active",
        });

        await repo.createMembership({
          role: "owner",
          status: "active",
          userId: actor.userId!,
          vendorId: vendor.id,
        });
        await repo.upsertProfile(vendor.id, {
          averageResponseTimeMinutes: input.averageResponseTimeMinutes,
          businessEmail: input.businessEmail,
          businessLicenseMetadata: input.businessLicenseMetadata,
          businessPhone: input.businessPhone,
          headline: input.headline,
          insuranceMetadata: input.insuranceMetadata,
          ownerContactName: input.ownerContactName,
          publicDescription: input.profileDescription,
          serviceStyles: input.serviceStyles,
          socialLinks: input.socialLinks,
          websiteUrl: input.websiteUrl,
        });
        await repo.upsertOperatingSettings(vendor.id, {
          ...input.settings,
          minimumLeadTimeDays: input.settings?.minimumLeadTimeDays ?? 7,
          timezone: input.settings?.timezone ?? "America/New_York",
          travelRadiusMiles: input.settings?.travelRadiusMiles,
        });
        await repo.upsertBillingSettings(vendor.id);
        await repo.replaceVendorCuisines(vendor.id, input.cuisineIds);
        await repo.replaceServiceAreas(vendor.id, { serviceAreas: input.serviceAreas });

        return assertVendorFound(await repo.findVendorSetup(vendor.id));
      });
    },

    async getVendorProfile(vendorId) {
      return assertVendorFound(await repository.findVendorSetup(vendorId));
    },

    async updateVendorProfile(vendorId, input) {
      return assertVendorFound(await repository.updateVendorProfile(vendorId, input));
    },

    async deleteVendorAccount(vendorId) {
      return assertVendorFound(await repository.softDeleteVendor(vendorId, new Date()));
    },

    async listMemberships(vendorId) {
      await assertVendorExists(repository, vendorId);
      return repository.listMemberships(vendorId);
    },

    async createMembership(vendorId, input) {
      await assertVendorExists(repository, vendorId);

      return repository.createMembership({
        role: input.role,
        status: "active",
        userId: input.userId,
        vendorId,
      });
    },

    async updateMembership(vendorId, membershipId, input) {
      await assertCanChangeMembership(repository, vendorId, membershipId, input.role, input.status);
      return assertVendorFound(await repository.updateMembership(vendorId, membershipId, input));
    },

    async deleteMembership(vendorId, membershipId) {
      await assertCanChangeMembership(repository, vendorId, membershipId, undefined, "removed");
      return assertVendorFound(await repository.deleteMembership(vendorId, membershipId));
    },

    async listCuisines() {
      return repository.listCuisines();
    },

    async createCuisine(input) {
      return repository.createCuisine(input);
    },

    async updateCuisine(cuisineId, input) {
      return assertVendorFound(await repository.updateCuisine(cuisineId, input));
    },

    async replaceVendorCuisines(vendorId, input) {
      await assertVendorExists(repository, vendorId);
      await assertCuisinesExist(repository, input.cuisineIds);
      return repository.replaceVendorCuisines(vendorId, input.cuisineIds);
    },

    async replaceServiceAreas(vendorId, input) {
      await assertVendorExists(repository, vendorId);
      return repository.replaceServiceAreas(vendorId, input);
    },

    async getAvailability(vendorId) {
      await assertVendorExists(repository, vendorId);
      return repository.getAvailability(vendorId);
    },

    async replaceAvailability(vendorId, input) {
      await assertVendorExists(repository, vendorId);
      assertAvailability(input);
      return repository.replaceAvailability(vendorId, input);
    },

    async listMenus(vendorId) {
      await assertVendorExists(repository, vendorId);
      return repository.listMenus(vendorId);
    },

    async getMenu(vendorId, menuId) {
      return assertVendorFound(await repository.findMenuDetail(vendorId, menuId));
    },

    async createMenu(vendorId, input) {
      await assertVendorExists(repository, vendorId);
      assertMenuInput(input);

      if (input.items.length === 0 && input.packages.length === 0) {
        throw new ValidationError("Menu must include at least one item or package.");
      }

      return repository.createMenu(vendorId, input);
    },

    async updateMenu(vendorId, menuId, input) {
      assertMenuInput(input);
      return assertVendorFound(await repository.updateMenu(vendorId, menuId, input));
    },

    async deleteMenu(vendorId, menuId) {
      const existingMenu = assertVendorFound(await repository.findMenuDetail(vendorId, menuId));
      await repository.softDeleteMenu(vendorId, menuId, new Date());
      return existingMenu;
    },

    async createMenuItem(vendorId, menuId, input) {
      assertVendorFound(await repository.findMenuDetail(vendorId, menuId));
      return repository.createMenuItem(vendorId, menuId, input);
    },

    async updateMenuItem(vendorId, menuId, itemId, input) {
      return assertVendorFound(await repository.updateMenuItem(vendorId, menuId, itemId, input));
    },

    async createMenuPackage(vendorId, menuId, input) {
      assertVendorFound(await repository.findMenuDetail(vendorId, menuId));
      assertPackageInput(input);
      return repository.createMenuPackage(vendorId, menuId, input);
    },

    async updateMenuPackage(vendorId, menuId, packageId, input) {
      assertPackageInput(input);
      return assertVendorFound(
        await repository.updateMenuPackage(vendorId, menuId, packageId, input),
      );
    },

    async getBillingSettings(vendorId) {
      await assertVendorExists(repository, vendorId);
      return (
        (await repository.findBillingSettingsByVendorId(vendorId)) ??
        repository.upsertBillingSettings(vendorId)
      );
    },

    async updateBillingSettings(actor, vendorId, input) {
      await assertVendorExists(repository, vendorId);
      const previousSettings = await repository.findBillingSettingsByVendorId(vendorId);
      const settings = await repository.updateBillingSettings(vendorId, input);
      await repository.createAuditLog({
        action: "vendor_billing_settings.updated",
        actorRole: "platform_admin",
        actorUserId: actor.userId,
        entityId: vendorId,
        entityType: "vendor_billing_settings",
        newState: {
          agreementFeeBasisPoints: settings.agreementFeeBasisPoints,
          billingEmail: settings.billingEmail,
          invoiceTermsDays: settings.invoiceTermsDays,
        },
        previousState: previousSettings
          ? {
              agreementFeeBasisPoints: previousSettings.agreementFeeBasisPoints,
              billingEmail: previousSettings.billingEmail,
              invoiceTermsDays: previousSettings.invoiceTermsDays,
            }
          : null,
        requestId: actor.requestId,
        vendorId,
      });

      return settings;
    },
  };
}
