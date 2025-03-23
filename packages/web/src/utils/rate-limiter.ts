import { Redis } from "ioredis";

export const shouldSkipRedisConnection = () => {
  return (
    process.env.SKIP_REDIS_CONNECTION === "true" ||
    process.env.NEXT_PHASE === "phase-production-build"
  );
};

const getRedisClient = () => {
  if (shouldSkipRedisConnection()) {
    return null; // Return null during build phase
  }

  return new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  });
};

/**
 * Rate limiting implementation using Redis
 * @param identifier - Unique identifier for the user or IP
 * @param limit - Maximum number of requests allowed in the window
 * @param windowSizeInSeconds - Time window in seconds
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSizeInSeconds: number
) {
  try {
    const redis = getRedisClient();

    if (!redis) {
      console.warn("Redis client not available, skipping rate limiting");
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: Math.ceil((Date.now() + windowSizeInSeconds * 1000) / 1000),
      };
    }

    const now = new Date();
    const currentMinute = `${now.getUTCHours()}:${now.getUTCMinutes()}`;
    const key = `ratelimit:${identifier}:${currentMinute}`;

    const count = await redis.incr(key);

    await redis.expire(key, windowSizeInSeconds);

    const isDashboardEndpoint =
      identifier.includes("queue-status") || identifier.includes("dashboard");

    const effectiveLimit = isDashboardEndpoint ? 300 : limit;

    const success = count <= effectiveLimit;
    const remaining = Math.max(0, effectiveLimit - count);
    const resetTime = Math.ceil(
      (now.getTime() + windowSizeInSeconds * 1000) / 1000
    );

    return {
      success,
      limit: effectiveLimit,
      remaining,
      reset: resetTime,
    };
  } catch (error) {
    console.error("Rate limiting error:", error);
    return {
      success: true,
      limit,
      remaining: 1,
      reset: Math.ceil((Date.now() + windowSizeInSeconds * 1000) / 1000),
    };
  }
}
