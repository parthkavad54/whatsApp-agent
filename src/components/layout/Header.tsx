import { Search, Bell, Plus, Menu } from "lucide-react";

interface HeaderProps {
  toggleSidebar: () => void;
  title: string;
}

export default function Header({ toggleSidebar, title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="md:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Menu size={20} className="text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm focus:outline-none w-64" />
        </div>
        <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 relative">
            <Bell size={20} className="text-zinc-600 dark:text-zinc-300" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="bg-amber-500 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-amber-600">
            <Plus size={16} />
            <span>Add</span>
        </button>
      </div>
    </header>
  );
}
