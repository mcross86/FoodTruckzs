import type { cuisines } from "../../db/schema/index.js";
import type {
  MarketplaceRepository,
  PublicMenuRecord,
  PublicVendorRecord,
} from "../../modules/marketplace/marketplace.repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

type CuisineRow = typeof cuisines.$inferSelect;

export class InMemoryMarketplaceRepository implements MarketplaceRepository {
  constructor(private readonly vendorRepository: InMemoryVendorRepository) {}

  async listActiveCuisines(): Promise<CuisineRow[]> {
    return [...this.vendorRepository.cuisines.values()]
      .filter((cuisine) => cuisine.isActive)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async listPublicVendorRecords(): Promise<PublicVendorRecord[]> {
    const vendors = [...this.vendorRepository.vendors.values()]
      .filter(
        (vendor) =>
          vendor.deletedAt === null &&
          vendor.status === "active" &&
          vendor.approvalStatus === "approved" &&
          vendor.isPublished,
      )
      .sort((left, right) => left.businessName.localeCompare(right.businessName));

    return Promise.all(vendors.map((vendor) => this.loadPublicVendorRecord(vendor.id)));
  }

  async findPublicVendorRecordBySlug(vendorSlug: string): Promise<PublicVendorRecord | null> {
    const vendor = [...this.vendorRepository.vendors.values()].find(
      (candidate) =>
        candidate.slug === vendorSlug &&
        candidate.deletedAt === null &&
        candidate.status === "active" &&
        candidate.approvalStatus === "approved" &&
        candidate.isPublished,
    );

    if (!vendor) {
      return null;
    }

    return this.loadPublicVendorRecord(vendor.id);
  }

  private async loadPublicVendorRecord(vendorId: string): Promise<PublicVendorRecord> {
    const setup = await this.vendorRepository.findVendorSetup(vendorId);

    if (setup === null) {
      throw new Error("Expected public vendor setup to exist.");
    }

    return {
      cuisines: setup.cuisines.filter((cuisine) => cuisine.isActive),
      menus: this.publicMenusForVendor(vendorId),
      operatingSettings: setup.operatingSettings,
      profile: setup.profile,
      serviceAreas: setup.serviceAreas,
      vendor: setup.vendor,
    };
  }

  private publicMenusForVendor(vendorId: string): PublicMenuRecord[] {
    return [...this.vendorRepository.menus.values()]
      .filter(
        (menu) =>
          menu.vendorId === vendorId &&
          menu.deletedAt === null &&
          menu.status === "published" &&
          menu.isPublic,
      )
      .map((menu) => ({
        items: [...this.vendorRepository.menuItems.values()].filter(
          (item) =>
            item.vendorId === vendorId &&
            item.menuId === menu.id &&
            item.deletedAt === null &&
            item.status === "active" &&
            item.isAvailable,
        ),
        menu,
        packages: [...this.vendorRepository.menuPackages.values()].filter(
          (menuPackage) =>
            menuPackage.vendorId === vendorId &&
            menuPackage.menuId === menu.id &&
            menuPackage.deletedAt === null &&
            menuPackage.status === "active" &&
            menuPackage.isAvailable,
        ),
      }));
  }
}
