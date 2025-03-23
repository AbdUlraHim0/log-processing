import { createServerSupabaseClient } from "@/libs/supabase";
import { getRecentJobUpdates } from "@/utils/redis-updates";
import { rateLimit } from "@/utils/rate-limiter";
import { NextRequest } from "next/server";

/**
 * API endpoint for retrieving job updates
 * Uses polling instead of WebSockets for better compatibility with serverless environments
 */
export async function GET(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for") ||
      "127.0.0.1";

    const rateLimitResult = await rateLimit(`live-stats:${ip}`, 20, 60); // 20 requests per minute

    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.reset - Math.floor(Date.now() / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
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

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const since = parseInt(url.searchParams.get("since") || "0");
    const jobId = url.searchParams.get("jobId") || undefined;

    const isSSE = req.headers.get("accept") === "text/event-stream";

    const updates = await getRecentJobUpdates(since, user.id, jobId);

    if (isSSE) {
      let responseText = "";

      if (updates.length > 0) {
        // Format each update as an SSE event
        for (const update of updates) {
          responseText += `event: job-update\n`;
          responseText += `data: ${JSON.stringify(update)}\n\n`;
        }
      } else {
        responseText = `: no updates\n\n`;
      }

      return new Response(responseText, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    return new Response(
      JSON.stringify({
        updates,
        timestamp: Date.now(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.reset.toString(),
        },
      }
    );
  } catch (error) {
    console.error("Error handling job updates request:", error);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
