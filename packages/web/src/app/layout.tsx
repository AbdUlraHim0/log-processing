// packages/web/src/app/dashboard/layout.tsx
import React from "react";
import { ThemeProvider } from "@/context/theme-context";
import "./globals.css"; // Make sure this is included

import { WebSocketProvider } from "@/context/websocket-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <WebSocketProvider>{children}</WebSocketProvider>
    </ThemeProvider>
  );
}
