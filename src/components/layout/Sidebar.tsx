
import { LayoutDashboard, Users, MessageSquare, TrendingUp, Settings, LogOut, Bot, Plug, Languages, Moon, Sun, ShoppingBag } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, toggleSidebar, theme, toggleTheme }: SidebarProps) {
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { id: "analytics", label: t("nav.overview"), icon: LayoutDashboard },
    { id: "orders", label: t("nav.orders"), icon: ShoppingBag },
    { id: "customers", label: t("nav.customers"), icon: Users },
    { id: "ai-agent", label: t("nav.ai-agent"), icon: Bot },
    { id: "analytics-detail", label: t("nav.analytics"), icon: TrendingUp },
    { id: "integrations", label: t("nav.integrations"), icon: Plug },
    { id: "logs", label: t("nav.logs"), icon: MessageSquare },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={toggleSidebar}
        />
      )}

      <aside className={`w-60 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 flex flex-col h-screen overflow-y-auto fixed top-0 z-50 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"} border-r border-zinc-200 dark:border-zinc-800 shadow-xs`}>
        {/* Logo */}
        <div className="p-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 text-zinc-900 rounded-lg p-2 h-9 w-9 flex items-center justify-center font-bold">D</div>
            <span className="font-bold text-zinc-900 dark:text-white text-xl">Desi Ghee</span>
          </div>
        </div>
        
        {/* Nav Items */}
        <nav className="flex-1 px-3 space-y-1 shrink-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 768) toggleSidebar();
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === item.id 
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100" 
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom Toggles + Profile */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 mt-auto shrink-0">
          <div className="flex items-center justify-between px-2 pb-2">
            <button 
              onClick={() => setLanguage(language === "en" ? "gu" : "en")}
              className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors p-1 rounded-lg"
              title={language === "en" ? "Switch to Gujarati" : "Switch to English"}
            >
              <Languages size={16}/> {language === "en" ? "EN / ગુ" : "ગુ / EN"}
            </button>
            <button 
              onClick={toggleTheme}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-amber-500 dark:hover:text-amber-400 transition-all active:scale-95"
              title={theme === "dark" ? "Toggle Light Mode" : "Toggle Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun size={17} className="text-amber-500" />
              ) : (
                <Moon size={17} className="text-zinc-500 dark:text-zinc-400" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-900 dark:bg-zinc-800 dark:text-zinc-200 flex items-center justify-center font-bold text-xs">D</div>
            <div>
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("profile.name")}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("profile.role")}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
