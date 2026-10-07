import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { can, hashToken } from "@paymoon/auth";
import { transaction, type PoolClient } from "@paymoon/db";
import { emit } from "@paymoon/events";
import { IdentityService } from "../identity/identity.module";
import { Store } from "../../platform";
import { OrganizationsService } from "../organizations/organizations.module";
import { MetaApiError, MetaInstagramAdapter } from "./meta.adapter";
import { decryptToken, encryptToken } from "./token-vault";
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
const COOKIE = "__Host-paymoon-instagram";
type OAuthState = {
  organization_id: string;
  user_id: string;
  session_hash: string;
  scopes: string[];
};
type Connection = {
  organization_id: string;
  account_id: string;
  username: string;
  token_ciphertext: string;
  scopes: string[];
  expires_at: Date;
  refreshed_at: Date;
  version: number;
};
@Injectable()
export class InstagramService {
  constructor(
    private readonly store: Store,
    private readonly organizations: OrganizationsService,
    private readonly identity: IdentityService,
  ) {}
  private configured() {
    const c = this.store.config;
    if (
      !c.INSTAGRAM_APP_ID ||
      !c.INSTAGRAM_APP_SECRET ||
      !c.INSTAGRAM_REDIRECT_URI ||
      !c.INSTAGRAM_API_VERSION ||
      !c.INSTAGRAM_TOKEN_ENCRYPTION_KEY
    )
      throw new ServiceUnavailableException("Instagram is not configured");
    return {
      appId: c.INSTAGRAM_APP_ID,
      appSecret: c.INSTAGRAM_APP_SECRET,
      redirectUri: c.INSTAGRAM_REDIRECT_URI,
      version: c.INSTAGRAM_API_VERSION,
      scopes: c.INSTAGRAM_SCOPES.split(",").map((v) => v.trim()),
      key: c.INSTAGRAM_TOKEN_ENCRYPTION_KEY,
    };
  }
  adapter() {
    return new MetaInstagramAdapter(this.configured());
  }
  private async provider<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof MetaApiError && e.code === 190)
        throw new ConflictException(
          "Instagram authorization expired or revoked; reconnect",
        );
      if (e instanceof MetaApiError && e.retryable)
        throw new ServiceUnavailableException(
          "Instagram temporarily unavailable; retry later",
        );
      throw new BadGatewayException("Instagram request failed");
    }
  }
  async begin(req: FastifyRequest, reply: FastifyReply, org: string) {
    const config = this.configured(),
      state = randomBytes(32).toString("base64url"),
      browser = randomBytes(32).toString("base64url");
    await transaction(this.store.db.pool, async (c) => {
      const actor = await this.organizations.require(
        req,
        org,
        "merchant:write",
        c,
      );
      await c.query(
        "DELETE FROM commerce.instagram_oauth_states WHERE expires_at<now()",
      );
      await c.query(
        "INSERT INTO commerce.instagram_oauth_states(state_hash,browser_hash,organization_id,user_id,session_hash,scopes,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')",
        [
          digest(state),
          digest(browser),
          org,
          actor.id,
          hashToken(this.identity.token(req)!),
          config.scopes,
        ],
      );
    });
    reply.header("Cache-Control", "no-store");
    reply.header(
      "Set-Cookie",
      `${COOKIE}=${browser}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    );
    return {
      authorizationUrl: new MetaInstagramAdapter(config).authorizationUrl(
        state,
      ),
    };
  }
  async mobileAuthorize(req: FastifyRequest, org: string) {
    this.configured();
    const actor = await this.organizations.require(req, org, "merchant:write");
    const ticket = randomBytes(32).toString("base64url");
    await this.store.db.pool.query(
      "INSERT INTO commerce.instagram_launch_tickets(digest,organization_id,user_id,session_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '5 minutes')",
      [digest(ticket), org, actor.id, hashToken(this.identity.token(req)!)],
    );
    return {
      launchUrl:
        this.store.config.COMMERCE_API_PUBLIC_URL.replace(/\/$/, "") +
        "/v1/instagram/oauth/launch?ticket=" +
        ticket,
    };
  }
  async launch(reply: FastifyReply, ticket: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new ForbiddenException();
    const config = this.configured(),
      state = randomBytes(32).toString("base64url"),
      browser = randomBytes(32).toString("base64url");
    await transaction(this.store.db.pool, async (c) => {
      const row = (
        await c.query(
          "DELETE FROM commerce.instagram_launch_tickets WHERE digest=$1 AND expires_at>now() RETURNING *",
          [digest(ticket)],
        )
      ).rows[0] as OAuthState | undefined;
      if (!row) throw new ForbiddenException("Launch link expired or used");
      await this.stillAuthorized(c, row);
      await c.query(
        "INSERT INTO commerce.instagram_oauth_states(state_hash,browser_hash,organization_id,user_id,session_hash,scopes,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')",
        [
          digest(state),
          digest(browser),
          row.organization_id,
          row.user_id,
          row.session_hash,
          config.scopes,
        ],
      );
    });
    reply
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer")
      .header(
        "Set-Cookie",
        `${COOKIE}=${browser}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      );
    return reply
      .code(302)
      .redirect(new MetaInstagramAdapter(config).authorizationUrl(state));
  }
  private async stillAuthorized(c: PoolClient, state: OAuthState) {
    const row = (
      await c.query(
        "SELECT m.role FROM commerce.memberships m JOIN commerce.sessions s ON s.user_id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND s.token_hash=$3 AND s.expires_at>now() FOR SHARE OF m,s",
        [state.organization_id, state.user_id, state.session_hash],
      )
    ).rows[0];
    if (!row || !can(row.role, "merchant:write"))
      throw new ForbiddenException("Session or membership is no longer valid");
  }
  async callback(
    req: FastifyRequest,
    reply: FastifyReply,
    query: { state: string; code?: string; error?: string },
  ) {
    const config = this.configured();
    const browser = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1);
    if (!browser) throw new ForbiddenException("OAuth browser binding missing");
    const state = await transaction(this.store.db.pool, async (c) => {
      const row = (
        await c.query(
          "DELETE FROM commerce.instagram_oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING *",
          [digest(query.state), digest(browser)],
        )
      ).rows[0] as OAuthState | undefined;
      if (!row)
        throw new ForbiddenException("OAuth state expired or already used");
      await this.stillAuthorized(c, row);
      return row;
    });
    reply.header(
      "Set-Cookie",
      `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    );
    reply.header("Cache-Control", "no-store");
    if (query.error)
      throw new BadRequestException("Instagram authorization was declined");
    if (!query.code) throw new BadRequestException("Missing OAuth code");
    const result = await this.provider(() =>
      this.adapter().exchangeCode(query.code!),
    );
    return transaction(this.store.db.pool, async (c) => {
      await c.query(
        "SELECT id FROM commerce.organizations WHERE id=$1 FOR UPDATE",
        [state.organization_id],
      );
      await this.stillAuthorized(c, state);
      const existing = (
        await c.query(
          "SELECT account_id FROM commerce.instagram_connections WHERE organization_id=$1",
          [state.organization_id],
        )
      ).rows[0];
      if (existing && existing.account_id !== result.accountId)
        throw new ConflictException(
          "Disconnect the existing Instagram account first",
        );
      const encrypted = encryptToken(
        result.accessToken,
        config.key,
        state.organization_id,
      );
      const scopes = result.scopes.filter((s) => state.scopes.includes(s));
      await c.query(
        "INSERT INTO commerce.instagram_connections(organization_id,account_id,username,token_ciphertext,scopes,expires_at,connected_by) VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 second',$7) ON CONFLICT(organization_id) DO UPDATE SET username=excluded.username,token_ciphertext=excluded.token_ciphertext,scopes=excluded.scopes,expires_at=excluded.expires_at,refreshed_at=now(),connected_by=excluded.connected_by,version=commerce.instagram_connections.version+1",
        [
          state.organization_id,
          result.accountId,
          result.username,
          encrypted,
          scopes,
          result.expiresIn,
          state.user_id,
        ],
      );
      await emit(c, "instagram.connected", {
        organizationId: state.organization_id,
        accountId: result.accountId,
      });
      return {
        connected: true,
        organizationId: state.organization_id,
        accountId: result.accountId,
        username: result.username,
      };
    });
  }
  async status(req: FastifyRequest, org: string) {
    await this.organizations.require(req, org, "read");
    const connection =
      (
        await this.store.db.pool.query(
          "SELECT account_id,username,scopes,expires_at,refreshed_at,subscribed_fields FROM commerce.instagram_connections WHERE organization_id=$1",
          [org],
        )
      ).rows[0] ?? null;
    return {
      configured: !!(
        this.store.config.INSTAGRAM_APP_ID &&
        this.store.config.INSTAGRAM_TOKEN_ENCRYPTION_KEY &&
        this.store.config.INSTAGRAM_REDIRECT_URI &&
        this.store.config.INSTAGRAM_API_VERSION &&
        this.store.config.INSTAGRAM_APP_SECRET
      ),
      connection,
    };
  }
  private async withConnection<T>(
    req: FastifyRequest,
    org: string,
    fn: (c: PoolClient, row: Connection, token: string) => Promise<T>,
  ) {
    const config = this.configured();
    return transaction(this.store.db.pool, async (c) => {
      await this.organizations.require(req, org, "merchant:write", c);
      const row = (
        await c.query(
          "SELECT * FROM commerce.instagram_connections WHERE organization_id=$1 FOR UPDATE",
          [org],
        )
      ).rows[0] as Connection | undefined;
      if (!row) throw new NotFoundException("Instagram is not connected");
      return fn(c, row, decryptToken(row.token_ciphertext, config.key, org));
    });
  }
  private async refreshLocked(
    c: PoolClient,
    row: Connection,
    accessToken: string,
  ) {
    if (row.expires_at.getTime() <= Date.now())
      throw new ConflictException("Instagram token expired; reconnect");
    if (row.refreshed_at.getTime() > Date.now() - 86400000)
      throw new ConflictException(
        "Token must be at least 24 hours old before refresh",
      );
    const refreshed = await this.provider(() =>
      this.adapter().refresh(accessToken),
    );
    await c.query(
      "UPDATE commerce.instagram_connections SET token_ciphertext=$2,expires_at=now()+$3*interval '1 second',refreshed_at=now(),version=version+1 WHERE organization_id=$1",
      [
        row.organization_id,
        encryptToken(
          refreshed.accessToken,
          this.configured().key,
          row.organization_id,
        ),
        refreshed.expiresIn,
      ],
    );
    return refreshed;
  }
  async refresh(req: FastifyRequest, org: string) {
    return this.withConnection(req, org, async (c, row, token) => {
      const result = await this.refreshLocked(c, row, token);
      return { refreshed: true, expiresIn: result.expiresIn };
    });
  }
  async sync(req: FastifyRequest, org: string, after?: string) {
    return this.withConnection(req, org, async (c, row, token) => {
      if (row.expires_at.getTime() <= Date.now())
        throw new ConflictException("Instagram token expired; reconnect");
      if (
        row.expires_at.getTime() < Date.now() + 7 * 86400000 &&
        row.refreshed_at.getTime() < Date.now() - 86400000
      )
        token = (await this.refreshLocked(c, row, token)).accessToken;
      const page = await this.provider(() =>
        this.adapter().listMedia(row.account_id, token, after),
      );
      for (const item of page.items)
        await c.query(
          "INSERT INTO commerce.instagram_media(organization_id,media_id,account_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,media_id) DO UPDATE SET payload=excluded.payload,synced_at=now()",
          [org, item.id, row.account_id, JSON.stringify(item)],
        );
      return { items: page.items, after: page.after };
    });
  }
  async media(req: FastifyRequest, org: string) {
    await this.organizations.require(req, org, "read");
    return (
      await this.store.db.pool.query(
        "SELECT media_id,payload,synced_at FROM commerce.instagram_media WHERE organization_id=$1 ORDER BY synced_at DESC,media_id LIMIT 100",
        [org],
      )
    ).rows;
  }
  async subscribe(req: FastifyRequest, org: string, fields: string[]) {
    return this.withConnection(req, org, async (c, row, token) => {
      for (const field of fields) {
        const permission =
          field === "comments"
            ? "instagram_business_manage_comments"
            : "instagram_business_manage_messages";
        if (!row.scopes.includes(permission))
          throw new ConflictException(
            "Reconnect with required Instagram permission",
          );
      }
      await this.provider(() =>
        this.adapter().subscribe(row.account_id, token, fields),
      );
      await c.query(
        "UPDATE commerce.instagram_connections SET subscribed_fields=$2 WHERE organization_id=$1",
        [org, fields],
      );
      return { subscribedFields: fields };
    });
  }
  async disconnect(req: FastifyRequest, org: string) {
    return this.withConnection(req, org, async (c, row, token) => {
      try {
        await this.adapter().revoke(row.account_id, token);
      } catch (e) {
        if (!(e instanceof MetaApiError && e.code === 190))
          throw new BadGatewayException("Instagram revocation failed; retry");
      }
      await c.query(
        "DELETE FROM commerce.instagram_connections WHERE organization_id=$1",
        [org],
      );
      await c.query(
        "DELETE FROM commerce.instagram_oauth_states WHERE organization_id=$1",
        [org],
      );
      return { disconnected: true };
    });
  }
}
