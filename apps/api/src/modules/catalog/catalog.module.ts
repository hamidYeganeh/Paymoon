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
import { productInput } from "@paymoon/validation";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
@ApiTags("catalog")
@ApiBearerAuth()
@Controller("v1/organizations/:org/products")
export class CatalogController {
  constructor(
    private readonly store: Store,
    private readonly organizations: OrganizationsService,
  ) {}
  @Get() async list(@Req() req: FastifyRequest, @Param("org") org: string) {
    await this.organizations.require(req, org, "read");
    return (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.products WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
        [org],
      )
    ).rows;
  }
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["title", "variants"],
      properties: {
        title: { type: "string" },
        categoryId: { type: "string", format: "uuid" },
        variants: {
          type: "array",
          items: {
            type: "object",
            required: ["sku", "priceMinor"],
            properties: {
              sku: { type: "string" },
              priceMinor: { type: "string" },
              attributes: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
        },
      },
    },
  })
  async create(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
    @Body() body: unknown,
  ) {
    const input = productInput.parse(body);
    return transaction(this.store.db.pool, async (c) => {
      const actor = await this.organizations.require(
        req,
        org,
        "catalog:write",
        c,
      );
      return idempotent(
        c,
        `product:${org}:${actor.id}`,
        String(req.headers["idempotency-key"] ?? ""),
        input,
        async () => {
          const product = (
            await c.query(
              "INSERT INTO commerce.products(organization_id,title,category_id) VALUES($1,$2,$3) RETURNING *",
              [org, input.title, input.categoryId ?? null],
            )
          ).rows[0];
          const variants = [];
          for (const v of input.variants) {
            const variant = (
              await c.query(
                "INSERT INTO commerce.variants(organization_id,product_id,sku,attributes,price_minor) VALUES($1,$2,$3,$4,$5) RETURNING *",
                [org, product.id, v.sku, v.attributes, v.priceMinor],
              )
            ).rows[0];
            await c.query(
              "INSERT INTO commerce.inventory(variant_id) VALUES($1)",
              [variant.id],
            );
            variants.push(variant);
          }
          await emit(c, "product.created", {
            organizationId: org,
            productId: product.id,
          });
          return { ...product, variants };
        },
      );
    });
  }
}
@ApiTags("catalog")
@Controller("v1/categories")
export class CategoriesController {
  constructor(private readonly store: Store) {}
  @Get() list() {
    return this.store.db.orm.query.categories.findMany({ limit: 100 });
  }
}
@Module({
  imports: [OrganizationsModule],
  controllers: [CatalogController, CategoriesController],
})
export class CatalogModule {}
