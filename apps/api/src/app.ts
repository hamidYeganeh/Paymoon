import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { SocialModule } from "./modules/social/social.module";
import { randomUUID } from "node:crypto";
import { ExperienceModule } from "./modules/experience/experience.module";
import { CatalogOperationsModule } from "./modules/catalog/catalog-operations.module";
import { MediaModule } from "./modules/media/media.module";
import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import { readConfig } from "@paymoon/config";
import { createLogger } from "@paymoon/logger";
import { context, traceContext } from "@paymoon/observability";
import { IdempotencyConflict } from "@paymoon/events";
import { PlatformModule, Store } from "./platform";
import { IdentityModule } from "./modules/identity/identity.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { MerchantsModule } from "./modules/merchants/merchants.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { InstagramModule } from "./modules/instagram/instagram.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
@Controller()
class HealthController {
  constructor(private readonly store: Store) {}
  @Get("health/live") live() {
    return { status: "ok" };
  }
  @Get("health/ready") async ready() {
    try {
      await Promise.all([
        this.store.db.pool.query(
          "SELECT 1 FROM commerce.schema_migrations LIMIT 1",
        ),
        this.store.redis.ping(),
      ]);
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Dependencies unavailable");
    }
  }
}
@Module({
  imports: [
    PlatformModule,
    MaintenanceModule,
    ExperienceModule,
    SocialModule,
    CatalogOperationsModule,
    MediaModule,
    IdentityModule,
    OrganizationsModule,
    MerchantsModule,
    CatalogModule,
    InventoryModule,
    OrdersModule,
    PaymentsModule,
    LedgerModule,
    InstagramModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const code = (error as { code?: string })?.code;
    const fastifyStatus = (error as { statusCode?: number })?.statusCode;
    const status =
      fastifyStatus === 429 || fastifyStatus === 413
        ? fastifyStatus
        : error instanceof HttpException
          ? error.getStatus()
          : error instanceof ZodError
            ? 400
            : error instanceof IdempotencyConflict || code === "23505"
              ? 409
              : code === "23503" || code === "23514"
                ? 422
                : 500;
    return response.status(status).send({
      statusCode: status,
      message:
        status === 500
          ? "Internal server error"
          : error instanceof HttpException
            ? error.message
            : error instanceof IdempotencyConflict
              ? error.message
              : status === 400
                ? "Invalid request"
                : status === 409
                  ? "Resource conflict"
                  : "Constraint violation",
      requestId: context.getStore()?.requestId,
    });
  }
}
export async function createApp() {
  const config = readConfig();
  const logger = createLogger("commerce-api", config.LOG_LEVEL);
  const adapter = new FastifyAdapter({
    bodyLimit: 4_100_000,
    trustProxy: false,
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      rawBody: true,
      abortOnError: false,
      logger: config.NODE_ENV === "test" ? false : undefined,
    },
  );
  const server = adapter.getInstance();
  server.addHook("onRequest", (req, res, done) => {
    const trace = traceContext(req.headers.traceparent as string | undefined);
    res.header("x-request-id", trace.requestId);
    res.header("traceparent", trace.traceparent);
    context.run(trace, done);
  });
  server.addHook("onResponse", (req, res, done) => {
    logger.info(
      {
        ...context.getStore(),
        method: req.method,
        path: req.routeOptions.url,
        status: res.statusCode,
      },
      "request",
    );
    done();
  });
  // Await work while the invocation is alive; do not start an orphan timer in a Function.
  if (config.COMMERCE_BACKGROUND_MODE === "request") {
    server.addHook("preHandler", async (req) => {
      if (!req.url.startsWith("/v1/") || req.method === "OPTIONS") return;
      try {
        await app.get(Store).maintenance();
      } catch {
        logger.error("request maintenance failed; durable work will retry");
      }
    });
  }
  await app.register(helmet);
  await app.register(rateLimit, {
    max: 60,
    nameSpace:
      config.NODE_ENV === "test"
        ? "paymoon-test-rate:" + randomUUID() + ":"
        : "paymoon-api-rate:",
    timeWindow: "1 minute",
    redis: app.get(Store).redis,
  });
  app.enableCors({
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    origin: config.COMMERCE_CORS_ORIGINS.split(",").map((v) => v.trim()),
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "traceparent",
      "X-Paymoon-Client",
    ],
    exposedHeaders: ["x-request-id", "traceparent"],
  });
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Paymoon Commerce API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, doc, { jsonDocumentUrl: "openapi.json" });
  await app.init();
  await server.ready();
  return app;
}

// Vercel detects this module because it imports @nestjs/core. Export an HTTP
// handler and share initialization across concurrent requests in one instance.
let serverlessApp: Promise<NestFastifyApplication> | undefined;
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const app = await (serverlessApp ??= createApp());
  app.getHttpServer().emit("request", request, response);
}
