import {
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  ConflictException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiBody } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { transaction } from "@paymoon/db";
import { idempotent } from "@paymoon/events";
import { uuid } from "@paymoon/validation";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
import { IdentityModule, IdentityService } from "../identity/identity.module";
const segment = z.enum(["all", "new", "active", "vip", "at_risk"]);
const minor = z.string().regex(/^\d{1,15}$/);
const customerQuery = `WITH stats AS(SELECT buyer_id,count(*)::integer AS orders,count(*) FILTER(WHERE status IN('paid','fulfilling','shipped','completed'))::integer AS paid_orders,coalesce(sum(amount_minor) FILTER(WHERE status IN('paid','fulfilling','shipped','completed')),0)::text AS lifetime_minor,max(created_at) FILTER(WHERE status IN('paid','fulfilling','shipped','completed')) AS last_purchase FROM commerce.orders WHERE organization_id=$1 GROUP BY buyer_id) SELECT s.*,u.email,n.note,CASE WHEN last_purchase<now()-interval '60 days' THEN 'at_risk' WHEN paid_orders>=3 THEN 'vip' WHEN paid_orders>=2 THEN 'active' ELSE 'new' END AS segment FROM stats s JOIN commerce.users u ON u.id=s.buyer_id LEFT JOIN commerce.customer_notes n ON n.organization_id=$1 AND n.user_id=s.buyer_id`;
@ApiTags("merchant-growth")
@ApiBearerAuth()
@Controller("v1/organizations/:org")
export class GrowthController {
  constructor(
    private store: Store,
    private orgs: OrganizationsService,
  ) {}
  @Get("customers") async customers(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Query() q: unknown,
  ) {
    await this.orgs.require(r, org, "merchant:write");
    const input = z
      .object({
        segment: segment.default("all"),
        q: z.string().max(100).default(""),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
      })
      .parse(q);
    return (
      await this.store.db.pool.query(
        `SELECT * FROM (${customerQuery}) c WHERE ($2='all' OR c.segment=$2) AND c.email ILIKE '%'||$3||'%' ORDER BY c.last_purchase DESC NULLS LAST,c.buyer_id LIMIT 50 OFFSET $4`,
        [org, input.segment, input.q, input.offset],
      )
    ).rows;
  }
  @Get("customers/:user") async customer(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("user") user: string,
  ) {
    await this.orgs.require(r, org, "merchant:write");
    uuid.parse(user);
    const c = (
      await this.store.db.pool.query(
        `SELECT * FROM (${customerQuery}) c WHERE buyer_id=$2`,
        [org, user],
      )
    ).rows[0];
    if (!c) throw new NotFoundException();
    const orders = (
      await this.store.db.pool.query(
        "SELECT id,status,amount_minor,created_at FROM commerce.orders WHERE organization_id=$1 AND buyer_id=$2 ORDER BY created_at DESC LIMIT 50",
        [org, user],
      )
    ).rows;
    return { ...c, orders };
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["note"],
      properties: { note: { type: "string", maxLength: 2000 } },
    },
  })
  @Put("customers/:user/note")
  async note(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("user") user: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({ note: z.string().trim().max(2000) })
      .strict()
      .parse(b);
    uuid.parse(user);
    return transaction(this.store.db.pool, async (c) => {
      await this.orgs.require(r, org, "merchant:write", c);
      const result = await c.query(
        `INSERT INTO commerce.customer_notes(organization_id,user_id,note) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM commerce.orders WHERE organization_id=$1 AND buyer_id=$2) ON CONFLICT(organization_id,user_id) DO UPDATE SET note=excluded.note,updated_at=now() RETURNING note`,
        [org, user, q.note],
      );
      if (!result.rowCount) throw new NotFoundException();
      return result.rows[0];
    });
  }
  @Get("reports") async reports(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Query() q: unknown,
  ) {
    await this.orgs.require(r, org, "merchant:write");
    const { days } = z
      .object({ days: z.coerce.number().int().min(1).max(365).default(30) })
      .parse(q);
    const params = [org, days];
    const [summary, daily, top, statuses] = await Promise.all([
      this.store.db.pool.query(
        `SELECT count(*)::integer AS orders,count(*) FILTER(WHERE status IN('paid','fulfilling','shipped','completed'))::integer AS paid_orders,coalesce(sum(amount_minor) FILTER(WHERE status IN('paid','fulfilling','shipped','completed')),0)::text AS revenue_minor,coalesce(sum(discount_minor) FILTER(WHERE status IN('paid','fulfilling','shipped','completed')),0)::text AS discount_minor,count(DISTINCT buyer_id)::integer AS customers FROM commerce.orders WHERE organization_id=$1 AND created_at>=now()-($2::integer*interval '1 day')`,
        params,
      ),
      this.store.db.pool.query(
        `SELECT date_trunc('day',created_at AT TIME ZONE 'Asia/Tehran')::date::text AS day,count(*)::integer AS orders,coalesce(sum(amount_minor) FILTER(WHERE status IN('paid','fulfilling','shipped','completed')),0)::text AS revenue_minor FROM commerce.orders WHERE organization_id=$1 AND created_at>=now()-($2::integer*interval '1 day') GROUP BY 1 ORDER BY 1`,
        params,
      ),
      this.store.db.pool.query(
        `SELECT i.variant_id,max(i.title) AS title,sum(i.quantity)::integer AS quantity,sum(i.quantity*i.unit_price_minor)::text AS gross_minor FROM commerce.order_items i JOIN commerce.orders o ON o.id=i.order_id WHERE o.organization_id=$1 AND o.status IN('paid','fulfilling','shipped','completed') AND o.created_at>=now()-($2::integer*interval '1 day') GROUP BY i.variant_id ORDER BY sum(i.quantity) DESC LIMIT 10`,
        params,
      ),
      this.store.db.pool.query(
        `SELECT status,count(*)::integer AS count FROM commerce.orders WHERE organization_id=$1 AND created_at>=now()-($2::integer*interval '1 day') GROUP BY status`,
        params,
      ),
    ]);
    return {
      summary: summary.rows[0],
      daily: daily.rows,
      top: top.rows,
      statuses: statuses.rows,
      days,
    };
  }
  @Get("coupons") async coupons(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.orgs.require(r, org, "merchant:write");
    return (
      await this.store.db.pool.query(
        `SELECT c.*,(SELECT count(*)::integer FROM commerce.coupon_redemptions r JOIN commerce.orders o ON o.id=r.order_id WHERE r.coupon_id=c.id AND (o.status IN('paid','fulfilling','shipped','completed','refunded') OR (o.status='pending_payment' AND o.expires_at>now()))) AS used FROM commerce.coupons c WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [org],
      )
    ).rows;
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["code", "kind", "value", "usageLimit", "endsAt"],
      properties: {
        code: { type: "string", pattern: "^[A-Za-z0-9_-]{3,32}$" },
        kind: { type: "string", enum: ["percent", "fixed"] },
        value: {
          type: "string",
          pattern: "^[0-9]{1,15}$",
          description: "Amount in IRR minor units (10 IRR = 1 toman).",
        },
        minimumMinor: {
          type: "string",
          pattern: "^[0-9]{1,15}$",
          description: "Amount in IRR minor units (10 IRR = 1 toman).",
        },
        maximumDiscountMinor: {
          type: "string",
          pattern: "^[0-9]{1,15}$",
          description: "Amount in IRR minor units (10 IRR = 1 toman).",
        },
        usageLimit: { type: "integer", minimum: 1, maximum: 1000000 },
        perCustomerLimit: { type: "integer", minimum: 1, maximum: 1000 },
        endsAt: { type: "string", format: "date-time" },
      },
    },
  })
  @Post("coupons")
  async coupon(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9_-]{3,32}$/),
        kind: z.enum(["percent", "fixed"]),
        value: minor,
        minimumMinor: minor.default("0"),
        maximumDiscountMinor: minor.optional(),
        usageLimit: z.number().int().min(1).max(1000000),
        perCustomerLimit: z.number().int().min(1).max(1000).default(1),
        endsAt: z.iso.datetime(),
      })
      .strict()
      .parse(b);
    if (
      BigInt(q.value) <= 0n ||
      (q.kind === "percent" && BigInt(q.value) > 100n) ||
      new Date(q.endsAt).getTime() <= Date.now() ||
      (q.maximumDiscountMinor && BigInt(q.maximumDiscountMinor) <= 0n)
    )
      throw new ConflictException("Invalid coupon settings");
    return transaction(this.store.db.pool, async (c) => {
      const actor = await this.orgs.require(r, org, "merchant:write", c);
      return idempotent(
        c,
        `coupon:${org}:${actor.id}`,
        String(r.headers["idempotency-key"] ?? ""),
        q,
        async () =>
          (
            await c.query(
              `INSERT INTO commerce.coupons(organization_id,code,kind,value,minimum_minor,maximum_discount_minor,usage_limit,per_customer_limit,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
              [
                org,
                q.code,
                q.kind,
                q.value,
                q.minimumMinor,
                q.maximumDiscountMinor ?? null,
                q.usageLimit,
                q.perCustomerLimit,
                q.endsAt,
              ],
            )
          ).rows[0],
      );
    });
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["active"],
      properties: { active: { type: "boolean" } },
    },
  })
  @Put("coupons/:id")
  async toggle(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const q = z.object({ active: z.boolean() }).strict().parse(b);
    uuid.parse(id);
    return transaction(this.store.db.pool, async (c) => {
      await this.orgs.require(r, org, "merchant:write", c);
      const result = await c.query(
        "UPDATE commerce.coupons SET active=$3 WHERE organization_id=$1 AND id=$2 RETURNING *",
        [org, id, q.active],
      );
      if (!result.rowCount) throw new NotFoundException();
      return result.rows[0];
    });
  }
  @Get("campaigns") async campaigns(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.orgs.require(r, org, "merchant:write");
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.campaigns WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
        [org],
      )
    ).rows;
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body", "segment"],
      properties: {
        title: { type: "string", minLength: 3, maxLength: 120 },
        body: { type: "string", minLength: 3, maxLength: 1000 },
        segment: {
          type: "string",
          enum: ["all", "new", "active", "vip", "at_risk"],
        },
      },
    },
  })
  @Post("campaigns")
  async sendCampaign(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({
        title: z.string().trim().min(3).max(120),
        body: z.string().trim().min(3).max(1000),
        segment: segment,
      })
      .strict()
      .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      const actor = await this.orgs.require(r, org, "merchant:write", c);
      return idempotent(
        c,
        `campaign:${org}:${actor.id}`,
        String(r.headers["idempotency-key"] ?? ""),
        q,
        async () => {
          const recipients = (
            await c.query(
              `SELECT buyer_id FROM (${customerQuery}) c WHERE paid_orders>0 AND ($2='all' OR segment=$2) LIMIT 501`,
              [org, q.segment],
            )
          ).rows;
          if (recipients.length > 500)
            throw new ConflictException(
              "Use a narrower audience; maximum 500 recipients",
            );
          const campaign = (
            await c.query(
              "INSERT INTO commerce.campaigns(organization_id,title,body,segment,recipient_count) VALUES($1,$2,$3,$4,$5) RETURNING *",
              [org, q.title, q.body, q.segment, recipients.length],
            )
          ).rows[0];
          if (recipients.length)
            await c.query(
              `INSERT INTO commerce.user_notifications(user_id,kind,title,body,campaign_id) SELECT unnest($1::uuid[]),'campaign',$2,$3,$4 ON CONFLICT DO NOTHING`,
              [recipients.map((x) => x.buyer_id), q.title, q.body, campaign.id],
            );
          return campaign;
        },
      );
    });
  }
  @Get("inventory/alerts") async alerts(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.orgs.require(r, org, "read");
    return (
      await this.store.db.pool.query(
        "SELECT i.*,v.sku,p.title,p.id AS product_id FROM commerce.inventory i JOIN commerce.variants v ON v.id=i.variant_id JOIN commerce.products p ON p.id=v.product_id WHERE v.organization_id=$1 AND p.status<>'archived' AND i.available<=i.low_stock_threshold ORDER BY i.available,v.id LIMIT 100",
        [org],
      )
    ).rows;
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["threshold"],
      properties: {
        threshold: { type: "integer", minimum: 0, maximum: 1000000 },
      },
    },
  })
  @Put("inventory/:variant/threshold")
  async threshold(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("variant") variant: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({ threshold: z.number().int().min(0).max(1000000) })
      .strict()
      .parse(b);
    uuid.parse(variant);
    return transaction(this.store.db.pool, async (c) => {
      await this.orgs.require(r, org, "inventory:write", c);
      const result = await c.query(
        "UPDATE commerce.inventory i SET low_stock_threshold=$3 FROM commerce.variants v WHERE i.variant_id=v.id AND v.organization_id=$1 AND v.id=$2 RETURNING i.*",
        [org, variant, q.threshold],
      );
      if (!result.rowCount) throw new NotFoundException();
      return result.rows[0];
    });
  }
}
@ApiTags("returns")
@ApiBearerAuth()
@Controller("v1")
export class ReturnsController {
  constructor(
    private store: Store,
    private orgs: OrganizationsService,
    private identity: IdentityService,
  ) {}
  @Get("me/returns") async mine(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.return_requests WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 100",
        [u.id],
      )
    ).rows;
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["reason"],
      properties: { reason: { type: "string", minLength: 5, maxLength: 2000 } },
    },
  })
  @Post("me/orders/:id/return")
  async request(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const u = await this.identity.actor(r),
      q = z
        .object({ reason: z.string().trim().min(5).max(2000) })
        .strict()
        .parse(b);
    uuid.parse(id);
    return transaction(this.store.db.pool, (c) =>
      idempotent(
        c,
        `return:${u.id}:${id}`,
        String(r.headers["idempotency-key"] ?? ""),
        q,
        async () => {
          const o = (
            await c.query(
              "SELECT * FROM commerce.orders WHERE id=$1 AND buyer_id=$2 AND status IN('shipped','completed') FOR SHARE",
              [id, u.id],
            )
          ).rows[0];
          if (!o)
            throw new NotFoundException("Delivered or shipped order required");
          return (
            await c.query(
              "INSERT INTO commerce.return_requests(order_id,organization_id,buyer_id,reason) VALUES($1,$2,$3,$4) RETURNING *",
              [id, o.organization_id, u.id, q.reason],
            )
          ).rows[0];
        },
      ),
    );
  }
  @Get("organizations/:org/returns") async list(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.orgs.require(r, org, "merchant:write");
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.return_requests WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
        [org],
      )
    ).rows;
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "reply"],
      properties: {
        status: { type: "string", enum: ["approved", "rejected", "received"] },
        reply: { type: "string", minLength: 3, maxLength: 2000 },
      },
    },
  })
  @Put("organizations/:org/returns/:id")
  async review(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({
        status: z.enum(["approved", "rejected", "received"]),
        reply: z.string().trim().min(3).max(2000),
      })
      .strict()
      .parse(b);
    uuid.parse(id);
    return transaction(this.store.db.pool, async (c) => {
      await this.orgs.require(r, org, "merchant:write", c);
      const x = (
        await c.query(
          "SELECT * FROM commerce.return_requests WHERE id=$1 AND organization_id=$2 FOR UPDATE",
          [id, org],
        )
      ).rows[0];
      if (!x) throw new NotFoundException();
      if (x.status === q.status) return x;
      if (!(
        (x.status === "requested" &&
          ["approved", "rejected"].includes(q.status)) ||
        (x.status === "approved" && q.status === "received")
      ))
        throw new ConflictException("Invalid return transition");
      // Receiving a return records logistics only. Inventory and money require separate verified operations.
      const result = (
        await c.query(
          "UPDATE commerce.return_requests SET status=$2,seller_reply=$3,updated_at=now() WHERE id=$1 RETURNING *",
          [id, q.status, q.reply],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO commerce.user_notifications(user_id,order_id,kind,title,body) VALUES($1,$2,'return.updated',$3,$4)",
        [x.buyer_id, x.order_id, "وضعیت درخواست مرجوعی", q.reply],
      );
      return result;
    });
  }
}
@Module({
  imports: [OrganizationsModule, IdentityModule],
  controllers: [GrowthController, ReturnsController],
})
export class GrowthModule {}
