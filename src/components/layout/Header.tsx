import React, { useState, useRef, useEffect } from "react";
import { Search, Bell, Plus, Menu, Check, Trash2, Tag, ShoppingBag, Info, ShieldCheck, ExternalLink, Languages, Sun, Moon } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

interface HeaderProps {
  toggleSidebar: () => void;
  title: string;
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  notifications?: any[];
  setNotifications?: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveTab?: (tab: string) => void;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
  serverStatus?: "connecting" | "healthy" | "data_error" | "offline";
}

export default function Header({ 
  toggleSidebar, 
  title,
  searchQuery,
  setSearchQuery,
  notifications = [],
  setNotifications,
  setActiveTab,
  theme,
  toggleTheme,
  serverStatus = "healthy"
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    if (setNotifications) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const clearAll = () => {
    if (setNotifications) {
      setNotifications([]);
    }
  };

  const handleNotificationClick = (n: any) => {
    if (setNotifications) {
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
    }
    if (setActiveTab && n.actiontab) {
      setActiveTab(n.actiontab);
    }
    setShowNotifDropdown(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 pl-2 pr-4 md:pl-3 md:pr-6 py-4 flex items-center justify-between transition-colors">
      
      {/* Brand & Left Navigation context */}
      <div className="flex items-center gap-1.5 md:gap-3">
        <button 
          onClick={toggleSidebar} 
          className="p-1.5 md:p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-300 transition-colors active:scale-95" 
          title="Toggle Sidebar"
          id="btn-sidebar-toggle"
        >
          <Menu size={19} />
        </button>
        <h1 className="text-sm md:text-lg font-bold text-zinc-900 dark:text-white truncate font-serif tracking-tight pr-1 flex items-center gap-2">
          <span>{title}</span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium font-sans border transition-all ${
            serverStatus === "healthy"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/20"
              : serverStatus === "data_error"
              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/20 animate-pulse"
              : serverStatus === "connecting"
              ? "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/20 animate-pulse"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              serverStatus === "healthy"
                ? "bg-emerald-500"
                : serverStatus === "data_error"
                ? "bg-amber-500"
                : serverStatus === "connecting"
                ? "bg-zinc-400 animate-ping"
                : "bg-rose-500"
            }`} />
            <span className="hidden sm:inline">
              {serverStatus === "healthy" && "API Online"}
              {serverStatus === "data_error" && "Ledger Sync Issue"}
              {serverStatus === "connecting" && "Syncing..."}
              {serverStatus === "offline" && "Server Offline"}
            </span>
            <span className="sm:hidden text-[8px]">
              {serverStatus === "healthy" && "Online"}
              {serverStatus === "data_error" && "DB Err"}
              {serverStatus === "connecting" && "..."}
              {serverStatus === "offline" && "Offline"}
            </span>
          </span>
        </h1>
      </div>

      {/* Interactive Global controls */}
      <div className="flex items-center gap-2.5 md:gap-4">
        
        {/* Real-time Global Search bar */}
        <div className="relative flex-1 md:flex-initial min-w-[130px] sm:min-w-[180px] md:min-w-[280px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input 
            type="text" 
            placeholder={t("header.searchPlaceholder")} 
            value={searchQuery || ""}
            onChange={(e) => setSearchQuery?.(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-550 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors border border-transparent dark:border-transparent" 
            id="global-header-search"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery?.("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold font-sans transition-colors p-0.5"
              title="Clear Search"
            >
              ×
            </button>
          )}
        </div>

        {/* Action Button - Quick Add Order shortcut */}
        <button 
          onClick={() => {
            if (setActiveTab) {
              setActiveTab("orders");
              // Wait briefly and click add order if available
              setTimeout(() => {
                const addBtn = document.getElementById("btn-add-manual-order");
                addBtn?.click();
              }, 120);
            }
          }}
          className="hidden sm:flex bg-amber-500 hover:bg-amber-600 dark:bg-amber-500/90 dark:hover:bg-amber-500 text-zinc-950 px-3.5 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
          id="btn-fast-add-order"
        >
          <Plus size={14} className="stroke-[3]" />
          <span>{t("header.newOrder")}</span>
        </button>

        {/* Quick Language Toggle in Header */}
        <button 
          onClick={() => setLanguage(language === "en" ? "gu" : "en")}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-805 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-amber-650 dark:hover:text-amber-400 hover:border-amber-500/40 transition-all active:scale-95 cursor-pointer bg-white dark:bg-zinc-900 shadow-3xs"
          title={language === "en" ? t("Switch to Gujarati") : t("Switch to English")}
          id="btn-header-language-toggle"
        >
          <Languages size={13} className="text-zinc-400 dark:text-zinc-500" />
          <span>{language === "en" ? "EN / ગુ" : "ગુ / EN"}</span>
        </button>

        {/* Dynamic Theme Mode Toggle in Header */}
        {toggleTheme && (
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-805 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-amber-500/30 text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-all active:scale-95 cursor-pointer bg-white dark:bg-zinc-900"
            title={theme === "dark" ? "Toggle Light Mode" : "Toggle Dark Mode"}
            id="btn-header-theme-toggle"
          >
            {theme === "dark" ? (
              <Sun size={15} className="text-amber-500" />
            ) : (
              <Moon size={15} className="text-zinc-500" />
            )}
          </button>
        )}

        {/* Notifications Popover Dropdown Container */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className={`p-2 rounded-lg transition-all relative ${
              showNotifDropdown 
                ? "bg-zinc-200 dark:bg-zinc-800" 
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            title="Operational Alerts"
            id="btn-alerts-popover"
          >
            <Bell size={18} className="text-zinc-600 dark:text-zinc-300" />
            
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4.5 min-w-[18px] px-1 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border border-white dark:border-zinc-900 animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifDropdown && (
            <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-fadeIn divide-y divide-zinc-100 dark:divide-zinc-800">
              
              {/* Header block */}
              <div className="p-3.5 px-4 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs uppercase tracking-wider text-zinc-400">{t("header.alertCenter")}</span>
                  {unreadCount > 0 && (
                    <span className="bg-amber-105 border border-amber-200/50 text-amber-900 dark:bg-amber-950 dark:border-amber-900/30 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} {t("header.unread")}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {notifications.length > 0 && (
                    <>
                      <button 
                        onClick={markAllRead} 
                        className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 hover:underline transition-all"
                      >
                        <Check size={11} /> {t("header.markRead")}
                      </button>
                      <button 
                        onClick={clearAll} 
                        className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-red-650 flex items-center gap-1 hover:underline transition-all"
                      >
                        <Trash2 size={11} /> {t("header.clearAll")}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/65">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
                    <p className="text-xs font-serif italic text-zinc-500 dark:text-zinc-400">All metrics running optimally</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-550">No operational alerts to review at this time.</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    let iconBg = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400";
                    let IconComponent = Info;
                    if (n.type === "success") {
                      iconBg = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
                      IconComponent = ShoppingBag;
                    }

                    return (
                      <div 
                        key={n.id} 
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 px-4 text-left transition-colors cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800 flex gap-3 items-start relative ${
                          !n.read ? "bg-amber-50/15 dark:bg-amber-950/5 font-medium border-l-2 border-amber-500" : "opacity-80"
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${iconBg}`}>
                          <IconComponent size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline gap-1">
                            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{n.title}</h3>
                            <span className="text-[9px] text-zinc-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[10.5px] leading-relaxed text-zinc-550 dark:text-zinc-400 mt-0.5 break-words">
                            {n.message}
                          </p>
                          {n.actiontab && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-1.5 hover:underline">
                              Manage order <ExternalLink size={8} />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Footer status bar */}
              <div className="p-2 bg-zinc-50 dark:bg-zinc-900/60 text-center text-[9px] text-zinc-400 dark:text-zinc-550 font-mono">
                {t("header.liveChannel")}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
