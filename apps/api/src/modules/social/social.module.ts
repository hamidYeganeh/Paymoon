import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Module,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { transaction } from "@paymoon/db";
import { idempotent, emit } from "@paymoon/events";
import { uuid } from "@paymoon/validation";
import { Store } from "../../platform";
import { IdentityModule, IdentityService } from "../identity/identity.module";
@ApiTags("social")
@Controller("v1")
export class SocialController {
  constructor(
    private store: Store,
    private identity: IdentityService,
  ) {}
  private async product(id: string) {
    const p = (
      await this.store.db.pool.query(
        "SELECT p.id,p.organization_id FROM commerce.products p JOIN commerce.merchants m ON m.organization_id=p.organization_id WHERE p.id=$1 AND p.status='published' AND m.status='approved'",
        [uuid.parse(id)],
      )
    ).rows[0];
    if (!p) throw new NotFoundException("Product unavailable");
    return p;
  }
  @Get("marketplace/products/:id/activity") async activity(
    @Param("id") id: string,
  ) {
    await this.product(id);
    return (
      await this.store.db.pool.query(
        "SELECT (SELECT count(*)::int FROM commerce.product_likes WHERE product_id=$1) AS likes,(SELECT count(*)::int FROM commerce.product_comments WHERE product_id=$1 AND deleted_at IS NULL) AS comments",
        [id],
      )
    ).rows[0];
  }
  @Get("me/likes") @ApiBearerAuth() async likes(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT product_id FROM commerce.product_likes WHERE user_id=$1",
        [u.id],
      )
    ).rows;
  }
  @Put("me/likes/:id") @ApiBearerAuth() async like(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    await this.product(id);
    await this.store.db.pool.query(
      "INSERT INTO commerce.product_likes(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [u.id, id],
    );
    return { liked: true };
  }
  @Delete("me/likes/:id") @ApiBearerAuth() async unlike(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
  ) {
    const u = await this.identity.actor(r);
    await this.store.db.pool.query(
      "DELETE FROM commerce.product_likes WHERE user_id=$1 AND product_id=$2",
      [u.id, uuid.parse(id)],
    );
    return { liked: false };
  }
  @Get("marketplace/products/:id/comments") async comments(
    @Param("id") id: string,
    @Query() b: unknown,
  ) {
    await this.product(id);
    const q = z
      .object({ offset: z.coerce.number().int().min(0).max(10000).default(0) })
      .parse(b);
    return (
      await this.store.db.pool.query(
        "SELECT c.id,c.body,c.author_id,c.created_at,concat('کاربر ',left(c.author_id::text,6)) AS author_name FROM commerce.product_comments c WHERE c.product_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at,c.id LIMIT 30 OFFSET $2",
        [id, q.offset],
      )
    ).rows;
  }
  @Post("marketplace/products/:id/comments") @ApiBearerAuth() async comment(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const u = await this.identity.actor(r);
    const p = await this.product(id);
    const q = z
      .object({ body: z.string().trim().min(1).max(1000) })
      .strict()
      .parse(b);
    const key = r.headers["idempotency-key"];
    if (typeof key !== "string" || key.length < 8 || key.length > 200)
      throw new BadRequestException("Idempotency-Key required");
    return transaction(this.store.db.pool, (c) =>
      idempotent(c, `social:comment:${u.id}:${id}`, key, q, async () => {
        const row = (
          await c.query(
            "INSERT INTO commerce.product_comments(product_id,author_id,body) VALUES($1,$2,$3) RETURNING id,body,author_id,created_at",
            [id, u.id, q.body],
          )
        ).rows[0];
        await emit(c, "product.commented", {
          organizationId: p.organization_id,
          productId: id,
          commentId: row.id,
        });
        return row;
      }),
    );
  }
  @Delete("marketplace/products/:id/comments/:comment")
  @ApiBearerAuth()
  async remove(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Param("comment") comment: string,
  ) {
    const u = await this.identity.actor(r);
    const row = (
      await this.store.db.pool.query(
        "SELECT author_id FROM commerce.product_comments WHERE id=$1 AND product_id=$2 AND deleted_at IS NULL",
        [uuid.parse(comment), uuid.parse(id)],
      )
    ).rows[0];
    if (!row) throw new NotFoundException();
    if (
      row.author_id !== u.id &&
      !this.store.config.COMMERCE_ADMIN_USER_IDS.split(",")
        .map((s) => s.trim())
        .includes(u.id)
    )
      throw new ForbiddenException();
    await this.store.db.pool.query(
      "UPDATE commerce.product_comments SET deleted_at=now() WHERE id=$1",
      [comment],
    );
    return { deleted: true };
  }
}
@Module({ imports: [IdentityModule], controllers: [SocialController] })
export class SocialModule {}
