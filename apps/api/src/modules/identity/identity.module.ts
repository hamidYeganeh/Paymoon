import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import {
  hashPassword,
  hashToken,
  sessionToken,
  verifyPassword,
} from "@paymoon/auth";
import { credentials } from "@paymoon/validation";
import { transaction } from "@paymoon/db";
import { Store } from "../../platform";
@Injectable()
export class IdentityService {
  constructor(private readonly store: Store) {}
  async actor(req: FastifyRequest) {
    const token = req.headers.authorization?.match(
      /^Bearer ([A-Za-z0-9_-]{43})$/,
    )?.[1];
    if (!token) throw new UnauthorizedException();
    const result = await this.store.db.pool.query(
      "SELECT u.id,u.email FROM commerce.sessions s JOIN commerce.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hashToken(token)],
    );
    if (!result.rowCount) throw new UnauthorizedException();
    return result.rows[0] as { id: string; email: string };
  }
  async login(body: unknown, register = false) {
    const input = credentials.parse(body);
    const token = sessionToken();
    const hash = register ? await hashPassword(input.password) : undefined;
    return transaction(this.store.db.pool, async (c) => {
      let user: { id: string; email: string; password_hash: string };
      if (register) {
        user = (
          await c.query(
            "INSERT INTO commerce.users(email,password_hash) VALUES($1,$2) RETURNING id,email,password_hash",
            [input.email, hash],
          )
        ).rows[0];
      } else {
        user = (
          await c.query(
            "SELECT id,email,password_hash FROM commerce.users WHERE email=$1",
            [input.email],
          )
        ).rows[0];
        if (!(await verifyPassword(input.password, user?.password_hash)))
          throw new UnauthorizedException("Invalid credentials");
      }
      await c.query(
        "INSERT INTO commerce.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours')",
        [hashToken(token), user.id],
      );
      return {
        token,
        expiresIn: 86400,
        user: { id: user.id, email: user.email },
      };
    });
  }
  async logout(req: FastifyRequest) {
    await this.actor(req);
    await this.store.db.pool.query(
      "DELETE FROM commerce.sessions WHERE token_hash=$1",
      [hashToken(req.headers.authorization!.slice(7))],
    );
    return { ok: true };
  }
}
const authBody: import("@nestjs/swagger").ApiBodyOptions = {
  schema: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 12, maxLength: 128 },
    },
  },
};
@ApiTags("identity")
@Controller("v1/identity")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}
  @Post("register") @ApiBody(authBody) register(@Body() body: unknown) {
    return this.identity.login(body, true);
  }
  @Post("login") @ApiBody(authBody) login(@Body() body: unknown) {
    return this.identity.login(body);
  }
  @Get("me") @ApiBearerAuth() me(@Req() req: FastifyRequest) {
    return this.identity.actor(req);
  }
  @Delete("session") @ApiBearerAuth() logout(@Req() req: FastifyRequest) {
    return this.identity.logout(req);
  }
}
@Module({
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
