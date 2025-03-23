import { createServerSide } from "@/utils/supabase/server";
import { getQueue } from "@/utils/redis-client";
import { rateLimit } from "@/utils/rate-limiter";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for") ||
      "127.0.0.1";

    const rateLimitResult = await rateLimit(`queue-status:${ip}`, 10, 60);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.reset - Math.floor(Date.now() / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
            "Retry-After": (
              rateLimitResult.reset - Math.floor(Date.now() / 1000)
            ).toString(),
          },
        }
      );
    }

    const supabase = await createServerSide();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "10");

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "Invalid page parameter" },
        { status: 400 }
      );
    }

    if (isNaN(pageSize) || pageSize < 1 || pageSize > 50) {
      return NextResponse.json(
        { error: "Invalid pageSize parameter (must be between 1 and 50)" },
        { status: 400 }
      );
    }

    const queue = getQueue();

    const counts = await queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
    );

    const { data: jobsData, error: jobsError } = await supabase
      .from("log_stats")
      .select("*")
      .eq("userId", user.id)
      .order("createdAt", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (jobsError) {
      console.error("Error fetching jobs from database:", jobsError);
      return NextResponse.json(
        { error: "Error fetching jobs from database" },
        { status: 500 }
      );
    }

    const { count, error: countError } = await supabase
      .from("log_stats")
      .select("*", { count: "exact", head: true })
      .eq("userId", user.id);

    if (countError) {
      console.error("Error fetching job count:", countError);
      return NextResponse.json(
        { error: "Error fetching job count" },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / pageSize);

    const response = {
      queueName: "log-processing-queue",
      counts,
      recentJobs: jobsData || [],
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems: count || 0,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Limit": rateLimitResult.limit.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": rateLimitResult.reset.toString(),
      },
    });
  } catch (error) {
    console.error("Error getting queue status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
