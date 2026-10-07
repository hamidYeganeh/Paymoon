import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { MediaStorage } from "./media-storage";
@Injectable()
export class InstagramImageStorage {
  constructor(private storage: MediaStorage) {}
  isStored(url: string) {
    return this.storage.isStored(url);
  }
  async copy(raw: string) {
    const u = new URL(raw);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !["cdninstagram.com", "fbcdn.net"].some(
        (host) => u.hostname === host || u.hostname.endsWith("." + host),
      )
    )
      throw new BadRequestException(
        "Only official Meta media hosts are accepted",
      );
    const response = await fetch(u, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }).catch(() => {
      throw new BadGatewayException("Media download failed; sync again");
    });
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get("content-length") ?? 0) > 5_000_000
    )
      throw new BadGatewayException("Media unavailable or too large");
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5_000_000) throw new BadRequestException("Image too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const data = Buffer.concat(chunks);
    const ext =
      data[0] === 255 && data[1] === 216 && data[2] === 255
        ? "jpg"
        : data
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "png"
          : data.subarray(0, 4).toString() === "RIFF" &&
              data.subarray(8, 12).toString() === "WEBP"
            ? "webp"
            : null;
    if (!ext) throw new BadRequestException("Unsupported media image");
    return this.storage.save(data, ext);
  }
}
