import { z } from "zod";
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  COMMERCE_DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:/.test(v)),
  COMMERCE_REDIS_URL: z.url().refine((v) => /^rediss?:/.test(v)),
  COMMERCE_API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  COMMERCE_WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  COMMERCE_CORS_ORIGINS: z
    .string()
    .default(
      "http://localhost:4100,http://localhost:4101,http://localhost:4102",
    ),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "silent"])
    .default("info"),
  INSTAGRAM_APP_ID: z.string().regex(/^\d+$/).optional(),
  INSTAGRAM_API_VERSION: z
    .string()
    .regex(/^v\d+\.0$/)
    .optional(),
  INSTAGRAM_REDIRECT_URI: z
    .url()
    .refine((v) => new URL(v).protocol === "https:")
    .optional(),
  INSTAGRAM_TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional(),
  INSTAGRAM_SCOPES: z
    .string()
    .default("instagram_business_basic")
    .refine((v) => {
      const scopes = v.split(",").map((s) => s.trim());
      return (
        scopes.includes("instagram_business_basic") &&
        scopes.every((s) =>
          [
            "instagram_business_basic",
            "instagram_business_manage_comments",
            "instagram_business_manage_messages",
          ].includes(s),
        )
      );
    }),
  INSTAGRAM_APP_SECRET: z.string().min(16).optional(),
  INSTAGRAM_VERIFY_TOKEN: z.string().min(16).optional(),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}
export function redisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number(u.pathname.slice(1) || 0),
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
