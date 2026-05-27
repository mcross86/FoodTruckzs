import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance } from "fastify";

import type { ApiEnv } from "./config/env.js";
import { readApiEnv } from "./config/env.js";
import { createLoggerOptions } from "./config/logger.js";
import { createDatabaseClient, type DatabaseClient } from "./db/client.js";
import {
  createUnavailableAuthRepository,
  DrizzleAuthRepository,
  type AuthRepository,
} from "./modules/auth/auth.repository.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { createAuthService, type AuthService } from "./modules/auth/auth.service.js";
import { createPasswordService } from "./modules/auth/password.service.js";
import { createTokenService } from "./modules/auth/token.service.js";
import {
  createUnavailableAgreementRepository,
  DrizzleAgreementRepository,
  type AgreementRepository,
} from "./modules/agreements/agreements.repository.js";
import { registerAgreementRoutes } from "./modules/agreements/agreements.routes.js";
import {
  createAgreementService,
  type AgreementService,
} from "./modules/agreements/agreements.service.js";
import {
  createUnavailableAdminRepository,
  DrizzleAdminRepository,
  type AdminRepository,
} from "./modules/admin/admin.repository.js";
import { registerAdminRoutes } from "./modules/admin/admin.routes.js";
import { createAdminService, type AdminService } from "./modules/admin/admin.service.js";
import {
  createUnavailableBillingRepository,
  DrizzleBillingRepository,
  type BillingRepository,
} from "./modules/billing/billing.repository.js";
import { registerBillingRoutes } from "./modules/billing/billing.routes.js";
import { createBillingService, type BillingService } from "./modules/billing/billing.service.js";
import {
  createUnavailableMarketplaceRepository,
  DrizzleMarketplaceRepository,
  type MarketplaceRepository,
} from "./modules/marketplace/marketplace.repository.js";
import { registerMarketplaceRoutes } from "./modules/marketplace/marketplace.routes.js";
import {
  createMarketplaceService,
  type MarketplaceService,
} from "./modules/marketplace/marketplace.service.js";
import { createDevelopmentEmailProvider } from "./modules/notifications/email-provider.js";
import {
  createUnavailableNotificationRepository,
  DrizzleNotificationRepository,
  type NotificationRepository,
} from "./modules/notifications/notifications.repository.js";
import { registerNotificationRoutes } from "./modules/notifications/notifications.routes.js";
import {
  createNotificationService,
  type NotificationService,
} from "./modules/notifications/notifications.service.js";
import {
  createUnavailablePaymentRepository,
  DrizzlePaymentRepository,
  type PaymentRepository,
} from "./modules/payments/payments.repository.js";
import { registerPaymentRoutes } from "./modules/payments/payments.routes.js";
import { createPaymentService, type PaymentService } from "./modules/payments/payments.service.js";
import {
  createUnavailableRfqRepository,
  DrizzleRfqRepository,
  type RfqRepository,
} from "./modules/rfqs/rfqs.repository.js";
import { registerRfqRoutes } from "./modules/rfqs/rfqs.routes.js";
import { createRfqService, type RfqService } from "./modules/rfqs/rfqs.service.js";
import {
  createUnavailableSchedulingRepository,
  DrizzleSchedulingRepository,
  type SchedulingRepository,
} from "./modules/scheduling/scheduling.repository.js";
import { registerSchedulingRoutes } from "./modules/scheduling/scheduling.routes.js";
import {
  createSchedulingService,
  type SchedulingService,
} from "./modules/scheduling/scheduling.service.js";
import {
  createUnavailableQuoteRepository,
  DrizzleQuoteRepository,
  type QuoteRepository,
} from "./modules/quotes/quotes.repository.js";
import { registerQuoteRoutes } from "./modules/quotes/quotes.routes.js";
import { createQuoteService, type QuoteService } from "./modules/quotes/quotes.service.js";
import {
  createUnavailableVendorRepository,
  DrizzleVendorRepository,
  type VendorRepository,
} from "./modules/vendors/vendors.repository.js";
import { registerVendorRoutes } from "./modules/vendors/vendors.routes.js";
import { createVendorService, type VendorService } from "./modules/vendors/vendors.service.js";
import { registerHealthRoutes } from "./routes/health.js";
import { createErrorHandler } from "./shared/errors/error-handler.js";
import { createRateLimiters, type ApiRateLimiters } from "./shared/middleware/rate-limit.js";
import { createRequestId, registerRequestContext } from "./shared/middleware/request-context.js";
import {
  createStripeClient,
  createUnavailableStripeClient,
  type StripeClient,
} from "./shared/stripe/stripe-client.js";
import { createLocalStorageAdapter } from "./shared/storage/local-storage.adapter.js";
import { createS3CompatibleStorageAdapter } from "./shared/storage/s3-compatible.adapter.js";
import type { StorageAdapter } from "./shared/storage/storage-adapter.js";
import {
  createUnavailableStorageRepository,
  DrizzleStorageRepository,
  type StorageRepository,
} from "./modules/storage/storage.repository.js";
import { registerStorageRoutes } from "./modules/storage/storage.routes.js";
import { createStorageService, type StorageService } from "./modules/storage/storage.service.js";

type BuildAppOptions = {
  adminRepository?: AdminRepository;
  adminService?: AdminService;
  agreementRepository?: AgreementRepository;
  agreementService?: AgreementService;
  authRepository?: AuthRepository;
  authService?: AuthService;
  billingRepository?: BillingRepository;
  billingService?: BillingService;
  database?: Pick<DatabaseClient, "close" | "ping"> & Partial<Pick<DatabaseClient, "db">>;
  env?: ApiEnv;
  marketplaceRepository?: MarketplaceRepository;
  marketplaceService?: MarketplaceService;
  notificationRepository?: NotificationRepository;
  notificationService?: NotificationService;
  paymentRepository?: PaymentRepository;
  paymentService?: PaymentService;
  schedulingRepository?: SchedulingRepository;
  schedulingService?: SchedulingService;
  storageAdapter?: StorageAdapter;
  storageRepository?: StorageRepository;
  storageService?: StorageService;
  stripeClient?: StripeClient;
  quoteRepository?: QuoteRepository;
  quoteService?: QuoteService;
  rfqRepository?: RfqRepository;
  rfqService?: RfqService;
  vendorRepository?: VendorRepository;
  vendorService?: VendorService;
};

declare module "fastify" {
  interface FastifyInstance {
    adminService: AdminService;
    agreementService: AgreementService;
    authService: AuthService;
    billingService: BillingService;
    marketplaceService: MarketplaceService;
    notificationService: NotificationService;
    quoteService: QuoteService;
    rfqService: RfqService;
    vendorService: VendorService;
    paymentService: PaymentService;
    rateLimiters: ApiRateLimiters;
    schedulingService: SchedulingService;
    storageService: StorageService;
  }

  interface FastifyRequest {
    rawBody?: string;
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? readApiEnv();
  const database = options.database ?? createDatabaseClient(env);
  const authRepository =
    options.authRepository ??
    (database.db ? new DrizzleAuthRepository(database.db) : createUnavailableAuthRepository());
  const authService =
    options.authService ??
    createAuthService({
      options: {
        accessTokenTtlSeconds: env.jwtAccessTokenTtlSeconds,
        refreshTokenTtlDays: env.refreshTokenTtlDays,
      },
      passwordService: createPasswordService(),
      repository: authRepository,
      tokenService: createTokenService({
        accessTokenSecret: env.jwtAccessSecret,
        accessTokenTtlSeconds: env.jwtAccessTokenTtlSeconds,
        refreshTokenSecret: env.refreshTokenSecret,
      }),
    });
  const adminRepository =
    options.adminRepository ??
    (database.db ? new DrizzleAdminRepository(database.db) : createUnavailableAdminRepository());
  const adminService =
    options.adminService ??
    createAdminService({
      repository: adminRepository,
    });
  const vendorRepository =
    options.vendorRepository ??
    (database.db ? new DrizzleVendorRepository(database.db) : createUnavailableVendorRepository());
  const vendorService =
    options.vendorService ??
    createVendorService({
      repository: vendorRepository,
    });
  const marketplaceRepository =
    options.marketplaceRepository ??
    (database.db
      ? new DrizzleMarketplaceRepository(database.db)
      : createUnavailableMarketplaceRepository());
  const marketplaceService =
    options.marketplaceService ??
    createMarketplaceService({
      repository: marketplaceRepository,
    });
  const notificationRepository =
    options.notificationRepository ??
    (database.db
      ? new DrizzleNotificationRepository(database.db)
      : createUnavailableNotificationRepository());
  const notificationService =
    options.notificationService ??
    createNotificationService({
      emailProvider: createDevelopmentEmailProvider(),
      repository: notificationRepository,
    });
  const rfqRepository =
    options.rfqRepository ??
    (database.db ? new DrizzleRfqRepository(database.db) : createUnavailableRfqRepository());
  const rfqService =
    options.rfqService ??
    createRfqService({
      repository: rfqRepository,
    });
  const quoteRepository =
    options.quoteRepository ??
    (database.db ? new DrizzleQuoteRepository(database.db) : createUnavailableQuoteRepository());
  const agreementRepository =
    options.agreementRepository ??
    (database.db
      ? new DrizzleAgreementRepository(database.db)
      : createUnavailableAgreementRepository());
  const storageAdapter =
    options.storageAdapter ??
    (env.fileStorageProvider === "s3"
      ? createS3CompatibleStorageAdapter({
          accessKeyId: env.fileStorageAccessKeyId,
          bucket: env.fileStorageBucket,
          endpoint: env.fileStorageEndpoint,
          region: env.fileStorageRegion,
          secretAccessKey: env.fileStorageSecretAccessKey,
        })
      : createLocalStorageAdapter({
          apiBaseUrl: env.apiBaseUrl,
          bucket: env.fileStorageBucket,
          rootDir: env.fileStorageLocalRoot,
          signingSecret: env.fileStorageSigningSecret,
        }));
  const storageRepository =
    options.storageRepository ??
    (database.db
      ? new DrizzleStorageRepository(database.db)
      : createUnavailableStorageRepository());
  const storageService =
    options.storageService ??
    createStorageService({
      adapter: storageAdapter,
      repository: storageRepository,
      signedUrlTtlSeconds: env.fileStorageSignedUrlTtlSeconds,
    });
  const agreementService =
    options.agreementService ??
    createAgreementService({
      repository: agreementRepository,
      storageService: database.db || options.storageRepository ? storageService : undefined,
    });
  const billingRepository =
    options.billingRepository ??
    (database.db
      ? new DrizzleBillingRepository(database.db)
      : createUnavailableBillingRepository());
  const billingService =
    options.billingService ??
    createBillingService({
      repository: billingRepository,
    });
  const paymentRepository =
    options.paymentRepository ??
    (database.db
      ? new DrizzlePaymentRepository(database.db)
      : createUnavailablePaymentRepository());
  const schedulingRepository =
    options.schedulingRepository ??
    (database.db
      ? new DrizzleSchedulingRepository(database.db)
      : createUnavailableSchedulingRepository());
  const schedulingService =
    options.schedulingService ??
    createSchedulingService({
      repository: schedulingRepository,
    });
  const stripeClient =
    options.stripeClient ??
    (env.stripeSecretKey
      ? createStripeClient(env.stripeSecretKey)
      : createUnavailableStripeClient());
  const paymentService =
    options.paymentService ??
    createPaymentService({
      appBaseUrl: env.appBaseUrl,
      repository: paymentRepository,
      stripeClient,
      stripeWebhookSecret: env.stripeWebhookSecret,
    });
  const rateLimiters = createRateLimiters(env);
  const quoteService =
    options.quoteService ??
    createQuoteService({
      agreementService,
      repository: quoteRepository,
    });
  const app = Fastify({
    bodyLimit: env.requestBodyLimitBytes,
    genReqId: createRequestId,
    logger: createLoggerOptions(env),
  });

  app.setErrorHandler(createErrorHandler(env));
  app.decorate("adminService", adminService);
  app.decorate("agreementService", agreementService);
  app.decorate("authService", authService);
  app.decorate("billingService", billingService);
  app.decorate("marketplaceService", marketplaceService);
  app.decorate("notificationService", notificationService);
  app.decorate("quoteService", quoteService);
  app.decorate("rfqService", rfqService);
  app.decorate("vendorService", vendorService);
  app.decorate("paymentService", paymentService);
  app.decorate("rateLimiters", rateLimiters);
  app.decorate("schedulingService", schedulingService);
  app.decorate("storageService", storageService);
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, payload, done) => {
    const rawBody = payload.toString("utf8");
    request.rawBody = rawBody;

    if (!rawBody) {
      done(null, undefined);
      return;
    }

    try {
      done(null, JSON.parse(rawBody) as unknown);
    } catch (error) {
      done(error instanceof Error ? error : new Error("Invalid JSON payload."), undefined);
    }
  });
  await registerRequestContext(app);

  await app.register(helmet);
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });
  await app.register(cookie);

  app.addHook("onClose", async () => {
    await database.close();
  });

  await registerHealthRoutes(app, { database });
  await registerAuthRoutes(app, { authService, env });
  await registerAdminRoutes(app, { adminService });
  await registerMarketplaceRoutes(app, { marketplaceService });
  await registerNotificationRoutes(app, { notificationService });
  await registerRfqRoutes(app, { rfqService });
  await registerQuoteRoutes(app, { quoteService });
  await registerAgreementRoutes(app, { agreementService });
  await registerBillingRoutes(app, { billingService });
  await registerPaymentRoutes(app, { paymentService });
  await registerSchedulingRoutes(app, { schedulingService });
  await registerStorageRoutes(app, { storageService });
  await registerVendorRoutes(app, { vendorService });
  return app;
}
