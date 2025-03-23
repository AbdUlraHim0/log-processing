// packages/web/src/context/websocket-context.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Define the type of job updates
interface JobUpdate {
  jobId: string;
  status: "waiting" | "processing" | "completed" | "failed";
  progress: number;
  timestamp: number;
  error?: string;
  linesProcessed?: number;
  stats?: any;
}

// Define the shape of our context
interface WebSocketContextType {
  isConnected: boolean;
  connectionError: string | null;
  jobUpdates: Record<string, JobUpdate>;
  getJobUpdate: (jobId: string) => JobUpdate | null;
  useFallbackPolling: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  connectionError: null,
  jobUpdates: {},
  getJobUpdate: () => null,
  useFallbackPolling: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [jobUpdates, setJobUpdates] = useState<Record<string, JobUpdate>>({});
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [useFallbackPolling, setUseFallbackPolling] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] =
    useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const startPolling = () => {
      console.log("Starting polling fallback for job updates");
      setUseFallbackPolling(true);

      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }

      const intervalId = setInterval(async () => {
        try {
          const response = await fetch(
            "/api/live-stats?since=" + (Date.now() - 10000)
          );
          if (response.ok) {
            const data = await response.json();
            if (data.updates && data.updates.length > 0) {
              const updates: Record<string, JobUpdate> = {};
              data.updates.forEach((update: JobUpdate) => {
                updates[update.jobId] = update;
              });

              setJobUpdates((prev) => ({ ...prev, ...updates }));
            }
          }
        } catch (error) {
          console.warn("Polling error:", error);
        }
      }, 3000);

      setPollingIntervalId(intervalId);
    };

    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        setConnectionError(
          `Failed to connect after ${maxReconnectAttempts} attempts. Falling back to polling.`
        );
        startPolling(); // Start polling as fallback
        return;
      }

      setConnectionError(null);

      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(
          `${protocol}//${window.location.host}/api/live-stats`
        );

        ws.onopen = () => {
          console.log("WebSocket connected");
          setIsConnected(true);
          setSocket(ws);
          reconnectAttempts = 0;
          setUseFallbackPolling(false);

          if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            setPollingIntervalId(null);
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === "job-update") {
              const update = message.data;

              setJobUpdates((prev) => ({
                ...prev,
                [update.jobId]: update,
              }));
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected, attempting to reconnect...");
          setIsConnected(false);
          setSocket(null);

          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

          console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`
          );

          reconnectTimeout = setTimeout(connectWebSocket, delay);

          if (reconnectAttempts >= 2) {
            startPolling();
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionError("Failed to connect to the server. Retrying...");
          ws?.close();
        };
      } catch (error) {
        console.error("Error creating WebSocket:", error);
        setConnectionError(
          "Failed to create WebSocket connection. Falling back to polling."
        );
        startPolling(); // Start polling as fallback
      }
    };

    if (typeof window !== "undefined") {
      try {
        connectWebSocket();
      } catch (error) {
        console.error("Error in WebSocket setup:", error);
        startPolling();
      }
    }

    return () => {
      if (ws) {
        ws.close();
      }

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, []);

  const getJobUpdate = (jobId: string): JobUpdate | null => {
    return jobUpdates[jobId] || null;
  };

  // Create the context value
  const contextValue: WebSocketContextType = {
    isConnected,
    connectionError,
    jobUpdates,
    getJobUpdate,
    useFallbackPolling,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}
