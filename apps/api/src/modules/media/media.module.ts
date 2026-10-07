import { MediaStorage } from "./media-storage";
import { InstagramImageStorage } from "./instagram-image-storage";
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  Module,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";

import { IdentityModule, IdentityService } from "../identity/identity.module";
@ApiTags("media")
@Controller("v1/media")
export class MediaController {
  constructor(
    private storage: MediaStorage,
    private identity: IdentityService,
  ) {}
  @Post() @ApiBearerAuth() async upload(
    @Req() r: FastifyRequest,
    @Body() b: unknown,
  ) {
    await this.identity.actor(r);
    const q = z
      .object({
        base64: z.string().min(8).max(4_000_000),
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .strict()
      .parse(b);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(q.base64))
      throw new BadRequestException("Invalid encoding");
    const data = Buffer.from(q.base64, "base64");
    if (data.length > 3_000_000)
      throw new BadRequestException("Image too large");
    const valid =
      q.mime === "image/jpeg"
        ? data[0] === 255 && data[1] === 216 && data[2] === 255
        : q.mime === "image/png"
          ? data
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : data.subarray(0, 4).toString() === "RIFF" &&
            data.subarray(8, 12).toString() === "WEBP";
    if (!valid) throw new BadRequestException("Image format mismatch");
    const ext =
      q.mime === "image/jpeg" ? "jpg" : q.mime === "image/png" ? "png" : "webp";
    return { url: await this.storage.save(data, ext) };
  }
  @Get(":id") async get(@Param("id") id: string, @Res() res: FastifyReply) {
    if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(id))
      throw new NotFoundException();
    const data = await this.storage.read(id);
    return res
      .type(
        id.endsWith(".jpg")
          ? "image/jpeg"
          : id.endsWith(".png")
            ? "image/png"
            : "image/webp",
      )
      .header("Cache-Control", "public,max-age=31536000,immutable")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("X-Content-Type-Options", "nosniff")
      .send(data);
  }
}
@Module({
  imports: [IdentityModule],
  controllers: [MediaController],
  providers: [InstagramImageStorage, MediaStorage],
  exports: [InstagramImageStorage, MediaStorage],
})
export class MediaModule {}
