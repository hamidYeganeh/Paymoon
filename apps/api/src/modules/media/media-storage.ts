import { Injectable, NotFoundException } from "@nestjs/common";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { Store } from "../../platform";
@Injectable()
export class MediaStorage {
  constructor(private store: Store) {}
  isStored(raw: string) {
    try {
      const url = new URL(raw);
      const local = new URL(this.store.config.COMMERCE_API_PUBLIC_URL);
      return (
        (url.origin === local.origin &&
          /^\/v1\/media\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(url.pathname)) ||
        (!!this.store.config.COMMERCE_MEDIA_PUBLIC_URL &&
          url.origin ===
            new URL(this.store.config.COMMERCE_MEDIA_PUBLIC_URL).origin &&
          /^\/paymoon\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(url.pathname))
      );
    } catch {
      return false;
    }
  }
  async save(data: Buffer, ext: "jpg" | "png" | "webp") {
    const id = createHash("sha256").update(data).digest("hex") + "." + ext;
    if (this.store.config.COMMERCE_MEDIA_STORAGE === "vercel_blob") {
      const blob = await put("paymoon/" + id, data, {
        access: "public",
        token: this.store.config.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: ext === "jpg" ? "image/jpeg" : "image/" + ext,
      });
      return blob.url;
    }
    await mkdir(this.store.config.COMMERCE_MEDIA_DIR, { recursive: true });
    try {
      await writeFile(join(this.store.config.COMMERCE_MEDIA_DIR, id), data, {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    return (
      this.store.config.COMMERCE_API_PUBLIC_URL.replace(/\/$/, "") +
      "/v1/media/" +
      id
    );
  }
  async read(id: string) {
    if (
      !/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(id) ||
      this.store.config.COMMERCE_MEDIA_STORAGE !== "local"
    )
      throw new NotFoundException();
    try {
      return await readFile(join(this.store.config.COMMERCE_MEDIA_DIR, id));
    } catch {
      throw new NotFoundException();
    }
  }
}
