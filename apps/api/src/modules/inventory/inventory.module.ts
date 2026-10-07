import {
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { transaction } from "@paymoon/db";
import { emit, idempotent } from "@paymoon/events";
import { movementInput, moveStock, type Stock } from "@paymoon/validation";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
@ApiTags("inventory")
@ApiBearerAuth()
@Controller("v1/organizations/:org/inventory")
export class InventoryController {
  constructor(
    private readonly store: Store,
    private readonly organizations: OrganizationsService,
  ) {}
  @Get() async list(@Req() req: FastifyRequest, @Param("org") org: string) {
    await this.organizations.require(req, org, "read");
    return (
      await this.store.db.pool.query(
        "SELECT i.*,v.sku FROM commerce.inventory i JOIN commerce.variants v ON v.id=i.variant_id WHERE v.organization_id=$1 ORDER BY v.sku LIMIT 100",
        [org],
      )
    ).rows;
  }
  @Post("movements")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["variantId", "kind", "quantity"],
      properties: {
        variantId: { type: "string", format: "uuid" },
        kind: {
          type: "string",
          enum: ["receive", "reserve", "release", "commit", "ship"],
        },
        quantity: { type: "integer", minimum: 1 },
      },
    },
  })
  async move(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    const input = movementInput.parse(body);
    if (input.kind !== "receive")
      throw new ConflictException("Order workflow owns stock reservations");
    return transaction(this.store.db.pool, async (c) => {
      const actor = await this.organizations.require(
        req,
        org,
        "inventory:write",
        c,
      );
      return idempotent(
        c,
        `stock:${org}:${actor.id}`,
        String(req.headers["idempotency-key"] ?? ""),
        input,
        async () => {
          const row = (
            await c.query(
              "SELECT i.* FROM commerce.inventory i JOIN commerce.variants v ON v.id=i.variant_id WHERE i.variant_id=$1 AND v.organization_id=$2 FOR UPDATE OF i",
              [input.variantId, org],
            )
          ).rows[0] as Stock | undefined;
          if (!row) throw new NotFoundException();
          let next: Stock;
          try {
            next = moveStock(row, input.kind, input.quantity);
          } catch {
            throw new ConflictException("Insufficient stock");
          }
          await c.query(
            "UPDATE commerce.inventory SET available=$2,reserved=$3,committed=$4 WHERE variant_id=$1",
            [input.variantId, next.available, next.reserved, next.committed],
          );
          await c.query(
            "INSERT INTO commerce.stock_movements(variant_id,kind,quantity,actor_id) VALUES($1,$2,$3,$4)",
            [input.variantId, input.kind, input.quantity, actor.id],
          );
          await emit(c, "inventory.changed", {
            organizationId: org,
            variantId: input.variantId,
          });
          return next;
        },
      );
    });
  }
}
@Module({ imports: [OrganizationsModule], controllers: [InventoryController] })
export class InventoryModule {}
