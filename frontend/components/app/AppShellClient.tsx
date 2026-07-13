"use client";

/**
 * AppShellClient — client component wrapper for the app shell.
 * Handles chat panel state and passes it to TopBar.
 */

import { useState } from "react";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import ChatPanel from "@/components/ChatPanel";

export default function AppShellClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex-1 ml-[200px] flex flex-col min-h-screen">
      <TopBar onChatToggle={() => setChatOpen(!chatOpen)} />
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
