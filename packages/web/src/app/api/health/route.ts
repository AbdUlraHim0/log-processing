export async function GET() {
  return Response.json({
    status: "ok",
    time: new Date().toISOString(),
    env: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      redisHost: process.env.REDIS_HOST,
      nodeEnv: process.env.NODE_ENV,
    },
  });
}
