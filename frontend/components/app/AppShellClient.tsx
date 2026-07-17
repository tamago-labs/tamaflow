"use client";

/**
 * AppShellClient — client component wrapper for the app shell.
 * Handles chat panel state and floating chat button.
 */

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import ChatPanel from "@/components/app/ChatPanel";

export default function AppShellClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex-1 ml-[200px] flex flex-col min-h-screen">
      <TopBar />
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>

      {/* Floating chat button */}
      <button
        type="button"
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed right-6 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue text-white shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
        title="Team Chat"
      >
        <MessageCircle size={20} />
      </button>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
