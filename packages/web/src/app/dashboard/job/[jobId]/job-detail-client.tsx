"use client";

import { useTheme } from "@/context/theme-context";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface KeywordMatch {
  keyword: string;
  count: number;
}

interface IpAddress {
  ip: string;
  count: number;
}

interface JobStats {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  fileName: string;
  fileSize: number;
  progress: number;
  totalEntries: number;
  errorCount: number;
  processingTime: number;
  createdAt: string;
  completedAt: string;
  keywordMatches: Record<string, number>;
  ipAddresses: Record<string, number>;
}

interface JobDetailClientProps {
  user: User;
  jobStats: JobStats;
}

export default function JobDetailClient({
  user,
  jobStats,
}: JobDetailClientProps) {
  const { theme, setTheme } = useTheme() || {
    theme: "light",
    setTheme: () => {},
  };
  const [activeTab, setActiveTab] = useState<"overview" | "keywords" | "ips">(
    "overview"
  );
  const [mounted, setMounted] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);

  useEffect(() => {
    if (jobStats.status === "completed") {
      const mockData = [];
      const totalPoints = 20;
      const startTime = new Date(jobStats.createdAt).getTime();
      const endTime = new Date(jobStats.completedAt).getTime();
      const timeStep = (endTime - startTime) / totalPoints;

      let accumulatedEntries = 0;
      const entriesPerStep = jobStats.totalEntries / totalPoints;

      for (let i = 0; i <= totalPoints; i++) {
        const currentTime = new Date(startTime + i * timeStep);
        const randomFactor = 0.8 + Math.random() * 0.4;
        accumulatedEntries = Math.min(
          jobStats.totalEntries,
          Math.round(i * entriesPerStep * randomFactor)
        );

        mockData.push({
          time: currentTime.toLocaleTimeString(),
          processed: accumulatedEntries,
          errors: Math.round(
            (accumulatedEntries / jobStats.totalEntries) *
              jobStats.errorCount *
              randomFactor
          ),
        });
      }

      setTimeSeriesData(mockData);
    }
  }, [jobStats]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const formatFileSize = (bytes: number): string => {
    if (!bytes && bytes !== 0) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(1) + " GB";
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const ipAddresses: IpAddress[] = jobStats.ipAddresses
    ? Object.entries(jobStats.ipAddresses)
        .map(([ip, count]) => ({ ip, count: count as number }))
        .sort((a, b) => b.count - a.count)
    : [];

  const keywordMatches: KeywordMatch[] = jobStats.keywordMatches
    ? Object.entries(jobStats.keywordMatches)
        .map(([keyword, count]) => ({ keyword, count: count as number }))
        .sort((a, b) => b.count - a.count)
    : [];

  console.log("IP Addresses:", ipAddresses);
  console.log("Keyword Matches:", keywordMatches);

  const processingRate =
    jobStats.processingTime && jobStats.processingTime > 0
      ? (jobStats.totalEntries / (jobStats.processingTime / 1000)).toFixed(2)
      : "N/A";

  const totalKeywordMatches = keywordMatches.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Navbar */}
      <nav className="border-b border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-xl font-semibold text-gray-900 dark:text-white flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Dashboard
              </Link>
            </div>

            {/* Theme toggle button */}
            <div className="flex items-center">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-700"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Job Details
              </h2>
              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                {jobStats.jobId || "N/A"}
              </span>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium mt-2 sm:mt-0 ${
                jobStats.status === "completed"
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300"
                  : jobStats.status === "processing"
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300"
                  : jobStats.status === "failed"
                  ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300"
                  : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300"
              }`}
            >
              {jobStats.status
                ? jobStats.status.charAt(0).toUpperCase() +
                  jobStats.status.slice(1)
                : "Unknown"}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full mb-6">
            <div className="flex justify-between mb-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Progress: {jobStats.progress || 0}%
              </span>
              {jobStats.status === "completed" && jobStats.processingTime && (
                <span className="text-green-600 dark:text-green-400">
                  Completed in {(jobStats.processingTime / 1000).toFixed(2)}{" "}
                  seconds
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-1000 ${
                  jobStats.status === "completed"
                    ? "bg-green-500"
                    : jobStats.status === "processing"
                    ? "bg-blue-500"
                    : jobStats.status === "failed"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }`}
                style={{ width: `${jobStats.progress || 0}%` }}
              ></div>
            </div>
          </div>

          {/* File information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow transition-all duration-200 hover:shadow-md">
              <h3 className="font-medium mb-2 text-gray-900 dark:text-white">
                File Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    File Name:
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white truncate max-w-xs">
                    {jobStats.fileName || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    Size:
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white">
                    {formatFileSize(jobStats.fileSize)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    Uploaded:
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white">
                    {formatDate(jobStats.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow transition-all duration-200 hover:shadow-md">
              <h3 className="font-medium mb-2 text-gray-900 dark:text-white">
                Processing Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    Status:
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white">
                    {jobStats.status || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    Processed Entries:
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white">
                    {jobStats.totalEntries !== undefined
                      ? jobStats.totalEntries.toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    Processing Rate:
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white">
                    {processingRate} entries/second
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">
                    Completed:
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-white">
                    {formatDate(jobStats.completedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs for different data views */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "overview"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("keywords")}
                className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "keywords"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                Keywords ({keywordMatches.length})
              </button>
              <button
                onClick={() => setActiveTab("ips")}
                className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "ips"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                IP Addresses ({ipAddresses.length})
              </button>
            </nav>
          </div>

          {/* Tab content */}
          <div>
            {activeTab === "overview" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-red-50 dark:bg-red-900 p-4 rounded-md shadow transition-all duration-200 hover:shadow-md">
                    <div className="text-sm font-medium text-red-600 dark:text-red-300">
                      Errors
                    </div>
                    <div className="text-xl font-semibold text-red-700 dark:text-red-200">
                      {jobStats.errorCount !== undefined
                        ? jobStats.errorCount.toLocaleString()
                        : "N/A"}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {jobStats.totalEntries && jobStats.errorCount
                        ? (
                            (jobStats.errorCount / jobStats.totalEntries) *
                            100
                          ).toFixed(2)
                        : 0}
                      % of total entries
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-md shadow transition-all duration-200 hover:shadow-md">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-300">
                      Keyword Matches
                    </div>
                    <div className="text-xl font-semibold text-blue-700 dark:text-blue-200">
                      {totalKeywordMatches.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Across {keywordMatches.length} keywords
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900 p-4 rounded-md shadow transition-all duration-200 hover:shadow-md">
                    <div className="text-sm font-medium text-green-600 dark:text-green-300">
                      Unique IPs
                    </div>
                    <div className="text-xl font-semibold text-green-700 dark:text-green-200">
                      {ipAddresses.length.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Found in logs
                    </div>
                  </div>
                </div>

                {/* Processing timeline chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-md shadow transition-all duration-200 hover:shadow-md mb-6">
                  <h3 className="font-medium mb-4 text-gray-900 dark:text-white">
                    Processing Timeline
                  </h3>
                  {jobStats.status === "completed" &&
                  timeSeriesData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeSeriesData}>
                          <XAxis
                            dataKey="time"
                            stroke={theme === "dark" ? "#94a3b8" : "#64748b"}
                            tick={{
                              fill: theme === "dark" ? "#e2e8f0" : "#1e293b",
                            }}
                          />
                          <YAxis
                            stroke={theme === "dark" ? "#94a3b8" : "#64748b"}
                            tick={{
                              fill: theme === "dark" ? "#e2e8f0" : "#1e293b",
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor:
                                theme === "dark" ? "#1e293b" : "#ffffff",
                              color: theme === "dark" ? "#e2e8f0" : "#1e293b",
                              border: `1px solid ${
                                theme === "dark" ? "#334155" : "#e2e8f0"
                              }`,
                            }}
                            labelStyle={{
                              color: theme === "dark" ? "#e2e8f0" : "#1e293b",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="processed"
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            dot={false}
                            name="Processed Entries"
                          />
                          <Line
                            type="monotone"
                            dataKey="errors"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            name="Errors"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center">
                      <span className="text-gray-500 dark:text-gray-400">
                        {jobStats.status === "completed"
                          ? "Timeline data not available"
                          : "Processing in progress. Timeline will be available when complete."}
                      </span>
                    </div>
                  )}
                </div>

                {/* Job Information Summary */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-md shadow transition-all duration-200 hover:shadow-md">
                  <h3 className="font-medium mb-4 text-gray-900 dark:text-white">
                    Summary
                  </h3>
                  <div className="max-w-none">
                    <p className="text-gray-800 dark:text-gray-200 mb-3">
                      {`This job processed a ${formatFileSize(
                        jobStats.fileSize
                      )} file containing ${
                        jobStats.totalEntries?.toLocaleString() || 0
                      } log entries.`}
                    </p>
                    {jobStats.status === "completed" && (
                      <>
                        <p className="text-gray-800 dark:text-gray-200 mb-3">
                          {`The processing identified ${totalKeywordMatches.toLocaleString()} keyword matches across ${
                            keywordMatches.length
                          } unique keywords and found ${
                            ipAddresses.length
                          } unique IP addresses.`}
                        </p>
                        <p className="text-gray-800 dark:text-gray-200 mb-3">
                          {`Error rate: ${
                            jobStats.errorCount && jobStats.totalEntries
                              ? (
                                  (jobStats.errorCount /
                                    jobStats.totalEntries) *
                                  100
                                ).toFixed(2)
                              : 0
                          }% (${jobStats.errorCount || 0} entries)`}
                        </p>
                        <p className="text-gray-800 dark:text-gray-200">
                          {`Average processing speed: ${processingRate} entries per second.`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "keywords" && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-md shadow transition-all duration-200 hover:shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Keyword Matches
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Total matches: {totalKeywordMatches.toLocaleString()}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          Keyword
                        </th>
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          Occurrences
                        </th>
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          Percentage
                        </th>
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          Distribution
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {keywordMatches.length > 0 ? (
                        keywordMatches.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <td className="p-3 font-medium text-gray-900 dark:text-white">
                              {item.keyword}
                            </td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">
                              {item.count.toLocaleString()}
                            </td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">
                              {jobStats.totalEntries
                                ? (
                                    (item.count / jobStats.totalEntries) *
                                    100
                                  ).toFixed(2)
                                : 0}
                              %
                            </td>
                            <td className="p-3">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${
                                      totalKeywordMatches
                                        ? (item.count / totalKeywordMatches) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-6 text-center text-gray-500 dark:text-gray-400"
                          >
                            No keyword matches found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "ips" && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-md shadow transition-all duration-200 hover:shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    IP Addresses
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Total unique IPs: {ipAddresses.length}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          IP Address
                        </th>
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          Occurrences
                        </th>
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          Percentage
                        </th>
                        <th className="p-3 border-b border-gray-200 dark:border-gray-600">
                          Distribution
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {ipAddresses.length > 0 ? (
                        ipAddresses.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <td className="p-3 font-mono text-gray-900 dark:text-white">
                              {item.ip}
                            </td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">
                              {item.count.toLocaleString()}
                            </td>
                            <td className="p-3 text-gray-800 dark:text-gray-200">
                              {jobStats.totalEntries
                                ? (
                                    (item.count / jobStats.totalEntries) *
                                    100
                                  ).toFixed(2)
                                : 0}
                              %
                            </td>
                            <td className="p-3">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{
                                    width: `${
                                      (item.count /
                                        (ipAddresses[0]?.count || 1)) *
                                      100
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-6 text-center text-gray-500 dark:text-gray-400"
                          >
                            No IP addresses found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
