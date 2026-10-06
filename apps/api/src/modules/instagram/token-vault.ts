import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptToken(
  token: string,
  keyHex: string,
  organizationId: string,
): string {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  cipher.setAAD(Buffer.from(organizationId));
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptToken(
  envelope: string,
  keyHex: string,
  organizationId: string,
): string {
  const [v, iv, tag, body, ...rest] = envelope.split(".");
  if (v !== "v1" || !iv || !tag || !body || rest.length)
    throw new Error("Invalid token envelope");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyHex, "hex"),
    Buffer.from(iv, "base64url"),
  );
  cipher.setAAD(Buffer.from(organizationId));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    cipher.update(Buffer.from(body, "base64url")),
    cipher.final(),
  ]).toString("utf8");
}
