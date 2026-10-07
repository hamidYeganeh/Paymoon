import { z } from "zod";
const envSchema = z.object({
  COMMERCE_ENVIRONMENT: z
    .enum(["development", "test", "staging", "production"])
    .optional(),
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
      "http://localhost:4100,http://localhost:4101,http://localhost:4102,https://localhost,http://localhost",
    ),
  COMMERCE_ADMIN_USER_IDS: z.string().default(""),
  COMMERCE_API_PUBLIC_URL: z.url().default("http://localhost:4000"),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  COMMERCE_MEDIA_STORAGE: z.enum(["local", "vercel_blob"]).default("local"),
  COMMERCE_MEDIA_PUBLIC_URL: z.url().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(16).optional(),
  COMMERCE_MEDIA_DIR: z.string().default("../../var/media"),
  COMMERCE_PAYMENT_MODE: z.enum(["disabled", "sandbox"]).default("disabled"),
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
  const result = envSchema.parse({
    ...env,
    COMMERCE_DATABASE_URL:
      env.COMMERCE_DATABASE_URL ?? env.DATABASE_URL ?? env.POSTGRES_URL,
    COMMERCE_REDIS_URL: env.COMMERCE_REDIS_URL ?? env.REDIS_URL,
  });
  const environment = result.COMMERCE_ENVIRONMENT ?? result.NODE_ENV;
  if (
    environment === "staging" &&
    result.COMMERCE_PAYMENT_MODE === "sandbox" &&
    !new URL(result.COMMERCE_DATABASE_URL).pathname.endsWith("_staging")
  )
    throw new Error(
      "Staging sandbox requires a separate database ending in _staging",
    );
  if (
    environment === "production" &&
    result.COMMERCE_PAYMENT_MODE === "sandbox"
  )
    throw new Error("Sandbox payments are forbidden in production");
  if (
    result.COMMERCE_MEDIA_STORAGE === "vercel_blob" &&
    (!result.BLOB_READ_WRITE_TOKEN || !result.COMMERCE_MEDIA_PUBLIC_URL)
  )
    throw new Error("Blob storage requires token and public URL");
  if (env.VERCEL === "1" && result.COMMERCE_MEDIA_STORAGE !== "vercel_blob")
    throw new Error("Vercel requires persistent Blob storage");
  if (
    result.NODE_ENV === "production" &&
    new URL(result.COMMERCE_API_PUBLIC_URL).protocol !== "https:"
  )
    throw new Error("Production API requires HTTPS public URL");
  return { ...result, COMMERCE_ENVIRONMENT: environment };
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
