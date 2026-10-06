import { z } from "zod";
export type MetaConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  version: string;
  scopes: string[];
};
export type Media = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp?: string;
  children?: { data: MediaChild[] };
};
type MediaChild = {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
};
const id = z.string().regex(/^\d+$/);
const child = z.object({
  id,
  media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]),
  media_url: z.url().optional(),
  thumbnail_url: z.url().optional(),
});
const media = child.extend({
  caption: z.string().optional(),
  permalink: z.url().optional(),
  timestamp: z.string().optional(),
  children: z.object({ data: z.array(child) }).optional(),
});
const token = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});
export class MetaApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly retryable = false,
  ) {
    super("Instagram request failed");
  }
}
export interface InstagramAdapter {
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<{
    accessToken: string;
    expiresIn: number;
    accountId: string;
    username: string;
    scopes: string[];
  }>;
  listMedia(
    accountId: string,
    accessToken: string,
    after?: string,
  ): Promise<{ items: Media[]; after?: string }>;
  refresh(
    accessToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }>;
  subscribe(
    accountId: string,
    accessToken: string,
    fields: string[],
  ): Promise<void>;
  revoke(accountId: string, accessToken: string): Promise<void>;
}
export class MetaInstagramAdapter implements InstagramAdapter {
  constructor(
    private readonly config: MetaConfig,
    private readonly transport: typeof fetch = fetch,
  ) {}
  authorizationUrl(state: string) {
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: this.config.scopes.join(","),
      state,
    }).toString();
    return url.toString();
  }
  private async request(url: URL, init: RequestInit = {}): Promise<unknown> {
    // All URLs are assembled locally; never follow provider pagination URLs or redirects carrying credentials.
    if (
      !["graph.instagram.com", "api.instagram.com"].includes(url.hostname) ||
      url.protocol !== "https:"
    )
      throw new MetaApiError(0);
    let response: Response;
    try {
      response = await this.transport(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new MetaApiError(0, true);
    }
    const text = await response.text();
    if (text.length > 2_000_000) throw new MetaApiError(0);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new MetaApiError(0);
    }
    const error = z
      .object({ error: z.object({ code: z.number().optional() }) })
      .safeParse(value);
    if (!response.ok || error.success)
      throw new MetaApiError(
        error.success
          ? (error.data.error.code ?? response.status)
          : response.status,
        response.status === 429 || response.status >= 500,
      );
    return value;
  }
  private graph(path: string, params: Record<string, string> = {}) {
    const url = new URL(
      `https://graph.instagram.com/${this.config.version}/${path}`,
    );
    url.search = new URLSearchParams(params).toString();
    return url;
  }
  async exchangeCode(code: string) {
    const raw = await this.request(
      new URL("https://api.instagram.com/oauth/access_token"),
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: this.config.appId,
          client_secret: this.config.appSecret,
          grant_type: "authorization_code",
          redirect_uri: this.config.redirectUri,
          code,
        }),
      },
    );
    const shortSchema = z.object({
      access_token: z.string().min(1),
      permissions: z.array(z.string()).optional(),
    });
    const wrapped = z.object({ data: z.tuple([shortSchema]) }).safeParse(raw);
    const short = wrapped.success
      ? wrapped.data.data[0]
      : shortSchema.parse(raw);
    const scopes = short.permissions ?? ["instagram_business_basic"];
    if (!scopes.includes("instagram_business_basic"))
      throw new MetaApiError(10);
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.search = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: this.config.appSecret,
      access_token: short.access_token,
    }).toString();
    const long = token.parse(await this.request(longUrl));
    const profile = z
      .object({ user_id: id, username: z.string().min(1) })
      .parse(
        await this.request(this.graph("me", { fields: "user_id,username" }), {
          headers: { Authorization: `Bearer ${long.access_token}` },
        }),
      );
    return {
      accessToken: long.access_token,
      expiresIn: long.expires_in,
      accountId: profile.user_id,
      username: profile.username,
      scopes,
    };
  }
  async listMedia(accountId: string, accessToken: string, after?: string) {
    id.parse(accountId);
    const result = z
      .object({
        data: z.array(media),
        paging: z
          .object({
            cursors: z
              .object({ after: z.string().max(2048).optional() })
              .optional(),
            next: z.string().optional(),
          })
          .optional(),
      })
      .parse(
        await this.request(
          this.graph(`${accountId}/media`, {
            fields:
              "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,children{id,media_type,media_url,thumbnail_url}",
            limit: "25",
            ...(after ? { after } : {}),
          }),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
    return {
      items: result.data,
      after: result.paging?.next ? result.paging.cursors?.after : undefined,
    };
  }
  async refresh(accessToken: string) {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.search = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: accessToken,
    }).toString();
    const result = token.parse(await this.request(url));
    return { accessToken: result.access_token, expiresIn: result.expires_in };
  }
  async subscribe(accountId: string, accessToken: string, fields: string[]) {
    id.parse(accountId);
    z.object({ success: z.literal(true) }).parse(
      await this.request(this.graph(`${accountId}/subscribed_apps`), {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: new URLSearchParams({ subscribed_fields: fields.join(",") }),
      }),
    );
  }
  async revoke(accountId: string, accessToken: string) {
    id.parse(accountId);
    z.object({ success: z.literal(true) }).parse(
      await this.request(this.graph(`${accountId}/permissions`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
  }
}
