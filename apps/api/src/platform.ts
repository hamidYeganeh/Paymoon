import {
  Global,
  Injectable,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import { database, transaction } from "@paymoon/db";
import { readConfig, redisConnection } from "@paymoon/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { QUEUE, maintenanceBatch } from "@paymoon/events";
@Injectable()
export class Store implements OnModuleDestroy {
  readonly config = readConfig();
  readonly db = database(this.config.COMMERCE_DATABASE_URL);
  readonly redis = new Redis(this.config.COMMERCE_REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
  });
  readonly queue = new Queue(QUEUE, {
    connection: redisConnection(this.config.COMMERCE_REDIS_URL),
  });
  private maintenanceActive?: Promise<
    Awaited<ReturnType<typeof maintenanceBatch>>
  >;
  private lastMaintenance = 0;
  async maintenance(retention = false) {
    if (this.maintenanceActive) {
      await this.maintenanceActive;
      if (!retention) return { skipped: true };
    }
    if (!retention && Date.now() - this.lastMaintenance < 5000)
      return { skipped: true };
    this.lastMaintenance = Date.now();
    const active = transaction(this.db.pool, (c) =>
      maintenanceBatch(c, retention),
    );
    this.maintenanceActive = active;
    try {
      return await active;
    } finally {
      if (this.maintenanceActive === active) this.maintenanceActive = undefined;
    }
  }
  async onModuleDestroy() {
    await this.queue.close();
    await this.redis.quit();
    await this.db.pool.end();
  }
}
@Global()
@Module({ providers: [Store], exports: [Store] })
export class PlatformModule {}
