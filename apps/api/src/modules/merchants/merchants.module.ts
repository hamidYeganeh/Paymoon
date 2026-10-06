import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { transaction } from "@paymoon/db";
import { emit, idempotent } from "@paymoon/events";
import { merchantInput } from "@paymoon/validation";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
@ApiTags("merchants")
@ApiBearerAuth()
@Controller("v1/organizations/:org/merchant")
export class MerchantsController {
  constructor(
    private readonly store: Store,
    private readonly organizations: OrganizationsService,
  ) {}
  @Get() async get(@Req() req: FastifyRequest, @Param("org") org: string) {
    await this.organizations.require(req, org, "read");
    return {
      merchant:
        (
          await this.store.db.pool.query(
            "SELECT * FROM commerce.merchants WHERE organization_id=$1",
            [org],
          )
        ).rows[0] ?? null,
    };
  }
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["displayName"],
      properties: {
        displayName: { type: "string" },
        instagramHandle: { type: "string" },
      },
    },
  })
  async onboard(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    const input = merchantInput.parse(body);
    return transaction(this.store.db.pool, async (c) => {
      const actor = await this.organizations.require(
        req,
        org,
        "merchant:write",
        c,
      );
      return idempotent(
        c,
        `merchant:${org}:${actor.id}`,
        String(req.headers["idempotency-key"] ?? ""),
        input,
        async () => {
          const merchant = (
            await c.query(
              "INSERT INTO commerce.merchants(organization_id,display_name,instagram_handle) VALUES($1,$2,$3) RETURNING *",
              [org, input.displayName, input.instagramHandle ?? null],
            )
          ).rows[0];
          await emit(c, "merchant.created", {
            organizationId: org,
            merchantId: merchant.id,
          });
          return merchant;
        },
      );
    });
  }
}
@Module({ imports: [OrganizationsModule], controllers: [MerchantsController] })
export class MerchantsModule {}
