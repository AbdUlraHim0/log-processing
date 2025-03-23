import Redis from "ioredis";
import { Queue } from "bullmq";

const shouldSkipRedisConnection = () => {
  return (
    process.env.SKIP_REDIS_CONNECTION === "true" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    typeof window !== "undefined"
  ); // Skip on client-side
};

export function getRedisClient() {
  if (shouldSkipRedisConnection()) {
    console.log("Skipping Redis connection during build/client-side");
    return null;
  }

  try {
    return new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: null,
    });
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    return null;
  }
}

export function getQueue(queueName = "log-processing-queue") {
  const connection = getRedisClient();

  if (!connection) {
    return {
      add: async () => ({ id: "mock-job-id" }),
      getJobCounts: async () => ({
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        waiting: 0,
      }),
      getJobs: async () => [],
    } as unknown as Queue;
  }

  return new Queue(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}

export async function safeRateLimit(
  identifier: string,
  limit: number,
  windowSec: number
) {
  const redis = getRedisClient();

  if (!redis) {
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.floor(Date.now() / 1000) + windowSec,
    };
  }

  const key = `ratelimit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSec;

  await redis.zremrangebyscore(key, 0, windowStart);

  const requestCount = await redis.zcard(key);

  const oldestRequest = await redis.zrange(key, 0, 0, "WITHSCORES");
  const resetTime =
    oldestRequest.length > 1
      ? parseInt(oldestRequest[1]) + windowSec
      : now + windowSec;

  if (requestCount >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: resetTime,
    };
  }

  await redis.zadd(
    key,
    now,
    `${now}-${Math.random().toString(36).substring(2, 10)}`
  );

  await redis.expire(key, windowSec * 2);

  return {
    success: true,
    limit,
    remaining: limit - requestCount - 1,
    reset: resetTime,
  };
}
