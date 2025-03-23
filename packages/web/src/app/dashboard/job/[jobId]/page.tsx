import { createServerSide } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ThemeProvider } from "@/context/theme-context";
import JobDetailClient from "./job-detail-client";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  console.log("Fetching details for job:", jobId);

  const supabase = await createServerSide();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log("Auth error or no user, redirecting to signin");
    redirect("/auth/signin");
  }

  let jobStats;
  let jobError;

  try {
    const result = await supabase
      .from("log_stats")
      .select("*")
      .eq("jobId", jobId)
      .single();

    jobStats = result.data;
    jobError = result.error;

    console.log(
      "Job stats fetched:",
      jobStats ? "success" : "not found",
      jobError ? `Error: ${jobError.message}` : "No error"
    );

    if (jobStats) {
      console.log("Job data sample:", {
        id: jobStats.id,
        jobId: jobStats.jobId,
        fileName: jobStats.fileName,
        status: jobStats.status,
        totalEntries: jobStats.totalEntries,
      });
    }
  } catch (error) {
    console.error("Exception fetching job stats:", error);
    jobError = error;
  }

  const profileResult = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profileResult.data?.is_admin || false;

  if (!isAdmin && jobStats && jobStats.userId !== user.id) {
    console.log(
      "User does not have access to this job, redirecting to dashboard"
    );
    redirect("/dashboard");
  }

  if (jobError || !jobStats) {
    console.log("Job not found or error, redirecting to dashboard");
    redirect("/dashboard");
  }

  if (typeof jobStats.ipAddresses === "string") {
    try {
      jobStats.ipAddresses = JSON.parse(jobStats.ipAddresses);
    } catch (e) {
      console.error("Error parsing ipAddresses:", e);
      jobStats.ipAddresses = {};
    }
  }

  if (typeof jobStats.keywordMatches === "string") {
    try {
      jobStats.keywordMatches = JSON.parse(jobStats.keywordMatches);
    } catch (e) {
      console.error("Error parsing keywordMatches:", e);
      jobStats.keywordMatches = {};
    }
  }

  return (
    <ThemeProvider>
      <JobDetailClient user={user} jobStats={jobStats} />
    </ThemeProvider>
  );
}
