"use client";

import { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

interface LogStats {
  id: string;
  jobId: string;
  fileName: string;
  totalEntries: number;
  errorCount: number;
  keywordMatches: { [key: string]: number };
  ipAddresses: { [key: string]: number };
  createdAt: string;
}

interface StatsSectionProps {
  user: User;
}

export const StatsSection = ({ user }: StatsSectionProps) => {
  const [stats, setStats] = useState<LogStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = selectedJobId
          ? `/api/stats/${selectedJobId}`
          : "/api/stats";

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch log statistics");
        }

        const data = await response.json();
        setStats(selectedJobId ? [data] : data.stats);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [selectedJobId]);

  useEffect(() => {
    const onStatsUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "STATS_UPDATED") {
          if (selectedJobId && data.stats.jobId === selectedJobId) {
            setStats([data.stats]);
          } else if (!selectedJobId) {
            setStats((prevStats) => {
              const exists = prevStats.some(
                (s) => s.jobId === data.stats.jobId
              );
              if (exists) {
                return prevStats.map((s) =>
                  s.jobId === data.stats.jobId ? data.stats : s
                );
              } else {
                return [...prevStats, data.stats];
              }
            });
          }
        }
      } catch (err) {
        console.error("Error processing WebSocket stats message:", err);
      }
    };

    window.addEventListener("log-stats-update", (e: any) =>
      onStatsUpdate(e.detail)
    );

    return () => {
      window.removeEventListener("log-stats-update", (e: any) =>
        onStatsUpdate(e.detail)
      );
    };
  }, [selectedJobId]);

  const renderStats = () => {
    if (isLoading) {
      return (
        <div className="text-center py-8 text-secondary-400 dark:text-secondary-500 bg-secondary-50 dark:bg-secondary-900 rounded-md">
          Loading statistics...
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
          Error: {error}
        </div>
      );
    }

    if (stats.length === 0) {
      return (
        <div className="text-center py-8 text-secondary-400 dark:text-secondary-500 bg-secondary-50 dark:bg-secondary-900 rounded-md">
          No data available
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="bg-background rounded border border-secondary-200 dark:border-secondary-800"
          >
            <div className="px-4 py-3 border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900 font-medium">
              {stat.fileName}
              <span className="ml-2 text-sm text-secondary-500 dark:text-secondary-400">
                (Job ID: {stat.jobId.substring(0, 8)}...)
              </span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Summary Stats */}
              <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-secondary-50 dark:bg-secondary-900 p-4 rounded-lg">
                  <div className="text-xs uppercase text-secondary-500 dark:text-secondary-400">
                    Total Entries
                  </div>
                  <div className="text-2xl font-bold">
                    {stat.totalEntries.toLocaleString()}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <div className="text-xs uppercase text-red-600 dark:text-red-400">
                    Errors
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stat.errorCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="text-xs uppercase text-blue-600 dark:text-blue-400">
                    Keyword Matches
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {Object.values(stat.keywordMatches)
                      .reduce((sum, count) => sum + count, 0)
                      .toLocaleString()}
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <div className="text-xs uppercase text-yellow-600 dark:text-yellow-400">
                    Unique IPs
                  </div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {Object.keys(stat.ipAddresses).length.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Keywords */}
              <div>
                <h4 className="font-medium mb-2 text-secondary-700 dark:text-secondary-300">
                  Keyword Matches
                </h4>
                {Object.keys(stat.keywordMatches).length > 0 ? (
                  <div className="bg-secondary-50 dark:bg-secondary-900 rounded-md p-3 max-h-60 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs uppercase text-secondary-500 dark:text-secondary-400">
                          <th className="pb-2">Keyword</th>
                          <th className="pb-2">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stat.keywordMatches)
                          .sort(([_, countA], [__, countB]) => countB - countA)
                          .map(([keyword, count]) => (
                            <tr
                              key={keyword}
                              className="border-t border-secondary-200 dark:border-secondary-800"
                            >
                              <td className="py-2 font-mono text-sm">
                                {keyword}
                              </td>
                              <td className="py-2 text-sm">{count}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-secondary-400 dark:text-secondary-500 bg-secondary-50 dark:bg-secondary-900 rounded-md">
                    No keyword matches found
                  </div>
                )}
              </div>

              {/* IP Addresses */}
              <div>
                <h4 className="font-medium mb-2 text-secondary-700 dark:text-secondary-300">
                  Top IP Addresses
                </h4>
                {Object.keys(stat.ipAddresses).length > 0 ? (
                  <div className="bg-secondary-50 dark:bg-secondary-900 rounded-md p-3 max-h-60 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs uppercase text-secondary-500 dark:text-secondary-400">
                          <th className="pb-2">IP Address</th>
                          <th className="pb-2">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stat.ipAddresses)
                          .sort(([_, countA], [__, countB]) => countB - countA)
                          .slice(0, 10) // Show top 10
                          .map(([ip, count]) => (
                            <tr
                              key={ip}
                              className="border-t border-secondary-200 dark:border-secondary-800"
                            >
                              <td className="py-2 font-mono text-sm">{ip}</td>
                              <td className="py-2 text-sm">{count}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-secondary-400 dark:text-secondary-500 bg-secondary-50 dark:bg-secondary-900 rounded-md">
                    No IP addresses found
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-background rounded-lg shadow border border-secondary-200 dark:border-secondary-800 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Log Statistics</h3>
        {stats.length > 0 && (
          <select
            className="text-sm rounded-md border border-secondary-300 dark:border-secondary-700 bg-background px-3 py-1"
            value={selectedJobId || ""}
            onChange={(e) => setSelectedJobId(e.target.value || null)}
          >
            <option value="">All Jobs</option>
            {stats.map((stat) => (
              <option key={stat.jobId} value={stat.jobId}>
                {stat.fileName} ({stat.jobId.substring(0, 8)}...)
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
        View statistics from processed log files.
      </p>
      {renderStats()}
    </div>
  );
};
