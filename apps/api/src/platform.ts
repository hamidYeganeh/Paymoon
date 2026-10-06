import {
  Global,
  Injectable,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import { database } from "@paymoon/db";
import { readConfig, redisConnection } from "@paymoon/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { QUEUE } from "@paymoon/events";
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
  async onModuleDestroy() {
    await this.queue.close();
    await this.redis.quit();
    await this.db.pool.end();
  }
}
@Global()
@Module({ providers: [Store], exports: [Store] })
export class PlatformModule {}
