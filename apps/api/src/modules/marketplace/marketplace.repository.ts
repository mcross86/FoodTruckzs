import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  cuisines,
  vendorCuisines,
  vendorMenuItems,
  vendorMenuPackages,
  vendorMenus,
  vendorOperatingSettings,
  vendorProfiles,
  vendors,
  vendorServiceAreas,
  type Vendor,
} from "../../db/schema/index.js";

type CuisineRow = typeof cuisines.$inferSelect;
type VendorProfileRow = typeof vendorProfiles.$inferSelect;
type VendorServiceAreaRow = typeof vendorServiceAreas.$inferSelect;
type VendorOperatingSettingsRow = typeof vendorOperatingSettings.$inferSelect;
type VendorMenuRow = typeof vendorMenus.$inferSelect;
type VendorMenuItemRow = typeof vendorMenuItems.$inferSelect;
type VendorMenuPackageRow = typeof vendorMenuPackages.$inferSelect;

export type PublicMenuRecord = {
  items: VendorMenuItemRow[];
  menu: VendorMenuRow;
  packages: VendorMenuPackageRow[];
};

export type PublicVendorRecord = {
  cuisines: CuisineRow[];
  menus: PublicMenuRecord[];
  operatingSettings: VendorOperatingSettingsRow | null;
  profile: VendorProfileRow | null;
  serviceAreas: VendorServiceAreaRow[];
  vendor: Vendor;
};

export type MarketplaceRepository = {
  findPublicVendorRecordBySlug: (vendorSlug: string) => Promise<PublicVendorRecord | null>;
  listActiveCuisines: () => Promise<CuisineRow[]>;
  listPublicVendorRecords: () => Promise<PublicVendorRecord[]>;
};

function publicVendorVisibility() {
  return and(
    eq(vendors.status, "active"),
    eq(vendors.approvalStatus, "approved"),
    eq(vendors.isPublished, true),
    isNull(vendors.deletedAt),
  );
}

export class DrizzleMarketplaceRepository implements MarketplaceRepository {
  constructor(private readonly db: Database) {}

  async listActiveCuisines(): Promise<CuisineRow[]> {
    return this.db
      .select()
      .from(cuisines)
      .where(eq(cuisines.isActive, true))
      .orderBy(asc(cuisines.name));
  }

  async listPublicVendorRecords(): Promise<PublicVendorRecord[]> {
    const vendorRows = await this.db
      .select()
      .from(vendors)
      .where(publicVendorVisibility())
      .orderBy(asc(vendors.businessName));

    return Promise.all(vendorRows.map((vendor) => this.loadPublicVendorRecord(vendor)));
  }

  async findPublicVendorRecordBySlug(vendorSlug: string): Promise<PublicVendorRecord | null> {
    const [vendor] = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.slug, vendorSlug), publicVendorVisibility()))
      .limit(1);

    if (!vendor) {
      return null;
    }

    return this.loadPublicVendorRecord(vendor);
  }

  private async loadPublicVendorRecord(vendor: Vendor): Promise<PublicVendorRecord> {
    const [profile, cuisineRows, serviceAreas, operatingSettings, menus] = await Promise.all([
      this.db
        .select()
        .from(vendorProfiles)
        .where(and(eq(vendorProfiles.vendorId, vendor.id), isNull(vendorProfiles.deletedAt)))
        .limit(1),
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
        .where(and(eq(vendorCuisines.vendorId, vendor.id), eq(cuisines.isActive, true)))
        .orderBy(asc(cuisines.name)),
      this.db
        .select()
        .from(vendorServiceAreas)
        .where(eq(vendorServiceAreas.vendorId, vendor.id))
        .orderBy(asc(vendorServiceAreas.metroArea), asc(vendorServiceAreas.city)),
      this.db
        .select()
        .from(vendorOperatingSettings)
        .where(eq(vendorOperatingSettings.vendorId, vendor.id))
        .limit(1),
      this.loadPublicMenus(vendor.id),
    ]);

    return {
      cuisines: cuisineRows,
      menus,
      operatingSettings: operatingSettings[0] ?? null,
      profile: profile[0] ?? null,
      serviceAreas,
      vendor,
    };
  }

  private async loadPublicMenus(vendorId: string): Promise<PublicMenuRecord[]> {
    const menus = await this.db
      .select()
      .from(vendorMenus)
      .where(
        and(
          eq(vendorMenus.vendorId, vendorId),
          eq(vendorMenus.status, "published"),
          eq(vendorMenus.isPublic, true),
          isNull(vendorMenus.deletedAt),
        ),
      )
      .orderBy(asc(vendorMenus.createdAt));

    const menuIds = menus.map((menu) => menu.id);

    if (menuIds.length === 0) {
      return [];
    }

    const [items, packages] = await Promise.all([
      this.db
        .select()
        .from(vendorMenuItems)
        .where(
          and(
            eq(vendorMenuItems.vendorId, vendorId),
            inArray(vendorMenuItems.menuId, menuIds),
            eq(vendorMenuItems.status, "active"),
            eq(vendorMenuItems.isAvailable, true),
            isNull(vendorMenuItems.deletedAt),
          ),
        )
        .orderBy(asc(vendorMenuItems.sortOrder), asc(vendorMenuItems.createdAt)),
      this.db
        .select()
        .from(vendorMenuPackages)
        .where(
          and(
            eq(vendorMenuPackages.vendorId, vendorId),
            inArray(vendorMenuPackages.menuId, menuIds),
            eq(vendorMenuPackages.status, "active"),
            eq(vendorMenuPackages.isAvailable, true),
            isNull(vendorMenuPackages.deletedAt),
          ),
        )
        .orderBy(asc(vendorMenuPackages.sortOrder), asc(vendorMenuPackages.createdAt)),
    ]);

    return menus.map((menu) => ({
      items: items.filter((item) => item.menuId === menu.id),
      menu,
      packages: packages.filter((menuPackage) => menuPackage.menuId === menu.id),
    }));
  }
}

export function createUnavailableMarketplaceRepository(): MarketplaceRepository {
  const unavailable = async () => {
    throw new Error(
      "Marketplace repository is unavailable because no database client was provided.",
    );
  };

  return {
    findPublicVendorRecordBySlug: unavailable,
    listActiveCuisines: unavailable,
    listPublicVendorRecords: unavailable,
  };
}
