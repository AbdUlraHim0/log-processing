"use client";

import { User } from "@supabase/supabase-js";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { signout } from "../auth/action";
import { UploadSection } from "@/components/dashboard/upload-section";
import { QueueSection } from "@/components/dashboard/queue-section";
import { StatsSection } from "@/components/dashboard/stats-sections";

export default function DashboardClient({ user }: { user: User }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-secondary-200 dark:border-secondary-800 shadow-sm bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-semibold">
                Log Processing Dashboard
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              {user && (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-secondary-500 dark:text-secondary-400">
                    {user.email}
                  </span>
                  <form action={signout}>
                    <button
                      type="submit"
                      className="text-sm px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-background rounded-lg shadow border border-secondary-200 dark:border-secondary-800 p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">
            Welcome to your Dashboard
          </h2>
          <p className="text-secondary-600 dark:text-secondary-400 mb-4">
            This is where you'll be able to upload log files for processing and
            view the analysis results in real-time.
          </p>
        </div>

        {/* File Upload Section */}
        <UploadSection user={user} />

        {/* Processing Queue Section */}
        <QueueSection user={user} />

        {/* Log Statistics Section */}
      </main>
    </div>
  );
}
