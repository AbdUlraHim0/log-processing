import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { createServerSide } from "@/utils/supabase/server";

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

const getQueue = () => {
  const connection = new Redis(redisConfig);
  return new Queue("log-processing-queue", {
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
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSide();
    const { data } = await supabase.auth.getUser();

    if (!data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = data.user;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const filePath = formData.get("filePath") as string;
    const fileName = formData.get("fileName") as string;

    if (!file || !filePath || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const queue = getQueue();

    const jobId = `job-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const fileSize = file.size;

    const priority = fileSize > 10 * 1024 * 1024 ? 2 : 1;

    const job = await queue.add(
      "processLogFile",
      {
        jobId,
        filePath,
        fileName,
        fileSize,
        userId: user.id,
        timestamp: new Date().toISOString(),
      },
      {
        jobId,
        priority,
        attempts: 3,
      }
    );

    await supabase.from("log_stats").insert({
      jobId: job.id,
      userId: user.id,
      fileName,
      filePath,
      fileSize,
      status: "waiting",
      progress: 0,
      totalEntries: 0,
      errorCount: 0,
      keywordMatches: {},
      ipAddresses: {},
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: "File added to processing queue",
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
