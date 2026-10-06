import { Controller, Get, Module, Param, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { Store } from "../../platform";
import {
  OrganizationsModule,
  OrganizationsService,
} from "../organizations/organizations.module";
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("v1/organizations/:org/notifications")
export class NotificationsController {
  constructor(
    private readonly store: Store,
    private readonly organizations: OrganizationsService,
  ) {}
  @Get() async list(@Req() req: FastifyRequest, @Param("org") org: string) {
    await this.organizations.require(req, org, "read");
    return (
      await this.store.db.pool.query(
        "SELECT id,kind,created_at FROM commerce.notifications WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
        [org],
      )
    ).rows;
  }
}
@Module({
  imports: [OrganizationsModule],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
