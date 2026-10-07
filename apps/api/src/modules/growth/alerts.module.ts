import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Post,
  Req,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiBody } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { uuid } from "@paymoon/validation";
import { transaction } from "@paymoon/db";
import { Store } from "../../platform";
import { IdentityModule, IdentityService } from "../identity/identity.module";
@ApiTags("product-alerts")
@ApiBearerAuth()
@Controller("v1/me/product-alerts")
export class AlertsController {
  constructor(
    private store: Store,
    private identity: IdentityService,
  ) {}
  @Get() async list(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT a.*,p.title FROM commerce.product_alerts a JOIN commerce.products p ON p.id=a.product_id WHERE a.user_id=$1 ORDER BY a.active DESC,a.created_at DESC LIMIT 100",
        [u.id],
      )
    ).rows;
  }
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["productId", "kind"],
          properties: {
            productId: { type: "string", format: "uuid" },
            kind: { type: "string", enum: ["restock"] },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["productId", "kind", "targetMinor"],
          properties: {
            productId: { type: "string", format: "uuid" },
            kind: { type: "string", enum: ["price"] },
            targetMinor: {
              type: "string",
              pattern: "^[1-9][0-9]{0,14}$",
              description: "Amount in IRR minor units (10 IRR = 1 toman).",
            },
          },
        },
      ],
    },
  })
  @Post()
  async create(@Req() r: FastifyRequest, @Body() b: unknown) {
    const u = await this.identity.actor(r),
      q = z
        .discriminatedUnion("kind", [
          z.object({ productId: uuid, kind: z.literal("restock") }).strict(),
          z
            .object({
              productId: uuid,
              kind: z.literal("price"),
              targetMinor: z.string().regex(/^[1-9]\d{0,14}$/),
            })
            .strict(),
        ])
        .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      await c.query("SELECT id FROM commerce.users WHERE id=$1 FOR UPDATE", [
        u.id,
      ]);
      const capacity = (
        await c.query(
          "SELECT count(*)::integer AS count FROM commerce.product_alerts WHERE user_id=$1 AND active AND NOT(product_id=$2 AND kind=$3)",
          [u.id, q.productId, q.kind],
        )
      ).rows[0].count;
      if (capacity >= 100)
        throw new ConflictException("Maximum 100 active product alerts");
      const p = (
        await c.query(
          "SELECT p.id FROM commerce.products p JOIN commerce.merchants m ON m.organization_id=p.organization_id WHERE p.id=$1 AND p.status='published' AND m.status='approved' FOR SHARE OF p,m",
          [q.productId],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      return (
        await c.query(
          "INSERT INTO commerce.product_alerts(user_id,product_id,kind,target_minor) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,product_id,kind) DO UPDATE SET active=true,target_minor=excluded.target_minor,notified_at=NULL,created_at=now() RETURNING *",
          [
            u.id,
            q.productId,
            q.kind,
            q.kind === "price" ? q.targetMinor : null,
          ],
        )
      ).rows[0];
    });
  }
  @Delete(":id") async remove(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    uuid.parse(id);
    const result = await this.store.db.pool.query(
      "UPDATE commerce.product_alerts SET active=false WHERE id=$1 AND user_id=$2 RETURNING id",
      [id, u.id],
    );
    if (!result.rowCount) throw new NotFoundException();
    return result.rows[0];
  }
}
@Module({ imports: [IdentityModule], controllers: [AlertsController] })
export class AlertsModule {}
