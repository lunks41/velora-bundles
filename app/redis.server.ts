import Redis from "ioredis";

export const CACHE_TTL = {
  ANALYTICS: 300,
  BUNDLE_LIST: 120,
  SHOP_PLAN: 3600,
  WIDGET_DATA: 30,
} as const;

let redis: Redis | null = null;

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  client.on("error", () => {
    // Redis is optional in local dev
  });

  return client;
}

if (process.env.NODE_ENV === "production") {
  redis = createRedisClient();
} else {
  if (!global.__redis) {
    global.__redis = createRedisClient() ?? undefined;
  }
  redis = global.__redis ?? null;
}

export { redis };

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
): Promise<T> {
  if (!redis) {
    return fetcher();
  }

  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    return fetcher();
  }

  const fresh = await fetcher();

  try {
    await redis.setex(key, ttl, JSON.stringify(fresh));
  } catch {
    // Ignore cache write failures
  }

  return fresh;
}

export async function invalidateShopCache(shopDomain: string): Promise<void> {
  if (!redis) return;

  try {
    const keys = await redis.keys(`shop:${shopDomain}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Ignore cache invalidation failures
  }
}

export async function pingRedis(): Promise<boolean> {
  if (!redis) return false;

  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
