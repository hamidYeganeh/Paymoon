import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Put,
  Query,
  Req,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiBody } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { transaction, type PoolClient } from "@paymoon/db";
import { idempotent } from "@paymoon/events";
import { uuid } from "@paymoon/validation";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
import { IdentityModule, IdentityService } from "../identity/identity.module";
@ApiTags("team-inbox")
@ApiBearerAuth()
@Controller("v1")
export class InboxController {
  constructor(
    private store: Store,
    private orgs: OrganizationsService,
    private identity: IdentityService,
  ) {}
  private async access(
    r: FastifyRequest,
    id: string,
    org?: string,
    c?: PoolClient,
  ) {
    uuid.parse(id);
    const db = c ?? this.store.db.pool;
    const u = await this.identity.actor(r);
    const thread = (
      await db.query("SELECT * FROM commerce.conversations WHERE id=$1", [id])
    ).rows[0];
    if (!thread) throw new NotFoundException();
    if (org) {
      await this.orgs.require(r, org, "catalog:write", c);
      if (thread.organization_id !== org) throw new NotFoundException();
    } else if (thread.buyer_id !== u.id) throw new NotFoundException();
    return { u, thread };
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["merchantId"],
      properties: { merchantId: { type: "string", format: "uuid" } },
    },
  })
  @Post("me/conversations")
  async start(@Req() r: FastifyRequest, @Body() b: unknown) {
    const u = await this.identity.actor(r),
      q = z.object({ merchantId: uuid }).strict().parse(b);
    return transaction(this.store.db.pool, async (c) => {
      const shop = (
        await c.query(
          "SELECT organization_id FROM commerce.merchants WHERE id=$1 AND status='approved' FOR SHARE",
          [q.merchantId],
        )
      ).rows[0];
      if (!shop) throw new NotFoundException();
      return (
        await c.query(
          "INSERT INTO commerce.conversations(organization_id,buyer_id) VALUES($1,$2) ON CONFLICT(organization_id,buyer_id) DO UPDATE SET buyer_id=excluded.buyer_id RETURNING *",
          [shop.organization_id, u.id],
        )
      ).rows[0];
    });
  }
  @Get("me/conversations") async mine(@Req() r: FastifyRequest) {
    const u = await this.identity.actor(r);
    return (
      await this.store.db.pool.query(
        "SELECT c.id,c.status,c.updated_at,m.display_name FROM commerce.conversations c JOIN commerce.merchants m ON m.organization_id=c.organization_id WHERE c.buyer_id=$1 ORDER BY c.updated_at DESC LIMIT 100",
        [u.id],
      )
    ).rows;
  }
  @Get("organizations/:org/operators") async operators(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.orgs.require(r, org, "catalog:write");
    return (
      await this.store.db.pool.query(
        "SELECT m.user_id,u.email FROM commerce.memberships m JOIN commerce.users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.role IN('owner','admin','staff') ORDER BY u.email LIMIT 100",
        [org],
      )
    ).rows;
  }
  @Get("organizations/:org/conversations") async list(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
  ) {
    await this.orgs.require(r, org, "catalog:write");
    return (
      await this.store.db.pool.query(
        "SELECT c.id,c.status,c.updated_at,c.assigned_to, u.email AS display_name FROM commerce.conversations c JOIN commerce.users u ON u.id=c.buyer_id WHERE c.organization_id=$1 ORDER BY c.updated_at DESC LIMIT 100",
        [org],
      )
    ).rows;
  }
  @Get("me/conversations/:id/messages") async mineMessages(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Query() q: unknown,
  ) {
    return this.messages(r, id, q);
  }
  @Get("organizations/:org/conversations/:id/messages") async orgMessages(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Query() q: unknown,
  ) {
    return this.messages(r, id, q, org);
  }
  private async messages(
    r: FastifyRequest,
    id: string,
    q: unknown,
    org?: string,
  ) {
    await this.access(r, id, org);
    const { offset } = z
      .object({ offset: z.coerce.number().int().min(0).max(10000).default(0) })
      .parse(q);
    return (
      await this.store.db.pool.query(
        "SELECT id,author_id,body,created_at FROM commerce.conversation_messages WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET $2",
        [id, offset],
      )
    ).rows.reverse();
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["body"],
      properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
    },
  })
  @Post("me/conversations/:id/messages")
  async mineSend(
    @Req() r: FastifyRequest,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.send(r, id, b);
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["body"],
      properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
    },
  })
  @Post("organizations/:org/conversations/:id/messages")
  async orgSend(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.send(r, id, b, org);
  }
  private async send(r: FastifyRequest, id: string, b: unknown, org?: string) {
    const q = z
      .object({ body: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      const { u, thread } = await this.access(r, id, org, c);
      return idempotent(
        c,
        `message:${id}:${u.id}`,
        String(r.headers["idempotency-key"] ?? ""),
        q,
        async () => {
          await c.query(
            "UPDATE commerce.conversations SET updated_at=now(),status='open' WHERE id=$1",
            [id],
          );
          const message = (
            await c.query(
              "INSERT INTO commerce.conversation_messages(conversation_id,author_id,body) VALUES($1,$2,$3) RETURNING *",
              [id, u.id, q.body],
            )
          ).rows[0];
          if (org)
            await c.query(
              "INSERT INTO commerce.user_notifications(user_id,kind,title,body) VALUES($1,'message.received',$2,'پیام تازه در صندوق پیام‌های پی‌مون دارید.')",
              [thread.buyer_id, "پاسخ فروشگاه"],
            );
          return message;
        },
      );
    });
  }
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "assignedTo"],
      properties: {
        status: { type: "string", enum: ["open", "pending", "resolved"] },
        assignedTo: { type: "string", format: "uuid", nullable: true },
      },
    },
  })
  @Put("organizations/:org/conversations/:id")
  async assign(
    @Req() r: FastifyRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const q = z
      .object({
        status: z.enum(["open", "pending", "resolved"]),
        assignedTo: uuid.nullable(),
      })
      .strict()
      .parse(b);
    return transaction(this.store.db.pool, async (c) => {
      await this.access(r, id, org, c);
      if (q.assignedTo) {
        const member = (
          await c.query(
            "SELECT user_id FROM commerce.memberships WHERE organization_id=$1 AND user_id=$2 AND role IN('owner','admin','staff') FOR SHARE",
            [org, q.assignedTo],
          )
        ).rows[0];
        if (!member)
          throw new ForbiddenException("Assignee must be a current operator");
      }
      return (
        await c.query(
          "UPDATE commerce.conversations SET status=$2,assigned_to=$3,updated_at=now() WHERE id=$1 RETURNING *",
          [id, q.status, q.assignedTo],
        )
      ).rows[0];
    });
  }
}
@Module({
  imports: [OrganizationsModule, IdentityModule],
  controllers: [InboxController],
})
export class InboxModule {}
