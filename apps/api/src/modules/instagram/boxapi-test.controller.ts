import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpCode,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Store } from "../../platform";

export function verifyBoxApiSignature(
  raw: Buffer,
  timestamp: unknown,
  signature: unknown,
  secret: string,
  now = Date.now(),
) {
  if (
    typeof timestamp !== "string" ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    typeof signature !== "string" ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  return timingSafeEqual(
    createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(raw)
      .digest(),
    Buffer.from(signature.slice(7), "hex"),
  );
}
const eventSchema = z.object({
  event_id: z.string().min(1).max(512),
  event_type: z.string().min(1).max(100),
  account_id: z.uuid(),
  data: z.record(z.string(), z.unknown()),
});

// A temporary diagnostic receiver, isolated from merchant and Meta inbox processing.
@Controller("boxapi")
export class BoxApiTestController {
  constructor(private readonly store: Store) {}
  private settings() {
    const env = this.store.config;
    if (
      !env.BOXAPI_WEBHOOK_SECRET ||
      !env.BOXAPI_TEST_ACCOUNT_ID ||
      !env.BOXAPI_TEST_STATUS_TOKEN ||
      !env.BOXAPI_TEST_EXPIRES_AT ||
      Date.parse(env.BOXAPI_TEST_EXPIRES_AT) <= Date.now()
    )
      throw new ServiceUnavailableException("BoxAPI test disabled");
    return {
      secret: env.BOXAPI_WEBHOOK_SECRET,
      account: env.BOXAPI_TEST_ACCOUNT_ID,
      token: env.BOXAPI_TEST_STATUS_TOKEN,
    };
  }
  @Post("webhook")
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<FastifyRequest>) {
    const settings = this.settings();
    if (
      !req.rawBody ||
      !verifyBoxApiSignature(
        req.rawBody,
        req.headers["x-boxapi-timestamp"],
        req.headers["x-boxapi-signature"],
        settings.secret,
      )
    )
      throw new UnauthorizedException();
    const event = eventSchema.parse(req.body);
    if (event.account_id !== settings.account)
      throw new UnauthorizedException();
    const key =
      "paymoon:boxapi-test:" +
      createHash("sha256").update(settings.account).digest("hex");
    const summary = JSON.stringify({
      event_type: event.event_type,
      received_at: new Date().toISOString(),
      ...(typeof event.data.success === "boolean"
        ? { action_success: event.data.success }
        : {}),
    });
    // Atomic receipt and retry dedupe, expiring after one hour. No private payload is retained.
    await this.store.redis.eval(
      `
      if redis.call('SET', KEYS[1], '1', 'EX', 3600, 'NX') then
        redis.call('LPUSH', KEYS[2], ARGV[1]); redis.call('LTRIM', KEYS[2], 0, 19);
        redis.call('EXPIRE', KEYS[2], 3600); return 1;
      end; return 0;`,
      2,
      key + ":" + createHash("sha256").update(event.event_id).digest("hex"),
      key + ":events",
      summary,
    );
    return { received: true };
  }
  @Get("test-status")
  async status(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const settings = this.settings();
    const actual = createHash("sha256")
      .update(String(req.headers.authorization ?? ""))
      .digest();
    const expected = createHash("sha256")
      .update("Bearer " + settings.token)
      .digest();
    if (!timingSafeEqual(actual, expected)) throw new UnauthorizedException();
    reply.header("Cache-Control", "no-store");
    const key =
      "paymoon:boxapi-test:" +
      createHash("sha256").update(settings.account).digest("hex") +
      ":events";
    return {
      events: (await this.store.redis.lrange(key, 0, 19)).map((value) =>
        JSON.parse(value),
      ),
    };
  }
}
