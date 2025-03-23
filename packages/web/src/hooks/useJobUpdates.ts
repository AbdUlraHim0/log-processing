import { useState, useEffect, useRef, useCallback } from "react";

interface JobUpdate {
  jobId: string;
  status: "waiting" | "processing" | "completed" | "failed";
  progress: number;
  timestamp: number;
  error?: string;
  linesProcessed?: number;
  totalEntries?: number;
  errorCount?: number;
  keywordMatches?: Record<string, number>;
  ipAddresses?: Record<string, number>;
  processingTime?: number;
}

/**
 * Hook for getting real-time job updates using polling
 * This is more reliable than WebSockets in serverless environments like Next.js
 */
export function useJobUpdates(pollingInterval = 3000) {
  const [jobUpdates, setJobUpdates] = useState<Record<string, JobUpdate>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestTimestampRef = useRef<number>(0);
  const activePollingRef = useRef<boolean>(true);

  const fetchUpdates = useCallback(async () => {
    try {
      if (!activePollingRef.current) return;

      const response = await fetch(
        `/api/live-stats?since=${latestTimestampRef.current}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError("Authentication required");
          activePollingRef.current = false;
          return;
        }
        throw new Error(`Error fetching updates: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.updates && data.updates.length > 0) {
        const updatesMap: Record<string, JobUpdate> = {};
        let maxTimestamp = latestTimestampRef.current;

        data.updates.forEach((update: JobUpdate) => {
          updatesMap[update.jobId] = update;
          maxTimestamp = Math.max(maxTimestamp, update.timestamp);
        });

        latestTimestampRef.current = maxTimestamp;

        setJobUpdates((prev) => ({
          ...prev,
          ...updatesMap,
        }));
      }

      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching job updates:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch updates");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isEventSourceSupported = typeof EventSource !== "undefined";

    if (isEventSourceSupported) {
      let eventSource: EventSource | null = null;

      try {
        eventSource = new EventSource(
          `/api/live-stats?since=${latestTimestampRef.current}`
        );

        eventSource.onopen = () => {
          console.log("SSE connection opened");
          setLoading(false);
        };

        eventSource.addEventListener("job-update", (event) => {
          try {
            const update = JSON.parse(event.data) as JobUpdate;

            latestTimestampRef.current = Math.max(
              latestTimestampRef.current,
              update.timestamp
            );

            setJobUpdates((prev) => ({
              ...prev,
              [update.jobId]: update,
            }));

            setLoading(false);
            setError(null);
          } catch (err) {
            console.error("Error parsing SSE update:", err);
          }
        });

        eventSource.onmessage = (event) => {
          console.log("Generic SSE message:", event.data);
        };

        eventSource.onerror = (err) => {
          console.error("SSE error:", err);
          eventSource?.close();
          eventSource = null;
          setError("SSE connection error, falling back to polling");

          fetchUpdates();
          const intervalId = setInterval(fetchUpdates, pollingInterval);

          return () => {
            clearInterval(intervalId);
          };
        };

        return () => {
          eventSource?.close();
        };
      } catch (err) {
        console.error("Error setting up SSE:", err);
        fetchUpdates();
        const intervalId = setInterval(fetchUpdates, pollingInterval);

        return () => {
          clearInterval(intervalId);
        };
      }
    } else {
      fetchUpdates();

      const intervalId = setInterval(fetchUpdates, pollingInterval);

      return () => {
        activePollingRef.current = false;
        clearInterval(intervalId);
      };
    }
  }, [fetchUpdates, pollingInterval]);

  const getJobUpdate = useCallback(
    (jobId: string): JobUpdate | null => {
      return jobUpdates[jobId] || null;
    },
    [jobUpdates]
  );

  const isJobInProgress = useCallback(
    (jobId: string): boolean => {
      const job = jobUpdates[jobId];
      return job
        ? job.status === "processing" || job.status === "waiting"
        : false;
    },
    [jobUpdates]
  );

  const isJobCompleted = useCallback(
    (jobId: string): boolean => {
      const job = jobUpdates[jobId];
      return job ? job.status === "completed" : false;
    },
    [jobUpdates]
  );

  const isJobFailed = useCallback(
    (jobId: string): boolean => {
      const job = jobUpdates[jobId];
      return job ? job.status === "failed" : false;
    },
    [jobUpdates]
  );

  return {
    jobUpdates,
    loading,
    error,
    getJobUpdate,
    isJobInProgress,
    isJobCompleted,
    isJobFailed,
  };
}

/**
 * Hook for getting updates about a specific job
 */
export function useJobUpdate(jobId: string | null, pollingInterval = 2000) {
  const [jobUpdate, setJobUpdate] = useState<JobUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activePollingRef = useRef<boolean>(true);

  const fetchJobUpdate = useCallback(async () => {
    if (!jobId || !activePollingRef.current) return;

    try {
      const response = await fetch(`/api/live-stats?jobId=${jobId}`);

      if (!response.ok) {
        if (response.status === 401) {
          setError("Authentication required");
          activePollingRef.current = false;
          return;
        }
        throw new Error(`Error fetching job update: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.updates && data.updates.length > 0) {
        const latestUpdate = data.updates.reduce(
          (latest: JobUpdate | null, current: JobUpdate) =>
            !latest || current.timestamp > latest.timestamp ? current : latest,
          null
        );

        if (latestUpdate) {
          setJobUpdate(latestUpdate);
        }
      }

      setLoading(false);
      setError(null);
    } catch (err) {
      console.error(`Error fetching update for job ${jobId}:`, err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch job update"
      );
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);
    setJobUpdate(null);
    activePollingRef.current = true;

    fetchJobUpdate();

    const intervalId = setInterval(fetchJobUpdate, pollingInterval);

    return () => {
      activePollingRef.current = false;
      clearInterval(intervalId);
    };
  }, [jobId, pollingInterval, fetchJobUpdate]);

  return { jobUpdate, loading, error };
}

/**
 * Hook for subscribing to a specific job's updates
 * This combines the best of both worlds: initial fetch + SSE subscription
 */
export function useJobSubscription(jobId: string | null) {
  const [jobUpdate, setJobUpdate] = useState<JobUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);
    setJobUpdate(null);
    setConnected(false);

    fetch(`/api/live-stats?jobId=${jobId}`)
      .then((response) => {
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Authentication required");
          }
          throw new Error(`Error fetching job update: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.updates && data.updates.length > 0) {
          const latestUpdate = data.updates.reduce(
            (latest: JobUpdate | null, current: JobUpdate) =>
              !latest || current.timestamp > latest.timestamp
                ? current
                : latest,
            null
          );

          if (latestUpdate) {
            setJobUpdate(latestUpdate);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(`Error fetching initial update for job ${jobId}:`, err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch job update"
        );
        setLoading(false);
      });

    if (typeof EventSource !== "undefined") {
      try {
        const source = new EventSource(`/api/live-stats?jobId=${jobId}`);
        eventSourceRef.current = source;

        source.onopen = () => {
          console.log(`SSE connection opened for job ${jobId}`);
          setConnected(true);
        };

        source.addEventListener("job-update", (event) => {
          try {
            const update = JSON.parse(event.data) as JobUpdate;
            if (update.jobId === jobId) {
              setJobUpdate(update);
            }
          } catch (err) {
            console.error("Error parsing SSE job update:", err);
          }
        });

        source.onerror = (err) => {
          console.error(`SSE error for job ${jobId}:`, err);
          setConnected(false);

          setTimeout(() => {
            source.close();
            const newSource = new EventSource(`/api/live-stats?jobId=${jobId}`);
            eventSourceRef.current = newSource;
          }, 2000);
        };
      } catch (err) {
        console.error(`Error setting up SSE for job ${jobId}:`, err);
        setError(
          `Error connecting to real-time updates: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    } else {
      console.log("EventSource not supported, using polling fallback");

      const pollInterval = setInterval(() => {
        fetch(`/api/live-stats?jobId=${jobId}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.updates && data.updates.length > 0) {
              // Get the most recent update
              const latestUpdate = data.updates.reduce(
                (latest: JobUpdate | null, current: JobUpdate) =>
                  !latest || current.timestamp > latest.timestamp
                    ? current
                    : latest,
                null
              );

              if (latestUpdate) {
                setJobUpdate(latestUpdate);
              }
            }
          })
          .catch((err) => {
            console.error(`Polling error for job ${jobId}:`, err);
          });
      }, 3000);

      return () => {
        clearInterval(pollInterval);
      };
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId]);

  return {
    jobUpdate,
    loading,
    error,
    connected,
  };
}
