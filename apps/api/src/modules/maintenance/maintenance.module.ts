import {
  Controller,
  Get,
  Module,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Store } from "../../platform";
@ApiExcludeController()
@Controller("internal/maintenance")
export class MaintenanceController {
  constructor(private readonly store: Store) {}
  @Get() async run(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const secret = this.store.config.CRON_SECRET;
    const actual = Buffer.from(String(request.headers.authorization ?? ""));
    const expected = Buffer.from("Bearer " + secret);
    if (
      !secret ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      throw new UnauthorizedException();
    reply.header("Cache-Control", "no-store");
    return this.store.maintenance(true);
  }
}
@Module({ controllers: [MaintenanceController] })
export class MaintenanceModule {}
