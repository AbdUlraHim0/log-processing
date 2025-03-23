import Redis from "ioredis";

let redisClient: Redis | null = null;

const JOB_UPDATES_KEY = "recent-job-updates";
const MAX_STORED_UPDATES = 100;

export function getRedisClient() {
  if (process.env.SKIP_REDIS_CONNECTION === "true") {
    console.warn("Redis connection skipped due to SKIP_REDIS_CONNECTION flag");
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        console.log(
          `Redis connection retry attempt ${times} with delay ${delay}ms`
        );
        return delay;
      },
    });

    redisClient.on("error", (error) => {
      console.error("Redis client error:", error);
    });

    redisClient.on("connect", () => {
      console.log("Redis client connected successfully");
    });
  }
  return redisClient;
}

export interface JobUpdate {
  jobId: string;
  status: "waiting" | "processing" | "completed" | "failed";
  progress: number;
  timestamp: number;
  userId?: string;
  error?: string;
  linesProcessed?: number;
  totalEntries?: number;
  errorCount?: number;
  keywordMatches?: Record<string, number>;
  ipAddresses?: Record<string, number>;
  processingTime?: number;
}

/**
 * Store a job update in Redis
 * @param update The job update to store
 * @returns True if successful, false otherwise
 */
export async function storeJobUpdate(update: JobUpdate): Promise<boolean> {
  try {
    const redis = getRedisClient();
    if (!redis) return false;

    if (!update.timestamp) {
      update.timestamp = Date.now();
    }

    const updateJson = JSON.stringify(update);

    await redis.lpush(JOB_UPDATES_KEY, updateJson);

    await redis.ltrim(JOB_UPDATES_KEY, 0, MAX_STORED_UPDATES - 1);

    return true;
  } catch (error) {
    console.error("Error storing job update:", error);
    return false;
  }
}

/**
 * Get recent job updates from Redis
 * @param sinceTimestamp Only return updates newer than this timestamp
 * @param userId Only return updates for this user
 * @param jobId Optional - only return updates for this job
 * @returns Array of job updates
 */
export async function getRecentJobUpdates(
  sinceTimestamp: number = 0,
  userId?: string,
  jobId?: string
): Promise<JobUpdate[]> {
  try {
    const redis = getRedisClient();
    if (!redis) return [];

    const updates = await redis.lrange(
      JOB_UPDATES_KEY,
      0,
      MAX_STORED_UPDATES - 1
    );

    return updates
      .map((update) => {
        try {
          return JSON.parse(update) as JobUpdate;
        } catch (e) {
          console.error("Error parsing job update:", e);
          return null;
        }
      })
      .filter((update): update is JobUpdate => update !== null)
      .filter((update) => update.timestamp > sinceTimestamp)
      .filter((update) => !userId || update.userId === userId)
      .filter((update) => !jobId || update.jobId === jobId);
  } catch (error) {
    console.error("Error fetching job updates:", error);
    return [];
  }
}

/**
 * Get the most recent update for a specific job
 * @param jobId The job ID to get updates for
 * @param userId Optional - only return updates for this user
 * @returns The most recent job update or null if not found
 */
export async function getLatestJobUpdate(
  jobId: string,
  userId?: string
): Promise<JobUpdate | null> {
  try {
    const updates = await getRecentJobUpdates(0, userId, jobId);

    if (updates.length === 0) return null;

    return updates.reduce(
      (latest, current) =>
        !latest || current.timestamp > latest.timestamp ? current : latest,
      updates[0]
    );
  } catch (error) {
    console.error(`Error fetching latest update for job ${jobId}:`, error);
    return null;
  }
}

/**
 * Subscribe to Redis job updates
 * This can be used for server-side processes that need to react to job updates
 * @param callback Function to call when a job update is received
 * @returns Unsubscribe function
 */
export function subscribeToJobUpdates(
  callback: (update: JobUpdate) => void
): () => Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    console.warn("Redis client not available for subscription");
    return async () => {};
  }

  const subscriber = redis.duplicate();

  subscriber.on("message", (channel, message) => {
    if (channel === "job-updates") {
      try {
        const update = JSON.parse(message) as JobUpdate;
        callback(update);
      } catch (error) {
        console.error("Error parsing job update message:", error);
      }
    }
  });

  subscriber.subscribe("job-updates");

  return async () => {
    try {
      await subscriber.unsubscribe("job-updates");
      await subscriber.quit();
    } catch (error) {
      console.error("Error unsubscribing from job updates:", error);
    }
  };
}
