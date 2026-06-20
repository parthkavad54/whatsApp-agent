import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useLanguage } from "../../context/LanguageContext";

interface AppShellProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  children: React.ReactNode;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  notifications?: any[];
  setNotifications?: React.Dispatch<React.SetStateAction<any[]>>;
  serverStatus?: "connecting" | "healthy" | "data_error" | "offline";
  heartbeatStatus?: "healthy" | "offline";
}

export default function AppShell({ 
  activeTab, 
  setActiveTab, 
  children,
  searchQuery,
  setSearchQuery,
  notifications,
  setNotifications,
  serverStatus = "healthy",
  heartbeatStatus = "healthy"
}: AppShellProps) {
  const { t } = useLanguage();
  // Theme state synced with local storage and system preferences
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
      
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    }
    return "light";
  });

  // Sidebar starts open on desktop, closed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Responsive resize handler & Rotation synchronizer
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll on mobile viewports when the sidebar is open
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isSidebarOpen && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const getTitle = () => {
    switch (activeTab) {
        case "analytics": return t("nav.overview");
        case "orders": return t("nav.orders");
        case "customers": return t("nav.customers");
        case "ai-agent": return t("nav.ai-agent");
        case "analytics-detail": return t("nav.analytics");
        case "integrations": return t("nav.integrations");
        case "logs": return t("nav.logs");
        default: return "Dashboard";
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex font-sans transition-colors duration-300">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
        theme={theme}
        toggleTheme={toggleTheme}
      />
      
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "md:ml-60" : "md:ml-0"} flex flex-col h-screen overflow-hidden`}>
        <Header 
          toggleSidebar={toggleSidebar} 
          title={getTitle()} 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          notifications={notifications}
          setNotifications={setNotifications}
          setActiveTab={setActiveTab}
          theme={theme}
          toggleTheme={toggleTheme}
          serverStatus={serverStatus}
          heartbeatStatus={heartbeatStatus}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
        </main>
      </div>
    </div>
  );
}
