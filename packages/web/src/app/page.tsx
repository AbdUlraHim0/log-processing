import { createClientSide } from "@/utils/supabase/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClientSide();

  const { data } = await supabase.auth.getUser();

  // If user is already logged in, redirect to dashboard
  if (data?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex flex-col">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Log Processing Microservice
        </h1>

        <p className="text-center mb-8 max-w-2xl">
          A real-time log file processing system with Next.js, BullMQ, and
          Supabase. Upload log files and view analytics on errors, keywords, and
          IP addresses.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signin"
            className="group rounded-lg border border-transparent px-5 py-4 bg-blue-500 text-white transition-colors hover:bg-blue-600"
          >
            Sign In
          </Link>

          <Link
            href="/auth/signup"
            className="group rounded-lg border border-transparent px-5 py-4 bg-gray-800 text-white transition-colors hover:bg-gray-700"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
