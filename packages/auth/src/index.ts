import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (e, key) => (e ? reject(e) : resolve(key)),
    ),
  );
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  hash: string | undefined,
) {
  const [, salt, key] = hash?.split(":") ?? [];
  const valid =
    hash?.startsWith("scrypt:") &&
    /^[0-9a-f]{32}$/.test(salt ?? "") &&
    /^[0-9a-f]{128}$/.test(key ?? "");
  const actual = await derive(password, valid ? salt! : "0".repeat(32));
  return (
    timingSafeEqual(
      actual,
      valid ? Buffer.from(key!, "hex") : Buffer.alloc(64),
    ) && !!valid
  );
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const sessionToken = () => randomBytes(32).toString("base64url");
export type Role = "owner" | "admin" | "staff" | "viewer";
export type Permission =
  | "organization:manage"
  | "catalog:write"
  | "inventory:write"
  | "merchant:write"
  | "read";
const grants: Record<Role, readonly Permission[]> = {
  owner: [
    "organization:manage",
    "catalog:write",
    "inventory:write",
    "merchant:write",
    "read",
  ],
  admin: [
    "organization:manage",
    "catalog:write",
    "inventory:write",
    "merchant:write",
    "read",
  ],
  staff: ["catalog:write", "inventory:write", "read"],
  viewer: ["read"],
};
export function can(role: Role, permission: Permission) {
  return grants[role]?.includes(permission) ?? false;
}
