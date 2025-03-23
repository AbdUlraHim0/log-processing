import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

export async function POST(req: NextRequest) {
  try {
    const { jobId, status, progress, stats } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    await redis.publish(
      "job-updates",
      JSON.stringify({
        jobId,
        status,
        progress,
        stats,
        timestamp: Date.now(),
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error publishing update:", error);
    return NextResponse.json(
      { error: "Failed to publish update" },
      { status: 500 }
    );
  }
}
