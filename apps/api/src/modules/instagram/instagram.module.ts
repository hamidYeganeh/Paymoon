import { IdentityModule } from "../identity/identity.module";
import { Body, Delete, Param, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { z } from "zod";
import type { FastifyReply } from "fastify";
import { OrganizationsModule } from "../organizations/organizations.module";
import { InstagramService } from "./instagram.service";
import { BoxApiTestController } from "./boxapi-test.controller";
import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Module,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { RawBodyRequest } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { transaction } from "@paymoon/db";
import { Store } from "../../platform";
export function verifySignature(
  body: Buffer,
  signature: string,
  secret: string,
) {
  if (!/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature.slice(7), "hex"),
    createHmac("sha256", secret).update(body).digest(),
  );
}
@ApiTags("instagram")
@Controller("v1/instagram/webhook")
export class InstagramController {
  constructor(private readonly store: Store) {}
  @Get() verify(@Query() query: Record<string, string>) {
    const token = this.store.config.INSTAGRAM_VERIFY_TOKEN;
    if (!token) throw new ServiceUnavailableException("Instagram disabled");
    if (
      query["hub.mode"] !== "subscribe" ||
      query["hub.verify_token"] !== token
    )
      throw new ForbiddenException();
    return query["hub.challenge"];
  }
  @Post() @HttpCode(200) async receive(
    @Req() req: RawBodyRequest<FastifyRequest>,
  ) {
    const secret = this.store.config.INSTAGRAM_APP_SECRET;
    if (!secret) throw new ServiceUnavailableException("Instagram disabled");
    if (
      !req.rawBody ||
      !verifySignature(
        req.rawBody,
        String(req.headers["x-hub-signature-256"] ?? ""),
        secret,
      )
    )
      throw new ForbiddenException();
    const digest = createHash("sha256").update(req.rawBody).digest("hex");
    await transaction(this.store.db.pool, async (c) => {
      await c.query(
        "INSERT INTO commerce.instagram_inbox(digest,payload) VALUES($1,$2) ON CONFLICT(digest) DO NOTHING",
        [digest, JSON.stringify(req.body)],
      );
    });
    return { received: true };
  }
}
@ApiTags("instagram")
@ApiBearerAuth()
@Controller("v1/organizations/:org/instagram")
export class InstagramConnectionController {
  constructor(private readonly instagram: InstagramService) {}
  @Get() status(@Req() req: FastifyRequest, @Param("org") org: string) {
    return this.instagram.status(req, org);
  }
  @Post("authorize") authorize(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param("org") org: string,
  ) {
    return this.instagram.begin(req, reply, org);
  }
  @Post("mobile-authorize") mobile(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
  ) {
    return this.instagram.mobileAuthorize(req, org);
  }
  @Post("refresh") refresh(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
  ) {
    return this.instagram.refresh(req, org);
  }
  @Get("media") media(@Req() req: FastifyRequest, @Param("org") org: string) {
    return this.instagram.media(req, org);
  }
  @Post("media/sync")
  @ApiBody({
    schema: {
      type: "object",
      properties: { after: { type: "string", maxLength: 2048 } },
    },
  })
  sync(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({ after: z.string().max(2048).optional() })
      .strict()
      .parse(body ?? {});
    return this.instagram.sync(req, org, input.after);
  }
  @Post("subscriptions")
  @ApiBody({
    schema: {
      type: "object",
      required: ["fields"],
      properties: {
        fields: {
          type: "array",
          items: {
            type: "string",
            enum: ["comments", "messages", "messaging_postbacks"],
          },
        },
      },
    },
  })
  subscribe(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        fields: z
          .array(z.enum(["comments", "messages", "messaging_postbacks"]))
          .min(1)
          .max(3),
      })
      .strict()
      .parse(body);
    return this.instagram.subscribe(req, org, [...new Set(input.fields)]);
  }
  @Delete() disconnect(@Req() req: FastifyRequest, @Param("org") org: string) {
    return this.instagram.disconnect(req, org);
  }
}
@ApiTags("instagram")
@Controller("v1/instagram/oauth")
export class InstagramOAuthController {
  constructor(private readonly instagram: InstagramService) {}
  @Get("launch") launch(
    @Res() reply: FastifyReply,
    @Query("ticket") ticket: string,
  ) {
    return this.instagram.launch(reply, ticket);
  }
  @Get("callback") async callback(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query() query: unknown,
  ) {
    const result = await this.instagram.callback(
      req,
      reply,
      z
        .object({
          state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          code: z.string().min(1).max(4096).optional(),
          error: z.string().max(200).optional(),
        })
        .parse(query),
    );
    if (req.headers.accept?.includes("text/html")) {
      return reply
        .type("text/html; charset=utf-8")
        .send(
          '<!doctype html><html lang="fa" dir="rtl"><meta name="viewport" content="width=device-width, initial-scale=1"><title>اتصال پی‌مون</title><body><h1>اینستاگرام متصل شد</h1><p>به اپ پی‌مون برگردید و صفحهٔ اینستاگرام را تازه کنید. حالا می‌توانید پست‌های فروشگاهتان را دریافت کنید.</p></body></html>',
        );
    }
    return result;
  }
}
@Module({
  imports: [OrganizationsModule, IdentityModule],
  controllers: [
    BoxApiTestController,
    InstagramController,
    InstagramConnectionController,
    InstagramOAuthController,
  ],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}
