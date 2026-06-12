
import { LayoutDashboard, Users, MessageSquare, TrendingUp, Settings, LogOut, Bot, Plug, Languages, Moon } from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, toggleSidebar }: SidebarProps) {
  const navItems = [
    { id: "analytics", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "Orders", icon: ShoppingBag },
    { id: "customers", label: "Customers", icon: Users },
    { id: "ai-agent", label: "AI Agent", icon: Bot },
    { id: "analytics-detail", label: "Analytics", icon: TrendingUp },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "logs", label: "Logs & Activity", icon: MessageSquare },
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

      <aside className={`w-60 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 flex flex-col h-screen fixed top-0 z-50 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 border-r border-zinc-200 dark:border-zinc-800`}>
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 text-zinc-900 rounded-lg p-2 h-9 w-9 flex items-center justify-center font-bold">A</div>
            <span className="font-bold text-zinc-900 dark:text-white text-xl">AxionAI</span>
          </div>
        </div>
        
        {/* Nav Items */}
        <nav className="flex-1 px-3 space-y-1">
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
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between px-2 pb-2">
			<button className="flex items-center gap-2 text-xs text-zinc-500">
				<Languages size={16}/> EN / ગુ
			</button>
			<button className="flex items-center gap-2 text-xs text-zinc-500">
				<Moon size={16}/>
			</button>
          </div>
		  <div className="flex items-center gap-3 px-2">
			<div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center">O</div>
			<div>
				<div className="text-sm font-medium">Owner Name</div>
				<div className="text-xs text-zinc-500">Owner role</div>
			</div>
		  </div>
        </div>
      </aside>
    </>
  );
}

// Added missing import
import { ShoppingBag } from "lucide-react";
