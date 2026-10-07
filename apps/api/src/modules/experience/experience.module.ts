import { redeemCoupon } from "../growth/coupons";
import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Module,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { transaction } from "@paymoon/db";
import { idempotent, emit } from "@paymoon/events";
import { uuid } from "@paymoon/validation";
import { Store } from "../../platform";
import { IdentityModule, IdentityService } from "../identity/identity.module";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
import { stock, orderItems, notify } from "./helpers";
const address = z
  .object({
    label: z.string().trim().min(1).max(50),
    recipient: z.string().trim().min(2).max(100),
    phone: z.string().regex(/^\+?[0-9]{10,15}$/),
    province: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(80),
    postalCode: z.string().regex(/^[0-9]{10}$/),
    address: z.string().trim().min(10).max(1000),
  })
  .strict();
const merchantUpdate = z
  .object({
    displayName: z.string().trim().min(2).max(100),
    bio: z.string().max(1000),
    shippingFeeMinor: z.string().regex(/^(0|[1-9][0-9]{0,11})$/),
    shippingDays: z.number().int().min(1).max(60),
    returnPolicy: z.string().max(2000),
  })
  .strict();
const publicSelect = `SELECT p.id,p.title,p.description,p.media,p.organization_id,p.created_at,m.display_name,m.id AS merchant_id,o.slug AS merchant_slug,m.shipping_fee_minor,m.shipping_days,(SELECT min(v.price_minor)::text FROM commerce.variants v WHERE v.product_id=p.id) AS price_minor,(SELECT coalesce(sum(i.available),0) FROM commerce.variants v JOIN commerce.inventory i ON i.variant_id=v.id WHERE v.product_id=p.id) AS available FROM commerce.products p JOIN commerce.merchants m ON m.organization_id=p.organization_id JOIN commerce.organizations o ON o.id=p.organization_id WHERE p.status='published' AND m.status='approved'`;
@ApiTags("marketplace")
@Controller("v1/marketplace")
export class MarketplaceController {
  constructor(private store: Store) {}
  @Get("products") async products(@Query() raw: unknown) {
    const q = z
      .object({
        q: z.string().max(100).optional(),
        inStock: z.enum(["true", "false"]).optional(),
        minPrice: z
          .string()
          .regex(/^\d{1,12}$/)
          .optional(),
        maxPrice: z
          .string()
          .regex(/^\d{1,12}$/)
          .optional(),
        category: z.string().max(80).optional(),
        merchant: z.string().max(80).optional(),
        sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
      })
      .parse(raw);
    const sort =
      q.sort === "price_asc"
        ? "price_minor::numeric ASC,id"
        : q.sort === "price_desc"
          ? "price_minor::numeric DESC,id"
          : "created_at DESC,id";
    return (
      await this.store.db.pool.query(
        `SELECT * FROM (${publicSelect} AND ($1::text IS NULL OR p.title ILIKE '%'||$1||'%' OR p.description ILIKE '%'||$1||'%') AND ($2::text IS NULL OR p.category_id IN(SELECT id FROM commerce.categories WHERE slug=$2)) AND ($3::text IS NULL OR o.slug=$3)) t WHERE ($5::boolean=false OR EXISTS(SELECT 1 FROM commerce.variants v JOIN commerce.inventory i ON i.variant_id=v.id WHERE v.product_id=t.id AND i.available>0 AND v.price_minor>0)) AND ($6::numeric IS NULL OR t.price_minor::numeric>=$6) AND ($7::numeric IS NULL OR t.price_minor::numeric<=$7) ORDER BY ${sort} LIMIT 25 OFFSET $4`,
        [
          q.q ?? null,
          q.category ?? null,
          q.merchant ?? null,
          q.offset,
          q.inStock === "true",
          q.minPrice ? (BigInt(q.minPrice) * 10n).toString() : null,
          q.maxPrice ? (BigInt(q.maxPrice) * 10n).toString() : null,
        ],
      )
    ).rows;
  }
  @Get("products/:id") async product(@Param("id") id: string) {
    const p = (
      await this.store.db.pool.query(`${publicSelect} AND p.id=$1`, [
        uuid.parse(id),
      ])
    ).rows[0];
    if (!p) throw new NotFoundException();
    const variants = (
      await this.store.db.pool.query(
        "SELECT v.id,v.sku,v.attributes,v.price_minor,i.available FROM commerce.variants v JOIN commerce.inventory i ON i.variant_id=v.id WHERE v.product_id=$1 ORDER BY v.sku",
        [id],
      )
    ).rows;
    return { ...p, variants };
  }
  @Get("merchants") async merchants() {
    return (
      await this.store.db.pool.query(
        "SELECT m.id,m.display_name,m.bio,m.instagram_handle,o.slug,(SELECT count(*) FROM commerce.products p WHERE p.organization_id=o.id AND p.status='published') AS product_count FROM commerce.merchants m JOIN commerce.organizations o ON o.id=m.organization_id WHERE m.status='approved' AND EXISTS(SELECT 1 FROM commerce.products p WHERE p.organization_id=o.id AND p.status='published') ORDER BY m.created_at DESC LIMIT 10",
      )
    ).rows;
  }
  @Get("merchants/:slug") async merchant(@Param("slug") slug: string) {
    const m = (
      await this.store.db.pool.query(
        `SELECT m.id,m.display_name,m.bio,m.instagram_handle,m.shipping_fee_minor,m.shipping_days,m.return_policy,o.slug,(SELECT count(*) FROM commerce.products WHERE organization_id=o.id AND status='published') AS product_count FROM commerce.merchants m JOIN commerce.organizations o ON o.id=m.organization_id WHERE o.slug=$1 AND m.status='approved'`,
        [slug],
      )
    ).rows[0];
    if (!m) throw new NotFoundException();
    return m;
  }
  @Get("merchants/:slug/reviews") async reviews(@Param("slug") slug: string) {
    return (
      await this.store.db.pool.query(
        `SELECT r.id,r.rating,r.body,r.created_at FROM commerce.reviews r JOIN commerce.orders x ON x.id=r.order_id JOIN commerce.organizations o ON o.id=x.organization_id JOIN commerce.merchants m ON m.organization_id=o.id WHERE o.slug=$1 AND m.status='approved' ORDER BY r.created_at DESC LIMIT 100`,
        [slug],
      )
    ).rows;
  }
}
@ApiTags("customer")
@ApiBearerAuth()
@Controller("v1/me")
export class CustomerController {
  constructor(
    private store: Store,
    private identity: IdentityService,
  ) {}
  @Get("addresses") async addresses(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.addresses WHERE user_id=$1 ORDER BY created_at DESC",
        [u.id],
      )
    ).rows;
  }
  @ApiBody({
    schema: z.toJSONSchema(address) as import("@nestjs/swagger").SchemaObject,
  })
  @Post("addresses")
  async addAddress(@Req() r: FastifyRequest, @Body() b: unknown) {
    const u = await this.identity.actor(r),
      a = address.parse(b);
    return (
      await this.store.db.pool.query(
        "INSERT INTO commerce.addresses(user_id,label,recipient,phone,province,city,postal_code,address) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          u.id,
          a.label,
          a.recipient,
          a.phone,
          a.province,
          a.city,
          a.postalCode,
          a.address,
        ],
      )
    ).rows[0];
  }
  @Delete("addresses/:id") async deleteAddress(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    await this.store.db.pool.query(
      "DELETE FROM commerce.addresses WHERE user_id=$1 AND id=$2",
      [u.id, uuid.parse(id)],
    );
    return { ok: true };
  }
  @Get("following") async following(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT m.id,m.display_name,o.slug FROM commerce.followed_merchants f JOIN commerce.merchants m ON m.id=f.merchant_id JOIN commerce.organizations o ON o.id=m.organization_id WHERE f.user_id=$1 AND m.status='approved' ORDER BY f.created_at DESC LIMIT 100",
        [u.id],
      )
    ).rows;
  }
  @Put("following/:id") async follow(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    const result = await this.store.db.pool.query(
      "INSERT INTO commerce.followed_merchants(user_id,merchant_id) SELECT $1,id FROM commerce.merchants WHERE id=$2 AND status='approved' ON CONFLICT DO NOTHING",
      [u.id, uuid.parse(id)],
    );
    return { ok: true, added: !!result.rowCount };
  }
  @Delete("following/:id") async unfollow(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    await this.store.db.pool.query(
      "DELETE FROM commerce.followed_merchants WHERE user_id=$1 AND merchant_id=$2",
      [u.id, uuid.parse(id)],
    );
    return { ok: true };
  }
  @Get("saved") async saved(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        `${publicSelect} AND p.id IN(SELECT product_id FROM commerce.saved_products WHERE user_id=$1) ORDER BY p.created_at DESC LIMIT 100`,
        [u.id],
      )
    ).rows;
  }
  @Put("saved/:id") async save(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    await this.store.db.pool.query(
      `INSERT INTO commerce.saved_products(user_id,product_id) SELECT $1,p.id FROM commerce.products p JOIN commerce.merchants m ON m.organization_id=p.organization_id WHERE p.id=$2 AND p.status='published' AND m.status='approved' ON CONFLICT DO NOTHING`,
      [u.id, uuid.parse(id)],
    );
    return { ok: true };
  }
  @Delete("saved/:id") async unsave(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    await this.store.db.pool.query(
      "DELETE FROM commerce.saved_products WHERE user_id=$1 AND product_id=$2",
      [u.id, uuid.parse(id)],
    );
    return { ok: true };
  }
  @Get("orders") async orders(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT x.*,m.display_name FROM commerce.orders x JOIN commerce.merchants m ON m.organization_id=x.organization_id WHERE x.buyer_id=$1 ORDER BY x.created_at DESC LIMIT 100",
        [u.id],
      )
    ).rows;
  }
  @Get("orders/:id") async order(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    const x = (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.orders WHERE id=$1 AND buyer_id=$2",
        [uuid.parse(id), u.id],
      )
    ).rows[0];
    if (!x) throw new NotFoundException();
    const items = (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.order_items WHERE order_id=$1",
        [id],
      )
    ).rows;
    return {
      ...x,
      items,
      paymentMode: this.store.config.COMMERCE_PAYMENT_MODE,
    };
  }
  @ApiBody({
    schema: {
      type: "object",
      required: ["addressId", "items"],
      properties: {
        couponCode: {
          type: "string",
          minLength: 3,
          maxLength: 32,
          description:
            "Optional coupon code; discount is calculated in the checkout transaction.",
        },
        addressId: { type: "string", format: "uuid" },
        items: {
          type: "array",
          minItems: 1,
          maxItems: 50,
          items: {
            type: "object",
            required: ["variantId", "quantity"],
            properties: {
              variantId: { type: "string", format: "uuid" },
              quantity: { type: "integer", minimum: 1, maximum: 100 },
            },
          },
        },
      },
    },
  })
  @Post("checkout")
  async checkout(@Req() r: FastifyRequest, @Body() b: unknown) {
    const u = await this.identity.actor(r);
    const input = z
      .object({
        addressId: uuid,
        couponCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9_-]{3,32}$/)
          .optional(),
        items: z
          .array(
            z
              .object({
                variantId: uuid,
                quantity: z.number().int().min(1).max(100),
              })
              .strict(),
          )
          .min(1)
          .max(50),
      })
      .strict()
      .parse(b);
    const merged = new Map<string, number>();
    for (const x of input.items)
      merged.set(x.variantId, (merged.get(x.variantId) ?? 0) + x.quantity);
    if ([...merged.values()].some((q) => q > 100))
      throw new ConflictException("Quantity too large");
    return transaction(this.store.db.pool, (c) =>
      idempotent(
        c,
        `checkout:${u.id}`,
        String(r.headers["idempotency-key"] ?? ""),
        input,
        async () => {
          const a = (
            await c.query(
              "SELECT * FROM commerce.addresses WHERE id=$1 AND user_id=$2",
              [input.addressId, u.id],
            )
          ).rows[0];
          if (!a) throw new NotFoundException("Address not found");
          await c.query(
            "SELECT p.id FROM commerce.products p WHERE p.id IN(SELECT product_id FROM commerce.variants WHERE id=ANY($1::uuid[])) ORDER BY p.id FOR SHARE",
            [[...merged.keys()]],
          );
          await c.query(
            "SELECT m.id FROM commerce.merchants m WHERE m.organization_id IN(SELECT organization_id FROM commerce.variants WHERE id=ANY($1::uuid[])) ORDER BY m.id FOR SHARE",
            [[...merged.keys()]],
          );
          const variants = (
            await c.query(
              `SELECT v.*,p.title,p.status,m.status AS merchant_status,m.shipping_fee_minor FROM commerce.variants v JOIN commerce.products p ON p.id=v.product_id JOIN commerce.merchants m ON m.organization_id=v.organization_id WHERE v.id=ANY($1::uuid[]) ORDER BY v.id FOR SHARE OF v`,
              [[...merged.keys()]],
            )
          ).rows;
          if (
            variants.length !== merged.size ||
            variants.some(
              (v) =>
                v.status !== "published" ||
                v.merchant_status !== "approved" ||
                BigInt(v.price_minor) <= 0n,
            )
          )
            throw new ConflictException("Product unavailable");
          if (new Set(variants.map((v) => v.organization_id)).size !== 1)
            throw new ConflictException("Checkout one shop at a time");
          const org = variants[0].organization_id;
          let total = BigInt(variants[0].shipping_fee_minor);
          for (const v of variants)
            total += BigInt(v.price_minor) * BigInt(merged.get(v.id)!);
          const { discount, coupon } = await redeemCoupon(
            c,
            org,
            u.id,
            input.couponCode,
            total - BigInt(variants[0].shipping_fee_minor),
          );
          total -= discount;
          if (total > 9223372036854775807n)
            throw new BadRequestException(
              "Order amount exceeds supported range",
            );
          const x = (
            await c.query(
              `INSERT INTO commerce.orders(organization_id,buyer_id,status,amount_minor,shipping_fee_minor,shipping_address,expires_at,discount_minor,coupon_code) VALUES($1,$2,'pending_payment',$3,$4,$5,now()+interval '30 minutes',$6,$7) RETURNING *`,
              [
                org,
                u.id,
                total.toString(),
                variants[0].shipping_fee_minor,
                JSON.stringify({
                  ...a,
                  user_id: undefined,
                  id: undefined,
                  created_at: undefined,
                }),
                discount.toString(),
                coupon?.code ?? null,
              ],
            )
          ).rows[0];
          if (coupon)
            await c.query(
              "INSERT INTO commerce.coupon_redemptions(coupon_id,order_id,buyer_id,discount_minor) VALUES($1,$2,$3,$4)",
              [coupon.id, x.id, u.id, discount.toString()],
            );
          for (const v of variants) {
            await stock(c, v.id, "reserve", merged.get(v.id)!, u.id);
            await c.query(
              "INSERT INTO commerce.order_items(order_id,variant_id,title,sku,attributes,quantity,unit_price_minor) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [
                x.id,
                v.id,
                v.title,
                v.sku,
                v.attributes,
                merged.get(v.id),
                v.price_minor,
              ],
            );
          }
          await emit(c, "order.transitioned", {
            organizationId: org,
            orderId: x.id,
            status: "pending_payment",
          });
          await notify(c, u.id, x.id, "order.created");
          await c.query(
            `INSERT INTO commerce.analytics_events(user_id,organization_id,name,properties) VALUES($1,$2,'order.created',$3)`,
            [u.id, org, JSON.stringify({ orderId: x.id })],
          );
          return { ...x, paymentMode: this.store.config.COMMERCE_PAYMENT_MODE };
        },
      ),
    );
  }
  @Post("orders/:id/cancel") async cancel(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    return transaction(this.store.db.pool, async (c) => {
      const x = (
        await c.query(
          "SELECT * FROM commerce.orders WHERE id=$1 AND buyer_id=$2 FOR UPDATE",
          [uuid.parse(id), u.id],
        )
      ).rows[0];
      if (!x) throw new NotFoundException();
      if (x.status === "cancelled") return x;
      if (x.status !== "pending_payment")
        throw new ConflictException("Only unpaid orders can be cancelled");
      for (const i of await orderItems(c, id))
        await stock(c, i.variant_id, "release", i.quantity, u.id);
      await c.query(
        `UPDATE commerce.orders SET status='cancelled',version=version+1,updated_at=now() WHERE id=$1`,
        [id],
      );
      await emit(c, "order.transitioned", {
        organizationId: x.organization_id,
        orderId: id,
        status: "cancelled",
      });
      return { status: "cancelled" };
    });
  }
  @Post("orders/:id/sandbox-payment") async sandbox(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    if (
      this.store.config.COMMERCE_PAYMENT_MODE !== "sandbox" ||
      this.store.config.COMMERCE_ENVIRONMENT === "production"
    )
      throw new ServiceUnavailableException(
        "Live payment provider not configured",
      );
    const u = await this.identity.actor(r);
    return transaction(this.store.db.pool, async (c) => {
      const x = (
        await c.query(
          "SELECT * FROM commerce.orders WHERE id=$1 AND buyer_id=$2 FOR UPDATE",
          [uuid.parse(id), u.id],
        )
      ).rows[0];
      if (!x) throw new NotFoundException();
      if (x.status === "paid") return { status: "paid", sandbox: true };
      if (
        x.status !== "pending_payment" ||
        new Date(x.expires_at).getTime() < Date.now()
      )
        throw new ConflictException("Order expired or not payable");
      for (const i of await orderItems(c, id))
        await stock(c, i.variant_id, "commit", i.quantity, u.id);
      await c.query(
        `INSERT INTO commerce.payments(order_id,provider,provider_reference,status,amount_minor) VALUES($1,'sandbox',$2,'succeeded',$3)`,
        [id, "sandbox:" + id, x.amount_minor],
      );
      await c.query(
        `INSERT INTO commerce.ledger_accounts(organization_id,code) VALUES($1,'sandbox_cash'),($1,'merchant_payable') ON CONFLICT DO NOTHING`,
        [x.organization_id],
      );
      const j = (
        await c.query(
          "INSERT INTO commerce.journals(organization_id,reference) VALUES($1,$2) RETURNING id",
          [x.organization_id, "sandbox:" + id],
        )
      ).rows[0];
      await c.query(
        `INSERT INTO commerce.ledger_entries(journal_id,account_id,debit,credit) SELECT $1,id,CASE WHEN code='sandbox_cash' THEN $3::bigint ELSE 0 END,CASE WHEN code='merchant_payable' THEN $3::bigint ELSE 0 END FROM commerce.ledger_accounts WHERE organization_id=$2 AND code IN('sandbox_cash','merchant_payable')`,
        [j.id, x.organization_id, x.amount_minor],
      );
      await c.query(
        `UPDATE commerce.orders SET status='paid',version=version+1,updated_at=now() WHERE id=$1`,
        [id],
      );
      await notify(c, u.id, id, "order.paid");
      await c.query(
        "INSERT INTO commerce.analytics_events(user_id,organization_id,name,properties) VALUES($1,$2,'order.paid',$3)",
        [
          u.id,
          x.organization_id,
          JSON.stringify({ orderId: id, sandbox: true }),
        ],
      );
      await emit(c, "order.transitioned", {
        organizationId: x.organization_id,
        orderId: id,
        status: "paid",
      });
      return { status: "paid", sandbox: true };
    });
  }
  @Post("orders/:id/complete") async complete(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    return transaction(this.store.db.pool, async (c) => {
      const x = (
        await c.query(
          "SELECT * FROM commerce.orders WHERE id=$1 AND buyer_id=$2 FOR UPDATE",
          [uuid.parse(id), u.id],
        )
      ).rows[0];
      if (!x) throw new NotFoundException();
      if (x.status === "completed") return x;
      if (x.status !== "shipped")
        throw new ConflictException("Order is not shipped");
      await c.query(
        "UPDATE commerce.orders SET status='completed',version=version+1,updated_at=now() WHERE id=$1",
        [id],
      );
      await c.query(
        "INSERT INTO commerce.analytics_events(user_id,organization_id,name,properties) VALUES($1,$2,'order.completed',$3)",
        [u.id, x.organization_id, JSON.stringify({ orderId: id })],
      );
      await emit(c, "order.transitioned", {
        organizationId: x.organization_id,
        orderId: id,
        status: "completed",
      });
      return { ...x, status: "completed" };
    });
  }

  @Post("orders/:id/review") async review(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const u = await this.identity.actor(r),
      q = z
        .object({
          rating: z.number().int().min(1).max(5),
          body: z.string().trim().min(3).max(1000),
        })
        .strict()
        .parse(b);
    const x = (
      await this.store.db.pool.query(
        `INSERT INTO commerce.reviews(order_id,buyer_id,rating,body) SELECT id,$2,$3,$4 FROM commerce.orders WHERE id=$1 AND buyer_id=$2 AND status='completed' RETURNING *`,
        [uuid.parse(id), u.id, q.rating, q.body],
      )
    ).rows[0];
    if (!x) throw new ConflictException("Completed purchase required");
    return x;
  }
  @Get("notifications") async notifications(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.user_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
        [u.id],
      )
    ).rows;
  }
  @Put("notifications/:id/read") async read(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    await this.store.db.pool.query(
      "UPDATE commerce.user_notifications SET read_at=now() WHERE id=$1 AND user_id=$2",
      [uuid.parse(id), u.id],
    );
    return { ok: true };
  }
  @Get("support") async tickets(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.support_tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
        [u.id],
      )
    ).rows;
  }
  @Post("support") async ticket(@Req() r: FastifyRequest, @Body() b: unknown) {
    const u = await this.identity.actor(r),
      q = z
        .object({
          subject: z.string().trim().min(3).max(100),
          body: z.string().trim().min(5).max(3000),
          orderId: uuid.optional(),
        })
        .strict()
        .parse(b);
    if (
      q.orderId &&
      !(
        await this.store.db.pool.query(
          "SELECT id FROM commerce.orders WHERE id=$1 AND buyer_id=$2",
          [q.orderId, u.id],
        )
      ).rowCount
    )
      throw new NotFoundException();
    return (
      await this.store.db.pool.query(
        "INSERT INTO commerce.support_tickets(user_id,order_id,subject,body) VALUES($1,$2,$3,$4) RETURNING *",
        [u.id, q.orderId ?? null, q.subject, q.body],
      )
    ).rows[0];
  }
}
@ApiTags("seller-operations")
@ApiBearerAuth()
@Controller("v1/organizations/:org")
export class SellerOperationsController {
  constructor(
    private store: Store,
    private organizations: OrganizationsService,
  ) {}
  @Get("dashboard") async dashboard(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.organizations.require(r, org, "read");
    return (
      await this.store.db.pool.query(
        `SELECT (SELECT count(*) FROM commerce.products WHERE organization_id=$1) AS products,(SELECT count(*) FROM commerce.orders WHERE organization_id=$1) AS orders,(SELECT count(DISTINCT buyer_id) FROM commerce.orders WHERE organization_id=$1) AS customers,(SELECT coalesce(sum(amount_minor),0)::text FROM commerce.orders WHERE organization_id=$1 AND status IN('paid','fulfilling','shipped','completed')) AS sales_minor`,
        [org],
      )
    ).rows[0];
  }
  @Get("orders") async orders(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.organizations.require(r, org, "read");
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.orders WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
        [org],
      )
    ).rows;
  }
  @Get("orders/:id") async order(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    await this.organizations.require(r, org, "read");
    const x = (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.orders WHERE organization_id=$1 AND id=$2",
        [org, uuid.parse(id)],
      )
    ).rows[0];
    if (!x) throw new NotFoundException();
    return {
      ...x,
      items: (
        await this.store.db.pool.query(
          "SELECT * FROM commerce.order_items WHERE order_id=$1",
          [id],
        )
      ).rows,
    };
  }
  @Post("orders/:id/fulfill") async fulfill(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    await this.organizations.require(r, org, "inventory:write");
    const x = (
      await this.store.db.pool.query(
        `UPDATE commerce.orders SET status='fulfilling',version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND status='paid' RETURNING *`,
        [org, uuid.parse(id)],
      )
    ).rows[0];
    if (!x) throw new ConflictException("Order is not paid");
    return x;
  }
  @Post("orders/:id/ship") async ship(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({
        carrier: z.string().trim().min(2).max(80),
        trackingCode: z.string().trim().min(3).max(100),
      })
      .strict()
      .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      const u = await this.organizations.require(r, org, "inventory:write", c);
      const x = (
        await c.query(
          "SELECT * FROM commerce.orders WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [org, uuid.parse(id)],
        )
      ).rows[0];
      if (!x) throw new NotFoundException();
      if (x.status !== "fulfilling")
        throw new ConflictException("Order is not fulfilling");
      for (const i of await orderItems(c, id))
        await stock(c, i.variant_id, "ship", i.quantity, u.id);
      await c.query(
        `UPDATE commerce.orders SET status='shipped',tracking_code=$2,carrier=$3,updated_at=now(),version=version+1 WHERE id=$1`,
        [id, q.trackingCode, q.carrier],
      );
      await notify(c, x.buyer_id, id, "order.shipped");
      await emit(c, "order.transitioned", {
        organizationId: org,
        orderId: id,
        status: "shipped",
      });
      return { status: "shipped" };
    });
  }
  @ApiBody({
    schema: z.toJSONSchema(
      merchantUpdate,
    ) as import("@nestjs/swagger").SchemaObject,
  })
  @Put("merchant")
  async update(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Body() b: unknown,
  ) {
    await this.organizations.require(r, org, "merchant:write");
    const q = merchantUpdate.parse(b);
    const x = (
      await this.store.db.pool.query(
        "UPDATE commerce.merchants SET display_name=$2,bio=$3,shipping_fee_minor=$4,shipping_days=$5,return_policy=$6,updated_at=now() WHERE organization_id=$1 RETURNING *",
        [
          org,
          q.displayName,
          q.bio,
          q.shippingFeeMinor,
          q.shippingDays,
          q.returnPolicy,
        ],
      )
    ).rows[0];
    if (!x) throw new NotFoundException();
    return x;
  }
  @Post("merchant/submit") async submit(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.organizations.require(r, org, "merchant:write");
    const x = (
      await this.store.db.pool.query(
        `UPDATE commerce.merchants SET status='submitted',updated_at=now() WHERE organization_id=$1 AND status IN('draft','rejected') RETURNING *`,
        [org],
      )
    ).rows[0];
    if (!x) throw new ConflictException("Shop already submitted or approved");
    return x;
  }
  @Get("ledger") async ledger(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.organizations.require(r, org, "organization:manage");
    return (
      await this.store.db.pool.query(
        `SELECT j.id,j.reference,j.created_at,a.code,e.debit,e.credit FROM commerce.journals j JOIN commerce.ledger_entries e ON e.journal_id=j.id JOIN commerce.ledger_accounts a ON a.id=e.account_id WHERE j.organization_id=$1 ORDER BY j.created_at DESC LIMIT 100`,
        [org],
      )
    ).rows;
  }
}
@ApiTags("admin")
@ApiBearerAuth()
@Controller("v1/admin")
export class AdminController {
  constructor(
    private store: Store,
    private identity: IdentityService,
  ) {}
  async guard(r: FastifyRequest) {
    const u = await this.identity.actor(r);
    if (!this.store.config.COMMERCE_ADMIN_USER_IDS.split(",").includes(u.id))
      throw new ForbiddenException("Platform admin required");
    return u;
  }
  @Get("overview") async overview(@Req() r: FastifyRequest) {
    await this.guard(r);
    return (
      await this.store.db.pool.query(
        `SELECT (SELECT count(*) FROM commerce.users) AS users,(SELECT count(*) FROM commerce.merchants) AS merchants,(SELECT count(*) FROM commerce.products) AS products,(SELECT count(*) FROM commerce.orders) AS orders,(SELECT count(*) FROM commerce.outbox WHERE processed_at IS NULL) AS pending_events`,
      )
    ).rows[0];
  }
  @Get("merchants") async merchants(@Req() r: FastifyRequest) {
    await this.guard(r);
    return (
      await this.store.db.pool.query(
        "SELECT m.*,o.slug FROM commerce.merchants m JOIN commerce.organizations o ON o.id=m.organization_id ORDER BY m.created_at DESC LIMIT 100",
      )
    ).rows;
  }
  @Put("merchants/:id") async moderate(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    await this.guard(r);
    const q = z
      .object({ status: z.enum(["approved", "rejected"]) })
      .strict()
      .parse(b);
    const x = (
      await this.store.db.pool.query(
        `UPDATE commerce.merchants SET status=$2,updated_at=now() WHERE id=$1 AND status IN('submitted','approved','rejected') RETURNING *`,
        [uuid.parse(id), q.status],
      )
    ).rows[0];
    if (!x) throw new ConflictException("Shop must be submitted first");
    return x;
  }
  @Get("orders") async orders(@Req() r: FastifyRequest) {
    await this.guard(r);
    return (
      await this.store.db.pool.query(
        "SELECT id,status,amount_minor,organization_id,created_at FROM commerce.orders ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  }
  @Get("operations") async operations(@Req() r: FastifyRequest) {
    await this.guard(r);
    return {
      outbox: (
        await this.store.db.pool.query(
          "SELECT id,topic,created_at,published_at,processed_at FROM commerce.outbox ORDER BY created_at DESC LIMIT 100",
        )
      ).rows,
      inbox: (
        await this.store.db.pool.query(
          "SELECT id,status,created_at FROM commerce.instagram_inbox ORDER BY created_at DESC LIMIT 100",
        )
      ).rows,
    };
  }
  @Get("support") async support(@Req() r: FastifyRequest) {
    await this.guard(r);
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.support_tickets ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  }
  @Put("support/:id") async reply(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    await this.guard(r);
    const q = z
      .object({
        reply: z.string().trim().min(3).max(3000),
        status: z.enum(["open", "resolved"]),
      })
      .strict()
      .parse(b);
    return (
      await this.store.db.pool.query(
        "UPDATE commerce.support_tickets SET reply=$2,status=$3 WHERE id=$1 RETURNING *",
        [uuid.parse(id), q.reply, q.status],
      )
    ).rows[0];
  }
  @Get("analytics") async analytics(@Req() r: FastifyRequest) {
    await this.guard(r);
    return (
      await this.store.db.pool.query(
        "SELECT name,count(*)::integer AS count FROM commerce.analytics_events GROUP BY name ORDER BY name",
      )
    ).rows;
  }
}
@Module({
  imports: [IdentityModule, OrganizationsModule],
  controllers: [
    MarketplaceController,
    CustomerController,
    SellerOperationsController,
    AdminController,
  ],
})
export class ExperienceModule {}
