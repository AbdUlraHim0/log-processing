import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import fs from "fs";
import readline from "readline";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import os from "os";
import cluster from "cluster";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const KEYWORDS = (
  process.env.MONITORED_KEYWORDS || "error,exception,fail,timeout"
)
  .split(",")
  .map((k) => k.trim().toLowerCase());
const LOG_REGEX = /\[(.*?)\]\s+(\w+)\s+(.*?)(?:\s+(\{.*\}))?$/;
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "4");
const USE_CLUSTER = process.env.USE_CLUSTER === "true";
const NUM_WORKERS = USE_CLUSTER ? os.cpus().length : 1;

let redisPublisher: Redis | null = null;

function debugLog(...args: any[]) {
  const timestamp = new Date().toISOString();
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
  };
  console.log(`[DEBUG ${timestamp}]`, ...args, { memoryUsage: memoryUsageMB });
}

function getRedisPublisher() {
  if (!redisPublisher) {
    redisPublisher = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        console.log(
          `Redis publisher retry attempt ${times} with delay ${delay}ms`
        );
        return delay;
      },
    });

    redisPublisher.on("error", (error) => {
      console.error("Redis publisher error:", error);
    });

    redisPublisher.on("connect", () => {
      debugLog("Redis publisher connected successfully");
    });
  }
  return redisPublisher;
}

async function publishJobUpdate(update: any) {
  try {
    const publisher = getRedisPublisher();
    await publisher.publish("job-updates", JSON.stringify(update));
    return true;
  } catch (error) {
    console.error("Error publishing job update:", error);
    return false;
  }
}

function createSupabaseClient() {
  debugLog(`Creating Supabase client with URL: ${SUPABASE_URL}`);
  debugLog(`Service key available: ${!!SUPABASE_SERVICE_KEY}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Supabase URL or service key is missing in environment variables"
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          keepalive: true,
        }).catch(async (error) => {
          console.error("Supabase fetch error, retrying:", error);
          // Wait 1s and try again
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return fetch(url, options);
        });
      },
    },
  });
}

function createRedisConnection() {
  const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      console.log(
        `Redis connection retry attempt ${times} with delay ${delay}ms`
      );
      return delay;
    },
    reconnectOnError: (err) => {
      console.error("Redis connection error:", err);
      return true;
    },
  });

  connection.on("error", (error) => {
    console.error("Redis client error:", error);
  });

  connection.on("connect", () => {
    debugLog("Redis connected successfully");
  });

  return connection;
}

const tempDir = path.join(os.tmpdir(), "log-processor");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function startWorker() {
  debugLog("Starting worker");

  const connection = createRedisConnection();

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("log_stats")
      .select("count")
      .limit(1);

    if (error) {
      console.error("Supabase connection check failed:", error);
    } else {
      debugLog("Supabase connection test successful");
    }
  } catch (err) {
    console.error("Error testing Supabase connection:", err);
  }

  const worker = new Worker(
    "log-processing-queue",
    async (job: Job) => {
      debugLog(`Starting to process job ${job.id}`);
      const jobStartTime = Date.now();
      let timeoutId: NodeJS.Timeout | null = null;
      let aborted = false;

      const supabase = createSupabaseClient();

      const cleanupJob = async (
        status: "failed" | "completed",
        progress: number,
        errorMsg?: string
      ) => {
        try {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (status === "failed") {
            await updateJobStatus(
              job.id as string,
              "failed",
              progress,
              errorMsg,
              supabase
            );
          }
        } catch (e) {
          console.error(`Cleanup error for job ${job.id}:`, e);
        }
      };

      try {
        timeoutId = setTimeout(async () => {
          debugLog(
            `Safety timeout triggered for job ${job.id} after 3 minutes`
          );
          aborted = true;
          try {
            await updateJobStatus(
              job.id as string,
              "failed",
              0,
              "Processing timeout after 3 minutes",
              supabase
            );
          } catch (e) {
            console.error("Failed to update job status after timeout:", e);
          }
        }, 3 * 60 * 1000);

        debugLog(`Processing job ${job.id}: ${job.data.fileName}`);
        debugLog(`Job data:`, JSON.stringify(job.data));

        debugLog(`Updating job status to processing`);
        await updateJobStatus(
          job.id as string,
          "processing",
          1,
          undefined,
          supabase
        );
        debugLog(`Status updated successfully`);

        const { filePath, userId } = job.data;
        debugLog(`File path: ${filePath}, User ID: ${userId}`);

        debugLog(`Downloading file from storage`);
        const tempFilePath = await downloadFile(
          filePath,
          job.id as string,
          supabase
        );
        debugLog(`File downloaded to ${tempFilePath}`);

        const fileSize = fs.statSync(tempFilePath).size;
        debugLog(`File size: ${fileSize} bytes`);

        if (fileSize === 0) {
          throw new Error("Downloaded file is empty");
        }

        const sampleLines = await sampleFileContent(tempFilePath, 3);
        debugLog(`Sample lines from file:\n${sampleLines.join("\n")}`);

        await job.updateProgress(10);
        await updateJobStatus(
          job.id as string,
          "processing",
          10,
          undefined,
          supabase
        );
        debugLog(`Updated progress to 10% after download`);

        debugLog(`Starting file processing`);
        const stats = await processLogFile(tempFilePath, job, aborted);
        debugLog(
          `File processing completed with stats:`,
          JSON.stringify(stats)
        );

        debugLog(`Updating final job stats`);
        await updateJobStats(
          job.id as string,
          stats,
          "completed",
          100,
          supabase
        );
        debugLog(`Job stats updated successfully`);

        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            debugLog(`Temporary file cleaned up`);
          }
        } catch (cleanupError) {
          console.error(`Error cleaning up temp file: ${cleanupError}`);
        }

        const jobDuration = Date.now() - jobStartTime;
        debugLog(`Job ${job.id} completed in ${jobDuration}ms`);

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        return { success: true, stats };
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);

        await cleanupJob(
          "failed",
          0,
          error instanceof Error ? error.message : String(error)
        );

        throw error;
      }
    },
    {
      connection,
      concurrency: CONCURRENCY,

      stalledInterval: 30000,
      maxStalledCount: 1,
    }
  );

  debugLog(`Worker started with concurrency: ${CONCURRENCY}`);

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed with error: ${error.message}`);
    publishJobUpdate({
      jobId: job?.id,
      status: "failed",
      error: error.message,
      timestamp: Date.now(),
      userId: job?.data.userId,
    }).catch((e) => console.error("Error publishing job failure:", e));
  });

  worker.on("completed", (job) => {
    debugLog(`Job ${job.id} completed successfully`);
    publishJobUpdate({
      jobId: job.id,
      status: "completed",
      progress: 100,
      timestamp: Date.now(),
      userId: job.data.userId,
    }).catch((e) => console.error("Error publishing job completion:", e));
  });

  worker.on("stalled", (jobId) => {
    console.warn(`Job ${jobId} has stalled`);

    try {
      const supabase = createSupabaseClient();
      updateJobStatus(
        jobId,
        "failed",
        0,
        "Job stalled and was automatically failed",
        supabase
      )
        .then(() => debugLog(`Updated stalled job ${jobId} status to failed`))
        .catch((err) =>
          console.error(`Failed to update stalled job status: ${err}`)
        );
    } catch (e) {
      console.error(`Error in stalled job handler: ${e}`);
    }
  });

  process.on("SIGTERM", async () => {
    debugLog("Worker shutting down...");
    await worker.close();
    await connection.quit();

    if (redisPublisher) {
      await redisPublisher.quit();
    }

    process.exit(0);
  });

  return worker;
}

async function sampleFileContent(
  filePath: string,
  lineCount: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const stream = fs.createReadStream(filePath);
    const reader = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    reader.on("line", (line) => {
      if (lines.length < lineCount) {
        lines.push(line);
      } else {
        reader.close();
      }
    });

    reader.on("close", () => {
      stream.close();
      resolve(lines);
    });

    reader.on("error", (err) => {
      stream.close();
      reject(err);
    });
  });
}

async function updateJobStatus(
  jobId: string,
  status: "waiting" | "processing" | "completed" | "failed",
  progress: number,
  error?: string,
  supabase?: any
) {
  if (!supabase) {
    supabase = createSupabaseClient();
  }

  try {
    debugLog(
      `Updating job ${jobId} status to "${status}" with progress ${progress}${
        error ? ` and error: ${error}` : ""
      }`
    );

    const updateData = {
      status,
      progress,
      ...(error ? { error } : {}),
      updatedAt: new Date().toISOString(),
    };

    const { data, error: dbError } = await supabase
      .from("log_stats")
      .update(updateData)
      .eq("jobId", jobId)
      .select();

    if (dbError) {
      console.error(`Error updating job status:`, dbError);
      throw dbError;
    }

    debugLog(`Job status update successful:`, data);

    try {
      const publisher = getRedisPublisher();
      if (publisher) {
        await publisher.publish(
          "job-updates",
          JSON.stringify({
            jobId,
            status,
            progress,
            error,
            timestamp: Date.now(),
          })
        );
      }
    } catch (pubError) {
      console.error("Failed to publish job update:", pubError);
    }

    return data;
  } catch (error) {
    console.error(`Exception updating job status:`, error);
    throw error;
  }
}

async function updateJobStats(
  jobId: string,
  stats: LogStats,
  status: "completed" | "failed",
  progress: number,
  supabase: any
) {
  try {
    debugLog(
      `Updating job ${jobId} stats with status "${status}" and progress ${progress}`
    );

    const updateData = {
      status,
      progress,
      totalEntries: stats.totalEntries,
      errorCount: stats.errorCount,
      keywordMatches: stats.keywordMatches,
      ipAddresses: stats.ipAddresses,
      processingTime: stats.processingTime,
      completedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("log_stats")
      .update(updateData)
      .eq("jobId", jobId)
      .select();

    if (error) {
      console.error(`Error updating job stats:`, error);
      throw error;
    }

    debugLog(`Job stats update successful:`, data);

    try {
      const publisher = getRedisPublisher();
      if (publisher) {
        await publisher.publish(
          "job-updates",
          JSON.stringify({
            jobId,
            status,
            progress,
            stats: updateData,
            timestamp: Date.now(),
          })
        );
      }
    } catch (pubError) {
      console.error("Failed to publish job stats update:", pubError);
    }

    return data;
  } catch (error) {
    console.error(`Exception updating job stats:`, error);
    throw error;
  }
}

async function downloadFile(
  filePath: string,
  jobId: string,
  supabase: any
): Promise<string> {
  debugLog(`Downloading file: ${filePath} for job: ${jobId}`);
  debugLog(`Using Supabase URL: ${SUPABASE_URL}`);

  if (!supabase) {
    debugLog("Supabase client is undefined or null");
    supabase = createSupabaseClient();
    debugLog("Created new Supabase client");
  }

  if (!filePath || typeof filePath !== "string" || filePath.trim() === "") {
    throw new Error(`Invalid file path: ${filePath}`);
  }

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      debugLog(`Download attempt ${retries + 1} for ${filePath}`);

      try {
        const { data: buckets, error: bucketsError } =
          await supabase.storage.listBuckets();
        if (bucketsError) {
          debugLog(`Error listing buckets: ${JSON.stringify(bucketsError)}`);
        } else {
          const bucketNames = buckets.map((b: any) => b.name).join(", ");
          debugLog(`Available buckets: ${bucketNames}`);
        }
      } catch (e) {
        debugLog(
          `Error testing buckets: ${
            e instanceof Error ? e.message : JSON.stringify(e)
          }`
        );
      }

      try {
        const { data: bucketInfo, error: bucketError } =
          await supabase.storage.getBucket("log-files");

        if (bucketError) {
          debugLog(
            `Error getting bucket 'log-files': ${JSON.stringify(bucketError)}`
          );

          if (bucketError.statusCode === 404) {
            debugLog("Bucket 'log-files' not found, attempting to create it");
            const { error: createError } = await supabase.storage.createBucket(
              "log-files",
              { public: false }
            );

            if (createError) {
              debugLog(
                `Failed to create bucket: ${JSON.stringify(createError)}`
              );
            } else {
              debugLog("Successfully created 'log-files' bucket");
            }
          }
        } else {
          debugLog(`Bucket 'log-files' exists: ${JSON.stringify(bucketInfo)}`);
        }
      } catch (e) {
        debugLog(
          `Error checking bucket: ${
            e instanceof Error ? e.message : JSON.stringify(e)
          }`
        );
      }

      debugLog(
        `Attempting to download from bucket: log-files, path: ${filePath}`
      );
      const response = await supabase.storage
        .from("log-files")
        .download(filePath);

      if (!response) {
        throw new Error("Empty response from Supabase storage");
      }

      const { data, error } = response;

      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        debugLog(
          `Storage download error (attempt ${retries + 1}): ${errorMsg}`
        );

        if ("status" in error) {
          debugLog(`Error status code: ${(error as any).status}`);
        }

        throw new Error(`Supabase storage error: ${errorMsg}`);
      }

      if (!data) {
        throw new Error("No data received from storage");
      }

      debugLog(
        `File download successful, received data type: ${data.constructor.name}`
      );

      const tempFilePath = path.join(
        tempDir,
        `job-${jobId}-${Date.now()}-${path.basename(filePath)}`
      );

      let buffer: Buffer;
      try {
        if (data instanceof Blob || data instanceof File) {
          const arrayBuffer = await data.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else if (data.arrayBuffer && typeof data.arrayBuffer === "function") {
          const arrayBuffer = await data.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else if (data instanceof ArrayBuffer) {
          buffer = Buffer.from(data);
        } else if (Buffer.isBuffer(data)) {
          buffer = data;
        } else {
          throw new Error(`Unsupported data type: ${data.constructor.name}`);
        }
      } catch (e) {
        debugLog(
          `Error converting data to buffer: ${
            e instanceof Error ? e.message : JSON.stringify(e)
          }`
        );
        throw new Error(
          `Failed to process downloaded data: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }

      debugLog(`File size: ${buffer.length} bytes`);

      if (buffer.length === 0) {
        throw new Error("Downloaded file is empty (0 bytes)");
      }

      try {
        fs.writeFileSync(tempFilePath, buffer);
        debugLog(`File saved to ${tempFilePath}`);
      } catch (e) {
        debugLog(
          `Error writing file: ${
            e instanceof Error ? e.message : JSON.stringify(e)
          }`
        );
        throw new Error(
          `Failed to write file to disk: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }

      return tempFilePath;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : JSON.stringify(error);
      console.error(
        `Download error for job ${jobId} (attempt ${retries + 1}): ${errorMsg}`
      );

      retries++;

      if (retries >= maxRetries) {
        throw new Error(
          `Failed to download file after ${maxRetries} attempts: ${errorMsg}`
        );
      }

      const backoffTime = 1000 * Math.pow(2, retries);
      debugLog(`Retrying download in ${backoffTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffTime));
    }
  }

  throw new Error("Failed to download file after maximum retries");
}

function parseLine(line: string): ParsedLog | null {
  try {
    const match = line.match(LOG_REGEX);
    if (!match) return null;

    const [, timestamp, level, message, jsonStr] = match;

    let jsonPayload = null;
    if (jsonStr) {
      try {
        jsonPayload = JSON.parse(jsonStr);
      } catch (e) {}
    }

    return {
      timestamp,
      level,
      message,
      jsonPayload,
    };
  } catch (error) {
    return null;
  }
}

function extractIPs(obj: Record<string, any>, stats: LogStats) {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && isIPAddress(value)) {
      stats.ipAddresses[value] = (stats.ipAddresses[value] || 0) + 1;
    } else if (typeof value === "object" && value !== null) {
      extractIPs(value, stats);
    }
  }
}

function extractIPsFromText(text: string, stats: LogStats) {
  const ipv4Regex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
  const matches = text.match(ipv4Regex);

  if (matches) {
    matches.forEach((ip) => {
      if (isIPAddress(ip)) {
        stats.ipAddresses[ip] = (stats.ipAddresses[ip] || 0) + 1;
      }
    });
  }
}

function isIPAddress(str: string): boolean {
  const parts = str.split(".");
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}

async function processLogFile(
  filePath: string,
  job: Job,
  aborted: boolean
): Promise<LogStats> {
  debugLog(`Starting to process file: ${filePath}`);

  const stats: LogStats = {
    totalEntries: 0,
    errorCount: 0,
    keywordMatches: {},
    ipAddresses: {},
    processingTime: 0,
  };

  KEYWORDS.forEach((keyword) => {
    stats.keywordMatches[keyword] = 0;
  });

  const startTime = Date.now();

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  debugLog(`File size: ${fileStats.size} bytes`);

  const estimatedTotalLines = Math.max(100, Math.floor(fileStats.size / 200));
  debugLog(`Estimated line count: ${estimatedTotalLines}`);

  const fileStream = fs.createReadStream(filePath, {
    highWaterMark: 64 * 1024,
  });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let lastProgressUpdate = Date.now();
  let reportedProgress = 20;
  let lastMemoryCheck = Date.now();
  let batchSize = 0;
  const BATCH_SIZE = 1000;

  try {
    debugLog(`Starting to process lines...`);

    for await (const line of rl) {
      if (aborted) {
        debugLog(`Job aborted due to timeout - stopping processing`);
        break;
      }

      lineCount++;
      batchSize++;

      const now = Date.now();
      if (now - lastMemoryCheck > 5000) {
        lastMemoryCheck = now;
        const memUsage = process.memoryUsage();
        const memUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

        debugLog(
          `Memory usage: ${memUsedPercent.toFixed(
            2
          )}% of heap, ${lineCount} lines processed`
        );

        if (memUsedPercent > 80) {
          debugLog(
            `High memory usage detected (${memUsedPercent.toFixed(
              2
            )}%), slowing down processing`
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      const parsed = parseLine(line);
      if (parsed) {
        stats.totalEntries++;

        if (parsed.level.toLowerCase() === "error") {
          stats.errorCount++;
        }

        KEYWORDS.forEach((keyword) => {
          if (parsed.message.toLowerCase().includes(keyword)) {
            stats.keywordMatches[keyword]++;
          }
        });

        if (parsed.jsonPayload && typeof parsed.jsonPayload === "object") {
          extractIPs(parsed.jsonPayload, stats);
        }

        extractIPsFromText(parsed.message, stats);
      }

      if (batchSize >= BATCH_SIZE || now - lastProgressUpdate > 5000) {
        batchSize = 0;

        const currentProgress =
          Math.floor((lineCount / estimatedTotalLines) * 80) + 20; // 20-100% range

        if (
          currentProgress >= reportedProgress + 5 ||
          now - lastProgressUpdate > 5000
        ) {
          reportedProgress = currentProgress;
          lastProgressUpdate = now;

          const scaledProgress = Math.min(99, Math.max(20, currentProgress));

          debugLog(
            `Updating progress to ${scaledProgress}% after processing ${lineCount}/${estimatedTotalLines} lines`
          );
          await job.updateProgress(scaledProgress);
          await updateJobStatus(job.id as string, "processing", scaledProgress);

          publishJobUpdate({
            jobId: job.id,
            status: "processing",
            progress: scaledProgress,
            timestamp: Date.now(),
            linesProcessed: lineCount,
            userId: job.data.userId,
          }).catch((e) =>
            console.error("Failed to publish progress update:", e)
          );
        }
      }
    }

    debugLog(`Finished processing all lines: ${lineCount} total`);
  } catch (error) {
    console.error(`Error processing file for job ${job.id}:`, error);
    throw error;
  } finally {
    try {
      fileStream.close();
      debugLog(`File stream closed`);
    } catch (err) {
      console.error(`Error closing file stream: ${err}`);
    }
  }

  stats.processingTime = Date.now() - startTime;
  debugLog(`Processed ${lineCount} lines in ${stats.processingTime}ms`);

  return stats;
}

interface ParsedLog {
  timestamp: string;
  level: string;
  message: string;
  jsonPayload: Record<string, any> | null;
}

interface LogStats {
  totalEntries: number;
  errorCount: number;
  keywordMatches: Record<string, number>;
  ipAddresses: Record<string, number>;
  processingTime: number;
}

if (USE_CLUSTER && cluster.isPrimary) {
  console.log(`Primary process ${process.pid} is running`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `Worker ${worker.process.pid} died with code ${code} and signal ${signal}`
    );
    console.log("Forking a new worker...");
    cluster.fork();
  });
} else {
  startWorker()
    .then(() => console.log(`Worker ${process.pid} started`))
    .catch((err) => console.error(`Error starting worker: ${err.message}`));
}
