import React, { useState } from "react";
import { Search, Tag, Users, Calendar, Sparkles, MessageSquare, Save } from "lucide-react";
import { Customer, Order } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface CustomersTabProps {
  customers: Customer[];
  orders: Order[];
  onUpdateCustomerNote?: (phone: string, notes: string) => Promise<void>;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
}

export default function CustomersTab({
  customers,
  orders,
  onUpdateCustomerNote,
  searchQuery: propSearchQuery,
  onSearchQueryChange
}: CustomersTabProps) {
  const { t } = useLanguage();
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
  const setSearchQuery = onSearchQueryChange !== undefined ? onSearchQueryChange : setLocalSearchQuery;
  const [selectedTag, setSelectedTag] = useState<"all" | string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<"all" | string>("all");
  const [editingNotesPhone, setEditingNotesPhone] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");

  // Get distinct tags across all customer lists
  const allTags = Array.from(new Set(customers.flatMap(c => c.tags || [])));

  // Filter list
  const filteredCustomers = customers.filter(c => {
    const nameStr = c.name || "";
    const phoneStr = c.phone || "";
    const notesStr = c.notes || "";
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      nameStr.toLowerCase().includes(searchLower) ||
      phoneStr.includes(searchQuery) ||
      notesStr.toLowerCase().includes(searchLower) ||
      (c.preferredLanguage && c.preferredLanguage.toLowerCase().includes(searchLower)) ||
      (c.tags && c.tags.some(t => t.toLowerCase().includes(searchLower)));

    const matchesTag = selectedTag === "all" || (c.tags && c.tags.includes(selectedTag));
    const matchesLang = selectedLanguage === "all" || c.preferredLanguage === selectedLanguage;

    return matchesSearch && matchesTag && matchesLang;
  });

  // Calculate stats
  const totalCustomersCount = customers.length;
  const vipCustomersCount = customers.filter(c => c.tags && c.tags.includes("VIP")).length;
  
  const getCustomerOrderCount = (phone: string) => {
    return orders.filter(o => o.customerPhone === phone).length;
  };

  const getCustomerLifetimeValue = (phone: string) => {
    return orders
      .filter(o => o.customerPhone === phone && o.paymentStatus === "Paid")
      .reduce((sum, current) => sum + current.amount, 0);
  };

  const startEditingNotes = (c: Customer) => {
    setEditingNotesPhone(c.phone);
    setEditingNotesText(c.notes || "");
  };

  const saveNotes = async (phone: string) => {
    if (onUpdateCustomerNote) {
      await onUpdateCustomerNote(phone, editingNotesText);
    }
    setEditingNotesPhone(null);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-6 transition-colors">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-lg">{t("customers.title")}</h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400">{t("customers.desc")}</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="bg-stone-50 dark:bg-zinc-950/40 border border-stone-200 dark:border-zinc-805 px-3.5 py-1.5 rounded-xl text-center">
            <span className="block text-[9px] uppercase font-bold text-stone-400">Total Patrons</span>
            <strong className="text-stone-900 dark:text-zinc-100 font-serif text-sm">{totalCustomersCount}</strong>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 px-3.5 py-1.5 rounded-xl text-center">
            <span className="block text-[9px] uppercase font-bold text-amber-500">VIP High-volume</span>
            <strong className="text-stone-900 dark:text-zinc-100 font-serif text-sm">{vipCustomersCount}</strong>
          </div>
        </div>
      </div>

      {/* Directory Searches and Filters */}
      <div className="flex flex-col md:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            type="text"
            placeholder={t("customers.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 rounded-xl focus:bg-white dark:focus:bg-zinc-850 focus:outline-hidden"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 rounded-xl px-3 py-2 outline-hidden"
          >
            <option value="all">All Member Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>Tag: {tag}</option>
            ))}
          </select>

          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 rounded-xl px-3 py-2 outline-hidden"
          >
            <option value="all">All Dialects</option>
            <option value="Gujarati">ગુજરાતી (Gujarati)</option>
            <option value="Gujlish">Gujlish (Gujarati-English mix)</option>
            <option value="English">English</option>
          </select>
        </div>
      </div>

      {/* Customer bento styled grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((c) => {
            const numOrders = getCustomerOrderCount(c.phone);
            const ltv = getCustomerLifetimeValue(c.phone);

            return (
              <div 
                key={c.phone} 
                className="bg-stone-50/45 dark:bg-zinc-950/20 hover:bg-stone-50/90 dark:hover:bg-zinc-800/10 border border-stone-200/80 dark:border-zinc-800/85 p-5 rounded-2xl flex flex-col justify-between transition group hover:shadow-md dark:hover:shadow-none hover:shadow-stone-200/30"
              >
                <div className="space-y-3">
                  {/* Header info */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm group-hover:text-amber-800 dark:group-hover:text-amber-400 transition">
                        {c.name}
                      </h3>
                      <span className="text-[10px] text-stone-400 dark:text-zinc-500 block font-mono">+{c.phone}</span>
                    </div>
                    {/* Dialect tag */}
                    <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-350 border border-amber-100 dark:border-amber-900/30 font-serif px-2 py-0.5 rounded text-[9px] uppercase font-bold">
                      {c.preferredLanguage}
                    </span>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 gap-2 bg-white/70 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-zinc-800/40 text-[10px] text-stone-500 dark:text-zinc-400">
                    <div>
                      <span className="block uppercase tracking-wider text-[8px] text-stone-400 font-semibold">Ghee Ordered</span>
                      <strong className="text-stone-800 dark:text-zinc-200 font-serif text-xs">{numOrders} time(s)</strong>
                    </div>
                    <div>
                      <span className="block uppercase tracking-wider text-[8px] text-stone-400 font-semibold">Total Revenue</span>
                      <strong className="text-amber-900 dark:text-amber-400 text-xs font-bold font-mono">₹{ltv.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>

                  {/* Dispatch Location info */}
                  <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                    <span className="font-bold text-stone-400 uppercase tracking-wide text-[8px] block">Shipping Destination</span>
                    <p className="line-clamp-2 italic text-stone-600 dark:text-zinc-400 mt-0.5 leading-relaxed bg-white/30 dark:bg-zinc-950/30 p-1.5 rounded border border-stone-100/50 dark:border-zinc-800/60">
                      {c.address ? c.address : "Address data pending in call record log"}
                    </p>
                  </div>

                  {/* Operational Notes / Reminders */}
                  <div className="text-[11px] space-y-1 bg-amber-50/15 dark:bg-amber-950/10 p-2 rounded-xl border border-amber-200/25 dark:border-amber-900/10">
                    <span className="font-bold text-stone-400 uppercase tracking-wide text-[8px] flex items-center gap-1">
                      <MessageSquare className="w-2.5 h-2.5 text-amber-600" />
                      <span>CRM Patron Insight</span>
                    </span>
                    {editingNotesPhone === c.phone ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editingNotesText}
                          onChange={(e) => setEditingNotesText(e.target.value)}
                          className="flex-1 text-[11px] bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 text-stone-850 dark:text-zinc-100 rounded px-2 py-0.5 outline-hidden"
                          autoFocus
                        />
                        <button
                          onClick={() => saveNotes(c.phone)}
                          className="bg-stone-900 dark:bg-zinc-800 text-white dark:text-zinc-100 hover:bg-stone-800 dark:hover:bg-zinc-700 p-1 rounded transition cursor-pointer"
                          title="Save Insights"
                          id={`btn-save-note-${c.phone}`}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p 
                        className="text-stone-500 dark:text-zinc-400 cursor-pointer hover:bg-amber-100/30 dark:hover:bg-amber-900/30 p-1 rounded-sm transition text-[10px]"
                        onClick={() => startEditingNotes(c)}
                        title="Click to edit notes"
                        id={`text-customer-note-${c.phone}`}
                      >
                        {c.notes ? c.notes : "Click to log custom patron preference..."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tags bottom display */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-zinc-800 flex flex-wrap gap-1">
                  {c.tags && c.tags.map(tag => (
                    <span 
                      key={tag} 
                      onClick={() => setSelectedTag(selectedTag === tag ? "all" : tag)}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                        selectedTag === tag 
                          ? "bg-stone-900 dark:bg-zinc-100 text-stone-100 dark:text-zinc-900 border border-stone-900 dark:border-zinc-100" 
                          : "bg-stone-100 dark:bg-zinc-805 text-stone-500 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700 border border-stone-200/30 dark:border-zinc-800"
                      }`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 text-stone-400 font-serif italic text-sm">
            No patrons matching standard queries found in this repository.
          </div>
        )}
      </div>
    </div>
  );
}
