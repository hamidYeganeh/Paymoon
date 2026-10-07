import { Controller, Get, Module, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { uuid } from "@paymoon/validation";
import { Store } from "../../platform";
@ApiTags("discovery")
@Controller("v1/discovery")
export class DiscoveryController {
  constructor(private store: Store) {}
  @Get("shops") async shops(@Query() q: unknown) {
    const input = z
      .object({
        q: z.string().max(100).default(""),
        sort: z.enum(["newest", "popular"]).default("newest"),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
      })
      .parse(q);
    return (
      await this.store.db.pool.query(
        `SELECT m.id,m.display_name,m.bio,m.shipping_days,m.shipping_fee_minor,o.slug,(SELECT count(*) FROM commerce.products p WHERE p.organization_id=o.id AND p.status='published') AS product_count,(SELECT count(*) FROM commerce.followed_merchants f WHERE f.merchant_id=m.id) AS followers_count FROM commerce.merchants m JOIN commerce.organizations o ON o.id=m.organization_id WHERE m.status='approved' AND (m.display_name ILIKE '%'||$1||'%' OR m.bio ILIKE '%'||$1||'%') ORDER BY ${input.sort === "popular" ? "followers_count DESC," : ""}m.created_at DESC,m.id LIMIT 25 OFFSET $2`,
        [input.q, input.offset],
      )
    ).rows;
  }
  @Get("instagram-link") async link(@Query() q: unknown) {
    const { url } = z
      .object({
        url: z
          .url()
          .max(2048)
          .refine((v) => {
            const u = new URL(v);
            return (
              u.protocol === "https:" &&
              ["instagram.com", "www.instagram.com"].includes(u.hostname) &&
              /^\/(p|reel)\/[^/]+\/?$/.test(u.pathname)
            );
          }),
      })
      .parse(q);
    const path = new URL(url).pathname.replace(/\/$/, "");
    return (
      await this.store.db.pool.query(
        `SELECT p.id,p.title,p.media,m.display_name,o.slug FROM commerce.instagram_media ig JOIN commerce.products p ON p.organization_id=ig.organization_id AND p.source_media_id=ig.media_id JOIN commerce.organizations o ON o.id=p.organization_id JOIN commerce.merchants m ON m.organization_id=o.id WHERE p.status='published' AND m.status='approved' AND regexp_replace(split_part(ig.payload->>'permalink','?',1),'^https://(www\\.)?instagram\\.com|/$','','g')=$1 LIMIT 25`,
        [path],
      )
    ).rows;
  }
  @Get("products/:id/similar") async similar(@Param("id") id: string) {
    uuid.parse(id);
    return (
      await this.store.db.pool.query(
        `SELECT p.id,p.title,p.media,m.display_name,m.shipping_days,m.shipping_fee_minor,o.slug,(SELECT min(price_minor)::text FROM commerce.variants WHERE product_id=p.id AND price_minor>0) AS price_minor FROM commerce.products p JOIN commerce.merchants m ON m.organization_id=p.organization_id JOIN commerce.organizations o ON o.id=p.organization_id WHERE p.status='published' AND m.status='approved' AND (SELECT count(*) FROM commerce.products a JOIN commerce.merchants b ON b.organization_id=a.organization_id WHERE a.id=$1 AND a.status='published' AND b.status='approved')>0 AND p.id<>$1 AND p.category_id=(SELECT category_id FROM commerce.products WHERE id=$1) ORDER BY p.created_at DESC,p.id LIMIT 12`,
        [id],
      )
    ).rows;
  }
}
@Module({ controllers: [DiscoveryController] })
export class DiscoveryModule {}
