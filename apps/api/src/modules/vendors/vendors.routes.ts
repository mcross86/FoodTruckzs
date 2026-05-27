import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireGlobalRole } from "../../shared/auth/require-role.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  createCuisineSchema,
  createMembershipSchema,
  createMenuItemSchema,
  createMenuPackageSchema,
  createMenuSchema,
  createVendorAccountSchema,
  cuisineIdParamsSchema,
  membershipIdParamsSchema,
  menuIdParamsSchema,
  menuItemIdParamsSchema,
  menuPackageIdParamsSchema,
  replaceAvailabilitySchema,
  replaceServiceAreasSchema,
  replaceVendorCuisinesSchema,
  updateBillingSettingsSchema,
  updateCuisineSchema,
  updateMembershipSchema,
  updateMenuItemSchema,
  updateMenuPackageSchema,
  updateMenuSchema,
  updateVendorProfileSchema,
  vendorIdParamsSchema,
} from "./vendors.dto.js";
import type { VendorService } from "./vendors.service.js";

type VendorRouteDeps = {
  vendorService: VendorService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

const writeVendorRoles = ["owner", "manager"] as const;
const ownerRoles = ["owner"] as const;

export async function registerVendorRoutes(
  app: FastifyInstance,
  deps: VendorRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);
  const requireVendorRead = requireVendorMembership();
  const requireVendorWrite = requireVendorMembership({ allowedRoles: [...writeVendorRoles] });
  const requireVendorOwner = requireVendorMembership({ allowedRoles: [...ownerRoles] });
  const requirePlatformAdmin = requireGlobalRole(["platform_admin"]);

  app.post(
    "/api/v1/admin/cuisines",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request, reply) => {
      const dto = parseWithZod(createCuisineSchema, request.body);
      const cuisine = await deps.vendorService.createCuisine(dto);
      return reply.code(201).send(envelope(request.requestContext.requestId, cuisine));
    },
  );

  app.patch(
    "/api/v1/admin/cuisines/:cuisineId",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(cuisineIdParamsSchema, request.params);
      const dto = parseWithZod(updateCuisineSchema, request.body);
      const cuisine = await deps.vendorService.updateCuisine(params.cuisineId, dto);
      return envelope(request.requestContext.requestId, cuisine);
    },
  );

  app.post("/api/v1/vendors", { preHandler: authenticate }, async (request, reply) => {
    const dto = parseWithZod(createVendorAccountSchema, request.body);
    const setup = await deps.vendorService.createVendorAccount(request.requestContext, dto);
    return reply.code(201).send(envelope(request.requestContext.requestId, setup));
  });

  app.get(
    "/api/v1/vendors/:vendorId/profile",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const profile = await deps.vendorService.getVendorProfile(params.vendorId);
      return envelope(request.requestContext.requestId, profile);
    },
  );

  app.patch(
    "/api/v1/vendors/:vendorId/profile",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(updateVendorProfileSchema, request.body);
      const profile = await deps.vendorService.updateVendorProfile(params.vendorId, dto);
      return envelope(request.requestContext.requestId, profile);
    },
  );

  app.delete(
    "/api/v1/vendors/:vendorId",
    { preHandler: [authenticate, requireVendorOwner] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const vendor = await deps.vendorService.deleteVendorAccount(params.vendorId);
      return envelope(request.requestContext.requestId, vendor);
    },
  );

  app.get(
    "/api/v1/vendors/:vendorId/memberships",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const memberships = await deps.vendorService.listMemberships(params.vendorId);
      return envelope(request.requestContext.requestId, memberships);
    },
  );

  app.post(
    "/api/v1/vendors/:vendorId/memberships",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request, reply) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(createMembershipSchema, request.body);
      const membership = await deps.vendorService.createMembership(params.vendorId, dto);
      return reply.code(201).send(envelope(request.requestContext.requestId, membership));
    },
  );

  app.patch(
    "/api/v1/vendors/:vendorId/memberships/:membershipId",
    { preHandler: [authenticate, requireVendorOwner] },
    async (request) => {
      const params = parseWithZod(membershipIdParamsSchema, request.params);
      const dto = parseWithZod(updateMembershipSchema, request.body);
      const membership = await deps.vendorService.updateMembership(
        params.vendorId,
        params.membershipId,
        dto,
      );
      return envelope(request.requestContext.requestId, membership);
    },
  );

  app.delete(
    "/api/v1/vendors/:vendorId/memberships/:membershipId",
    { preHandler: [authenticate, requireVendorOwner] },
    async (request) => {
      const params = parseWithZod(membershipIdParamsSchema, request.params);
      const membership = await deps.vendorService.deleteMembership(
        params.vendorId,
        params.membershipId,
      );
      return envelope(request.requestContext.requestId, membership);
    },
  );

  app.put(
    "/api/v1/vendors/:vendorId/cuisines",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(replaceVendorCuisinesSchema, request.body);
      const cuisines = await deps.vendorService.replaceVendorCuisines(params.vendorId, dto);
      return envelope(request.requestContext.requestId, cuisines);
    },
  );

  app.put(
    "/api/v1/vendors/:vendorId/service-areas",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(replaceServiceAreasSchema, request.body);
      const serviceAreas = await deps.vendorService.replaceServiceAreas(params.vendorId, dto);
      return envelope(request.requestContext.requestId, serviceAreas);
    },
  );

  app.get(
    "/api/v1/vendors/:vendorId/availability",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const availability = await deps.vendorService.getAvailability(params.vendorId);
      return envelope(request.requestContext.requestId, availability);
    },
  );

  app.put(
    "/api/v1/vendors/:vendorId/availability",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(replaceAvailabilitySchema, request.body);
      const availability = await deps.vendorService.replaceAvailability(params.vendorId, dto);
      return envelope(request.requestContext.requestId, availability);
    },
  );

  app.get(
    "/api/v1/vendors/:vendorId/menus",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const menus = await deps.vendorService.listMenus(params.vendorId);
      return envelope(request.requestContext.requestId, menus);
    },
  );

  app.post(
    "/api/v1/vendors/:vendorId/menus",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request, reply) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(createMenuSchema, request.body);
      const menu = await deps.vendorService.createMenu(params.vendorId, dto);
      return reply.code(201).send(envelope(request.requestContext.requestId, menu));
    },
  );

  app.get(
    "/api/v1/vendors/:vendorId/menus/:menuId",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(menuIdParamsSchema, request.params);
      const menu = await deps.vendorService.getMenu(params.vendorId, params.menuId);
      return envelope(request.requestContext.requestId, menu);
    },
  );

  app.patch(
    "/api/v1/vendors/:vendorId/menus/:menuId",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(menuIdParamsSchema, request.params);
      const dto = parseWithZod(updateMenuSchema, request.body);
      const menu = await deps.vendorService.updateMenu(params.vendorId, params.menuId, dto);
      return envelope(request.requestContext.requestId, menu);
    },
  );

  app.delete(
    "/api/v1/vendors/:vendorId/menus/:menuId",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(menuIdParamsSchema, request.params);
      const menu = await deps.vendorService.deleteMenu(params.vendorId, params.menuId);
      return envelope(request.requestContext.requestId, menu);
    },
  );

  app.post(
    "/api/v1/vendors/:vendorId/menus/:menuId/items",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request, reply) => {
      const params = parseWithZod(menuIdParamsSchema, request.params);
      const dto = parseWithZod(createMenuItemSchema, request.body);
      const item = await deps.vendorService.createMenuItem(params.vendorId, params.menuId, dto);
      return reply.code(201).send(envelope(request.requestContext.requestId, item));
    },
  );

  app.patch(
    "/api/v1/vendors/:vendorId/menus/:menuId/items/:itemId",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(menuItemIdParamsSchema, request.params);
      const dto = parseWithZod(updateMenuItemSchema, request.body);
      const item = await deps.vendorService.updateMenuItem(
        params.vendorId,
        params.menuId,
        params.itemId,
        dto,
      );
      return envelope(request.requestContext.requestId, item);
    },
  );

  app.post(
    "/api/v1/vendors/:vendorId/menus/:menuId/packages",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request, reply) => {
      const params = parseWithZod(menuIdParamsSchema, request.params);
      const dto = parseWithZod(createMenuPackageSchema, request.body);
      const menuPackage = await deps.vendorService.createMenuPackage(
        params.vendorId,
        params.menuId,
        dto,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, menuPackage));
    },
  );

  app.patch(
    "/api/v1/vendors/:vendorId/menus/:menuId/packages/:packageId",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request) => {
      const params = parseWithZod(menuPackageIdParamsSchema, request.params);
      const dto = parseWithZod(updateMenuPackageSchema, request.body);
      const menuPackage = await deps.vendorService.updateMenuPackage(
        params.vendorId,
        params.menuId,
        params.packageId,
        dto,
      );
      return envelope(request.requestContext.requestId, menuPackage);
    },
  );

  app.get(
    "/api/v1/admin/vendors/:vendorId/billing-settings",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const billing = await deps.vendorService.getBillingSettings(params.vendorId);
      return envelope(request.requestContext.requestId, billing);
    },
  );

  app.patch(
    "/api/v1/admin/vendors/:vendorId/billing-settings",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(updateBillingSettingsSchema, request.body);
      const billing = await deps.vendorService.updateBillingSettings(
        request.requestContext,
        params.vendorId,
        dto,
      );
      return envelope(request.requestContext.requestId, billing);
    },
  );
}
