import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface AppShellProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  children: React.ReactNode;
}

export default function AppShell({ activeTab, setActiveTab, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const getTitle = () => {
    switch (activeTab) {
        case "analytics": return "Overview";
        case "orders": return "Orders";
        case "customers": return "Customers";
        case "ai-agent": return "AI Agent";
        case "analytics-detail": return "Analytics";
        case "integrations": return "Integrations";
        case "logs": return "Logs & Activity";
        default: return "Dashboard";
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <Header toggleSidebar={toggleSidebar} title={getTitle()} />
        <main className="flex-1 p-6">
            {children}
        </main>
      </div>
    </div>
  );
}
