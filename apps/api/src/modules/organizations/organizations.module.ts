import { z } from "zod";
import {
  Body,
  Delete,
  Param,
  Put,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Post,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { can, type Permission, type Role } from "@paymoon/auth";
import { transaction, type PoolClient } from "@paymoon/db";
import { emit, idempotent } from "@paymoon/events";
import { organizationInput, uuid } from "@paymoon/validation";
import { context } from "@paymoon/observability";
import { Store } from "../../platform";
import { IdentityModule, IdentityService } from "../identity/identity.module";
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly store: Store,
    private readonly identity: IdentityService,
  ) {}
  async require(
    req: FastifyRequest,
    org: string,
    permission: Permission,
    c?: PoolClient,
  ) {
    uuid.parse(org);
    const actor = await this.identity.actor(req);
    const result = await (c ?? this.store.db.pool).query(
      "SELECT role FROM commerce.memberships WHERE organization_id=$1 AND user_id=$2" +
        (c ? " FOR SHARE" : ""),
      [org, actor.id],
    );
    if (!result.rowCount || !can(result.rows[0].role as Role, permission))
      throw new ForbiddenException();
    return actor;
  }
}
@ApiTags("organizations")
@ApiBearerAuth()
@Controller("v1/organizations")
export class OrganizationsController {
  constructor(
    private readonly store: Store,
    private readonly identity: IdentityService,
  ) {}
  @Get() async list(@Req() req: FastifyRequest) {
    const user = await this.identity.actor(req);
    return (
      await this.store.db.pool.query(
        "SELECT o.*,m.role FROM commerce.organizations o JOIN commerce.memberships m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.created_at LIMIT 100",
        [user.id],
      )
    ).rows;
  }
  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "slug"],
      properties: { name: { type: "string" }, slug: { type: "string" } },
    },
  })
  async create(@Req() req: FastifyRequest, @Body() body: unknown) {
    const user = await this.identity.actor(req);
    const input = organizationInput.parse(body);
    return transaction(this.store.db.pool, (c) =>
      idempotent(
        c,
        `organization:${user.id}`,
        String(req.headers["idempotency-key"] ?? ""),
        input,
        async () => {
          const org = (
            await c.query(
              "INSERT INTO commerce.organizations(name,slug) VALUES($1,$2) RETURNING *",
              [input.name, input.slug],
            )
          ).rows[0];
          await c.query(
            "INSERT INTO commerce.memberships(organization_id,user_id,role) VALUES($1,$2,'owner')",
            [org.id, user.id],
          );
          await emit(
            c,
            "organization.created",
            { organizationId: org.id },
            context.getStore()?.traceparent,
          );
          return org;
        },
      ),
    );
  }
}

@ApiTags("organizations")
@ApiBearerAuth()
@Controller("v1/organizations/:org/members")
export class MembershipsController {
  constructor(
    private readonly store: Store,
    private readonly organizations: OrganizationsService,
  ) {}
  @Get() async list(@Req() req: FastifyRequest, @Param("org") org: string) {
    await this.organizations.require(req, org, "organization:manage");
    return (
      await this.store.db.pool.query(
        "SELECT user_id,role FROM commerce.memberships WHERE organization_id=$1 ORDER BY user_id LIMIT 100",
        [org],
      )
    ).rows;
  }
  @Put(":user")
  @ApiBody({
    schema: {
      type: "object",
      required: ["role"],
      properties: {
        role: { type: "string", enum: ["admin", "staff", "viewer"] },
      },
    },
  })
  async assign(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
    @Param("user") user: string,
    @Body() body: unknown,
  ) {
    uuid.parse(user);
    const { role } = z
      .object({ role: z.enum(["admin", "staff", "viewer"]) })
      .strict()
      .parse(body);
    return transaction(this.store.db.pool, async (c) => {
      // Serialize all membership edits for this organization before permission evaluation.
      await c.query(
        "SELECT id FROM commerce.organizations WHERE id=$1 FOR UPDATE",
        [uuid.parse(org)],
      );
      const actor = await this.organizations.require(
        req,
        org,
        "organization:manage",
        c,
      );
      const own = (
        await c.query(
          "SELECT role FROM commerce.memberships WHERE organization_id=$1 AND user_id=$2",
          [org, actor.id],
        )
      ).rows[0];
      if (own.role !== "owner")
        throw new ForbiddenException("Only the owner can assign roles");
      const target = (
        await c.query(
          "SELECT role FROM commerce.memberships WHERE organization_id=$1 AND user_id=$2",
          [org, user],
        )
      ).rows[0];
      if (target?.role === "owner")
        throw new ConflictException(
          "Ownership transfer requires a separate flow",
        );
      await c.query(
        "INSERT INTO commerce.memberships(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role",
        [org, user, role],
      );
      return { userId: user, role };
    });
  }
  @Delete(":user") async revoke(
    @Req() req: FastifyRequest,
    @Param("org") org: string,
    @Param("user") user: string,
  ) {
    uuid.parse(user);
    return transaction(this.store.db.pool, async (c) => {
      await c.query(
        "SELECT id FROM commerce.organizations WHERE id=$1 FOR UPDATE",
        [uuid.parse(org)],
      );
      const actor = await this.organizations.require(
        req,
        org,
        "organization:manage",
        c,
      );
      const own = (
        await c.query(
          "SELECT role FROM commerce.memberships WHERE organization_id=$1 AND user_id=$2",
          [org, actor.id],
        )
      ).rows[0];
      if (own.role !== "owner") throw new ForbiddenException();
      const target = (
        await c.query(
          "SELECT role FROM commerce.memberships WHERE organization_id=$1 AND user_id=$2",
          [org, user],
        )
      ).rows[0];
      if (target?.role === "owner")
        throw new ConflictException("Cannot revoke owner");
      await c.query(
        "DELETE FROM commerce.memberships WHERE organization_id=$1 AND user_id=$2",
        [org, user],
      );
      return { ok: true };
    });
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [OrganizationsController, MembershipsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
