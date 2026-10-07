import { MediaModule } from "../media/media.module";
import { InstagramImageStorage } from "../media/instagram-image-storage";
import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Param,
  Req,
  Module,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { transaction } from "@paymoon/db";
import { emit, idempotent } from "@paymoon/events";
import { uuid } from "@paymoon/validation";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
const price = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
const patch = z
  .object({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000),
    categoryId: uuid.nullable().optional(),
    media: z
      .array(
        z
          .url()
          .refine(
            (v) =>
              new URL(v).protocol === "https:" ||
              new URL(v).hostname === "localhost" ||
              new URL(v).hostname === "127.0.0.1",
          ),
      )
      .max(10),
    variants: z
      .array(
        z
          .object({
            id: uuid.optional(),
            sku: z.string().trim().min(1).max(100),
            priceMinor: price,
            attributes: z
              .record(z.string().max(50), z.string().max(100))
              .default({}),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
@ApiTags("catalog")
@ApiBearerAuth()
@Controller("v1/organizations/:org/products")
export class ProductOperationsController {
  constructor(
    private store: Store,
    private organizations: OrganizationsService,
    private images: InstagramImageStorage,
  ) {}
  @Get(":id") async get(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    await this.organizations.require(r, org, "read");
    const p = (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.products WHERE organization_id=$1 AND id=$2",
        [org, uuid.parse(id)],
      )
    ).rows[0];
    if (!p) throw new NotFoundException();
    return {
      ...p,
      variants: (
        await this.store.db.pool.query(
          "SELECT v.*,i.available,i.reserved,i.committed FROM commerce.variants v JOIN commerce.inventory i ON i.variant_id=v.id WHERE product_id=$1 ORDER BY sku",
          [id],
        )
      ).rows,
    };
  }
  @Put(":id") async update(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const q = patch.parse(b);
    return transaction(this.store.db.pool, async (c) => {
      await this.organizations.require(r, org, "catalog:write", c);
      const p = (
        await c.query(
          "SELECT * FROM commerce.products WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [org, uuid.parse(id)],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      if (p.version !== q.version)
        throw new ConflictException("Product changed; reload");
      const existing = (
        await c.query("SELECT id FROM commerce.variants WHERE product_id=$1", [
          id,
        ])
      ).rows.map((v) => v.id);
      if (existing.some((v) => !q.variants.some((x) => x.id === v)))
        throw new ConflictException("Existing variants must be retained");
      if (new Set(q.variants.map((v) => v.sku)).size !== q.variants.length)
        throw new ConflictException("Duplicate SKU");
      if (
        p.status === "published" &&
        (q.media.length === 0 ||
          q.variants.some((v) => BigInt(v.priceMinor) <= 0n))
      )
        throw new ConflictException("Published prices must be positive");
      await c.query(
        "UPDATE commerce.products SET title=$2,description=$3,category_id=$4,media=$5,version=version+1,updated_at=now() WHERE id=$1",
        [
          id,
          q.title,
          q.description,
          q.categoryId ?? null,
          JSON.stringify(q.media),
        ],
      );
      for (const v of q.variants) {
        if (v.id) {
          if (!existing.includes(v.id))
            throw new ConflictException(
              "Variant does not belong to this product",
            );
          await c.query(
            "UPDATE commerce.variants SET sku=$2,price_minor=$3,attributes=$4 WHERE id=$1",
            [v.id, v.sku, v.priceMinor, v.attributes],
          );
        } else {
          const x = (
            await c.query(
              "INSERT INTO commerce.variants(organization_id,product_id,sku,price_minor,attributes) VALUES($1,$2,$3,$4,$5) RETURNING id",
              [org, id, v.sku, v.priceMinor, v.attributes],
            )
          ).rows[0];
          await c.query(
            "INSERT INTO commerce.inventory(variant_id) VALUES($1)",
            [x.id],
          );
        }
      }
      return { id, version: q.version + 1 };
    });
  }
  @Post(":id/persist-instagram-images") async persist(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    await this.organizations.require(r, org, "catalog:write");
    const product = (
      await this.store.db.pool.query(
        "SELECT * FROM commerce.products WHERE organization_id=$1 AND id=$2",
        [org, uuid.parse(id)],
      )
    ).rows[0];
    if (!product?.source_media_id)
      throw new ConflictException("Instagram source required");
    const input = product.media as string[];
    const output: string[] = [];
    for (const url of input) {
      if (this.images.isStored(url)) output.push(url);
      else output.push(await this.images.copy(url));
    }
    return transaction(this.store.db.pool, async (c) => {
      await this.organizations.require(r, org, "catalog:write", c);
      const changed = await c.query(
        "UPDATE commerce.products SET media=$3,version=version+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND version=$4 RETURNING id",
        [id, org, JSON.stringify(output), product.version],
      );
      if (!changed.rowCount)
        throw new ConflictException("Product changed; reload");
      return { id, media: output };
    });
  }
  @Post(":id/status") async status(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({
        status: z.enum(["draft", "published", "archived"]),
        version: z.number().int().min(1),
      })
      .strict()
      .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      const u = await this.organizations.require(r, org, "catalog:write", c);
      const p = (
        await c.query(
          "SELECT * FROM commerce.products WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [org, uuid.parse(id)],
        )
      ).rows[0];
      if (!p) throw new NotFoundException();
      if (p.version !== q.version)
        throw new ConflictException("Product changed; reload");
      if (q.status === "published" && p.status !== "published") {
        const variants = (
          await c.query(
            "SELECT price_minor FROM commerce.variants WHERE product_id=$1 FOR SHARE",
            [id],
          )
        ).rows;
        if (
          !variants.length ||
          variants.some((v) => BigInt(v.price_minor) <= 0n) ||
          !p.media.length
        )
          throw new ConflictException(
            "Positive prices and at least one image required",
          );
        const m = (
          await c.query(
            "SELECT status FROM commerce.merchants WHERE organization_id=$1 FOR SHARE",
            [org],
          )
        ).rows[0];
        if (m?.status !== "approved")
          throw new ConflictException("Shop approval required");
        await c.query(
          `INSERT INTO commerce.analytics_events(user_id,organization_id,name,properties) VALUES($1,$2,'product.published',$3)`,
          [u.id, org, JSON.stringify({ productId: id })],
        );
      }
      await c.query(
        "UPDATE commerce.products SET status=$2,version=version+1,updated_at=now() WHERE id=$1",
        [id, q.status],
      );
      await emit(c, "product.created", {
        organizationId: org,
        productId: id,
        status: q.status,
      });
      return { id, status: q.status, version: q.version + 1 };
    });
  }
}
@ApiTags("instagram")
@ApiBearerAuth()
@Controller("v1/organizations/:org/instagram")
export class InstagramImportController {
  constructor(
    private store: Store,
    private organizations: OrganizationsService,
  ) {}
  @Post("import") async importPosts(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({ mediaIds: z.array(z.string().regex(/^\d+$/)).min(1).max(25) })
      .strict()
      .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      const u = await this.organizations.require(r, org, "catalog:write", c);
      return idempotent(
        c,
        `instagram-import:${org}:${u.id}`,
        String(r.headers["idempotency-key"] ?? ""),
        q,
        async () => {
          const results = [];
          for (const mediaId of [...new Set(q.mediaIds)].sort()) {
            const source = (
              await c.query(
                "SELECT payload FROM commerce.instagram_media WHERE organization_id=$1 AND media_id=$2 FOR SHARE",
                [org, mediaId],
              )
            ).rows[0];
            if (!source)
              throw new NotFoundException("Sync the selected media first");
            const m = source.payload;
            const urls = [
              ...(m.media_type === "IMAGE" && m.media_url
                ? [m.media_url]
                : m.thumbnail_url
                  ? [m.thumbnail_url]
                  : []),
              ...(m.children?.data ?? [])
                .map(
                  (x: {
                    media_type: string;
                    media_url?: string;
                    thumbnail_url?: string;
                  }) =>
                    x.media_type === "IMAGE" ? x.media_url : x.thumbnail_url,
                )
                .filter(Boolean),
            ].slice(0, 10);
            const p = (
              await c.query(
                `INSERT INTO commerce.products(organization_id,title,description,media,source_media_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,source_media_id) WHERE source_media_id IS NOT NULL DO NOTHING RETURNING *`,
                [
                  org,
                  String(m.caption ?? "محصول واردشده")
                    .split("\n")[0]!
                    .slice(0, 200) || "محصول واردشده",
                  String(m.caption ?? "").slice(0, 5000),
                  JSON.stringify(urls),
                  mediaId,
                ],
              )
            ).rows[0];
            if (p) {
              const v = (
                await c.query(
                  "INSERT INTO commerce.variants(organization_id,product_id,sku,price_minor) VALUES($1,$2,$3,0) RETURNING id",
                  [org, p.id, "IG-" + mediaId],
                )
              ).rows[0];
              await c.query(
                "INSERT INTO commerce.inventory(variant_id) VALUES($1)",
                [v.id],
              );
              await emit(c, "product.created", {
                organizationId: org,
                productId: p.id,
                source: "instagram",
              });
              results.push(p);
            } else
              results.push(
                (
                  await c.query(
                    "SELECT * FROM commerce.products WHERE organization_id=$1 AND source_media_id=$2",
                    [org, mediaId],
                  )
                ).rows[0],
              );
          }
          await c.query(
            `INSERT INTO commerce.analytics_events(user_id,organization_id,name,properties) VALUES($1,$2,'instagram.imported',$3)`,
            [u.id, org, JSON.stringify({ selected_count: q.mediaIds.length })],
          );
          return results;
        },
      );
    });
  }
}
@Module({
  imports: [OrganizationsModule, MediaModule],
  controllers: [ProductOperationsController, InstagramImportController],
})
export class CatalogOperationsModule {}
