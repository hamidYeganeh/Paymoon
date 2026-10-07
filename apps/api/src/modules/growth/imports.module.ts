import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Req,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiBody } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { transaction, type PoolClient } from "@paymoon/db";
import { emit, idempotent } from "@paymoon/events";
import { parseProductCsv, type ProductCsvRow } from "@paymoon/validation";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
const fixtures = [
  {
    id: "jacket",
    title: "ژاکت روزمره — پست آزمایشی",
    description:
      "نمونهٔ دمو برای تمرین ورود پست. رنگ و سایز و قیمت را بعد از ورود بررسی کنید.",
    image: "jacket.png",
  },
  {
    id: "sneaker",
    title: "کتانی سفید — پست آزمایشی",
    description:
      "نمونهٔ آزمایشی کتانی؛ داده‌ای از حساب Instagram دریافت نشده است.",
    image: "sneaker.png",
  },
  {
    id: "mug",
    title: "ماگ سرامیکی — پست آزمایشی",
    description:
      "نمونهٔ آزمایشی محصول خانه. قیمت و موجودی نیاز به تکمیل دارند.",
    image: "mug.png",
  },
];
async function createDraft(
  c: PoolClient,
  org: string,
  actor: string,
  rows: ProductCsvRow[],
) {
  const first = rows[0]!;
  if (rows.some((x) => x.title !== first.title))
    throw new ConflictException("Variant titles must match");
  const media = [...new Set(rows.map((x) => x.imageUrl).filter(Boolean))].slice(
    0,
    10,
  );
  const p = (
    await c.query(
      "INSERT INTO commerce.products(organization_id,title,description,media) VALUES($1,$2,$3,$4) RETURNING *",
      [org, first.title, first.description, JSON.stringify(media)],
    )
  ).rows[0];
  for (const r of rows) {
    const attributes = {
      ...(r.color ? { color: r.color } : {}),
      ...(r.size ? { size: r.size } : {}),
    };
    const v = (
      await c.query(
        "INSERT INTO commerce.variants(organization_id,product_id,sku,price_minor,attributes) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [org, p.id, r.sku, (BigInt(r.priceToman) * 10n).toString(), attributes],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO commerce.inventory(variant_id,available) VALUES($1,$2)",
      [v.id, r.quantity],
    );
    if (r.quantity)
      await c.query(
        "INSERT INTO commerce.stock_movements(variant_id,kind,quantity,actor_id) VALUES($1,'receive',$2,$3)",
        [v.id, r.quantity, actor],
      );
  }
  await emit(c, "product.created", {
    organizationId: org,
    productId: p.id,
    source: "bulk-import",
  });
  return p;
}
@ApiTags("product-import")
@ApiBearerAuth()
@Controller("v1/organizations/:org")
export class ImportsController {
  constructor(
    private store: Store,
    private orgs: OrganizationsService,
  ) {}
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["csv"],
      properties: { csv: { type: "string", maxLength: 250000 } },
    },
  })
  @Post("products/import-csv/preview")
  async preview(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Body() b: unknown,
  ) {
    await this.orgs.require(r, org, "catalog:write");
    const { csv } = z
      .object({ csv: z.string().max(250000) })
      .strict()
      .parse(b);
    try {
      return { rows: parseProductCsv(csv) };
    } catch {
      throw new BadRequestException("Invalid CSV");
    }
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["csv"],
      properties: { csv: { type: "string", maxLength: 250000 } },
    },
  })
  @Post("products/import-csv")
  async import(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Body() b: unknown,
  ) {
    const { csv } = z
      .object({ csv: z.string().max(250000) })
      .strict()
      .parse(b);
    let rows: ProductCsvRow[];
    try {
      rows = parseProductCsv(csv);
    } catch {
      throw new ConflictException("Invalid CSV; check preview");
    }
    return transaction(this.store.db.pool, async (c) => {
      const u = await this.orgs.require(r, org, "catalog:write", c);
      return idempotent(
        c,
        `csv:${org}:${u.id}`,
        String(r.headers["idempotency-key"] ?? ""),
        { csv },
        async () => {
          const groups = new Map<string, ProductCsvRow[]>();
          for (const row of rows)
            groups.set(row.title, [...(groups.get(row.title) ?? []), row]);
          const result = [];
          for (const group of groups.values())
            result.push(await createDraft(c, org, u.id, group));
          return { products: result, variants: rows.length };
        },
      );
    });
  }
  private demoAllowed() {
    if (this.store.config.COMMERCE_ENVIRONMENT === "production")
      throw new ForbiddenException("Demo disabled in production");
  }
  @Get("demo/instagram") async demo(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    this.demoAllowed();
    await this.orgs.require(r, org, "catalog:write");
    return {
      demo: true,
      posts: fixtures.map((x) => ({
        ...x,
        imageUrl: `https://paymoon-seller.vercel.app/assets/${x.image}`,
      })),
    };
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["postIds"],
      properties: {
        postIds: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "string", enum: ["jacket", "sneaker", "mug"] },
        },
      },
    },
  })
  @Post("demo/instagram/import")
  async importDemo(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Body() b: unknown,
  ) {
    this.demoAllowed();
    const q = z
      .object({
        postIds: z
          .array(z.enum(["jacket", "sneaker", "mug"]))
          .min(1)
          .max(3),
      })
      .strict()
      .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      const u = await this.orgs.require(r, org, "catalog:write", c);
      return idempotent(
        c,
        `demo:${org}:${u.id}`,
        String(r.headers["idempotency-key"] ?? ""),
        q,
        async () => {
          const result = [];
          for (const id of [...new Set(q.postIds)]) {
            const x = fixtures.find((x) => x.id === id)!;
            const sku = "DEMO-" + id.toUpperCase();
            const old = (
              await c.query(
                "SELECT p.* FROM commerce.products p JOIN commerce.variants v ON v.product_id=p.id WHERE v.organization_id=$1 AND v.sku=$2",
                [org, sku],
              )
            ).rows[0];
            if (old) {
              result.push(old);
              continue;
            }
            result.push(
              await createDraft(c, org, u.id, [
                {
                  title: x.title,
                  description: x.description,
                  sku,
                  priceToman: "0",
                  quantity: 0,
                  imageUrl: `https://paymoon-seller.vercel.app/assets/${x.image}`,
                  color: "",
                  size: "",
                },
              ]),
            );
          }
          return { demo: true, products: result };
        },
      );
    });
  }
}
@Module({ imports: [OrganizationsModule], controllers: [ImportsController] })
export class ImportsModule {}
