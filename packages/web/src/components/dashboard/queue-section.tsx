"use client";

import { useTheme } from "@/context/theme-context";
import { useWebSocket } from "@/context/websocket-context";
import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

interface QueueSectionProps {
  user: User;
}

interface JobStats {
  jobId: string;
  fileName: string;
  fileSize: number;
  status: "waiting" | "processing" | "completed" | "failed";
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  totalEntries: number;
  errorCount: number;
  processingTime?: number;
  error?: string;
}

interface QueueStatus {
  queueName: string;
  counts: {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
  };
  recentJobs: JobStats[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export const QueueSection = ({ user }: QueueSectionProps) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [refreshInterval, setRefreshInterval] = useState<number>(10000); // 10 seconds
  const { theme } = useTheme();

  const { isConnected, connectionError, jobUpdates } = useWebSocket();

  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/queue-status?page=${page}&pageSize=${pageSize}`
        );

        if (!response.ok) {
          throw new Error(
            `Error fetching queue status: ${response.statusText}`
          );
        }

        const data = await response.json();
        setQueueStatus(data);
        setError(null);
      } catch (err) {
        setError("Failed to fetch queue status. Please try again.");
        console.error("Error fetching queue status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQueueStatus();

    const intervalId = setInterval(fetchQueueStatus, refreshInterval);

    return () => clearInterval(intervalId);
  }, [page, pageSize, refreshInterval]);

  useEffect(() => {
    if (queueStatus && Object.keys(jobUpdates).length > 0) {
      setQueueStatus((prev) => {
        if (!prev) return prev;

        const updatedJobs = prev.recentJobs.map((job) => {
          const update = jobUpdates[job.jobId];
          if (update) {
            return {
              ...job,
              status: update.status,
              progress: update.progress,
              ...(update.error && { error: update.error }),
            };
          }
          return job;
        });

        const newCounts = {
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          waiting: 0,
        };

        updatedJobs.forEach((job) => {
          if (job.status === "waiting") newCounts.waiting++;
          else if (job.status === "processing") newCounts.active++;
          else if (job.status === "completed") newCounts.completed++;
          else if (job.status === "failed") newCounts.failed++;
        });

        return {
          ...prev,
          recentJobs: updatedJobs,
          counts: {
            ...prev.counts,
            ...newCounts,
          },
        };
      });
    }
  }, [jobUpdates]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(1) + " GB";
  };

  // Format date in a human-readable format
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  // Calculate time elapsed since a given timestamp
  const timeElapsed = (startTime: string, endTime?: string): string => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const elapsed = end - start;

    if (elapsed < 1000) return `${elapsed}ms`;
    if (elapsed < 60000) return `${Math.floor(elapsed / 1000)}s`;
    if (elapsed < 3600000)
      return `${Math.floor(elapsed / 60000)}m ${Math.floor(
        (elapsed % 60000) / 1000
      )}s`;
    return `${Math.floor(elapsed / 3600000)}h ${Math.floor(
      (elapsed % 3600000) / 60000
    )}m`;
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Handle view job details
  const handleViewJob = (jobId: string) => {
    window.open(`/dashboard/job/${jobId}`, "_blank");
  };

  return (
    <div className="bg-background rounded-lg shadow border border-secondary-200 dark:border-secondary-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Log Processing Queue</h3>

        <div className="flex items-center space-x-4">
          {isConnected ? (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              Connected
            </span>
          ) : (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
              Disconnected
            </span>
          )}

          <label className="text-sm text-secondary-600 dark:text-secondary-400">
            Refresh every:
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
            className="text-sm bg-background border border-secondary-300 dark:border-secondary-700 rounded p-1"
          >
            <option value="5000">5s</option>
            <option value="10000">10s</option>
            <option value="30000">30s</option>
            <option value="60000">1m</option>
          </select>
        </div>
      </div>

      {/* Show WebSocket connection error if any */}
      {connectionError && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded text-amber-800 dark:text-amber-400 text-sm">
          <strong>WebSocket:</strong> {connectionError}
        </div>
      )}

      {loading && !queueStatus ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-md">
          {error}
        </div>
      ) : queueStatus ? (
        <>
          {/* Queue stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Waiting
              </div>
              <div className="text-xl font-semibold">
                {queueStatus.counts.waiting}
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
              <div className="text-sm text-yellow-600 dark:text-yellow-400">
                Active
              </div>
              <div className="text-xl font-semibold">
                {queueStatus.counts.active}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
              <div className="text-sm text-green-600 dark:text-green-400">
                Completed
              </div>
              <div className="text-xl font-semibold">
                {queueStatus.counts.completed}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
              <div className="text-sm text-red-600 dark:text-red-400">
                Failed
              </div>
              <div className="text-xl font-semibold">
                {queueStatus.counts.failed}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-md">
              <div className="text-sm text-purple-600 dark:text-purple-400">
                Delayed
              </div>
              <div className="text-xl font-semibold">
                {queueStatus.counts.delayed}
              </div>
            </div>
          </div>

          {/* Job table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-secondary-100 dark:bg-secondary-800 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                  <th className="p-3">Job ID</th>
                  <th className="p-3">File</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Progress</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 dark:divide-secondary-800">
                {queueStatus.recentJobs.length > 0 ? (
                  queueStatus.recentJobs.map((job) => (
                    <tr
                      key={job.jobId}
                      className="hover:bg-secondary-50 dark:hover:bg-secondary-900"
                    >
                      <td className="p-3 font-mono text-xs">{job.jobId}</td>
                      <td className="p-3">
                        <div>{job.fileName}</div>
                        <div className="text-xs text-secondary-500 dark:text-secondary-400">
                          {formatFileSize(job.fileSize)}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            job.status === "completed"
                              ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400"
                              : job.status === "processing"
                              ? "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400"
                              : job.status === "failed"
                              ? "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400"
                              : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400"
                          }`}
                        >
                          {job.status}
                        </span>
                        {job.error && (
                          <div
                            className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs truncate"
                            title={job.error}
                          >
                            {job.error}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${
                              job.status === "completed"
                                ? "bg-green-600"
                                : job.status === "processing"
                                ? "bg-blue-600"
                                : job.status === "failed"
                                ? "bg-red-600"
                                : "bg-yellow-600"
                            }`}
                            style={{ width: `${job.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                          {job.progress}%
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="p-3 text-sm">
                        {job.status === "completed"
                          ? timeElapsed(job.createdAt, job.completedAt)
                          : timeElapsed(job.createdAt)}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleViewJob(job.jobId)}
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-6 text-center text-secondary-500 dark:text-secondary-400"
                    >
                      No jobs found. Upload a log file to start processing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {queueStatus.pagination.totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-4">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className={`px-3 py-1 rounded ${
                  page === 1
                    ? "text-secondary-400 bg-secondary-100 dark:text-secondary-600 dark:bg-secondary-800 cursor-not-allowed"
                    : "text-secondary-700 bg-secondary-200 hover:bg-secondary-300 dark:text-secondary-300 dark:bg-secondary-700 dark:hover:bg-secondary-600"
                }`}
              >
                Previous
              </button>

              <span className="text-sm text-secondary-600 dark:text-secondary-400">
                Page {page} of {queueStatus.pagination.totalPages}
              </span>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === queueStatus.pagination.totalPages}
                className={`px-3 py-1 rounded ${
                  page === queueStatus.pagination.totalPages
                    ? "text-secondary-400 bg-secondary-100 dark:text-secondary-600 dark:bg-secondary-800 cursor-not-allowed"
                    : "text-secondary-700 bg-secondary-200 hover:bg-secondary-300 dark:text-secondary-300 dark:bg-secondary-700 dark:hover:bg-secondary-600"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-secondary-500 dark:text-secondary-400">
          No queue data available
        </div>
      )}
    </div>
  );
};
