import React, { useState } from "react";
import { 
  FileSpreadsheet, 
  Coins, 
  MessageSquare, 
  Phone, 
  Clock, 
  Terminal, 
  Layers, 
  Database,
  Search,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { WebhookLog, CallLog } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface LogsTabProps {
  webhookLogs: WebhookLog[];
  callLogs: CallLog[];
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
}

export default function LogsTab({
  webhookLogs = [],
  callLogs = [],
  searchQuery: propSearchQuery,
  onSearchQueryChange
}: LogsTabProps) {
  const { t } = useLanguage();
  // Nested subtab select "webhooks" | "calls"
  const [activeLogSub, setActiveLogSub] = useState<"webhooks" | "calls">("webhooks");
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
  const setSearchQuery = onSearchQueryChange !== undefined ? onSearchQueryChange : setLocalSearchQuery;
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);

  const toggleWebhookExpand = (id: string) => {
    setExpandedWebhookId(expandedWebhookId === id ? null : id);
  };

  // Filter logs
  const filteredWebhooks = webhookLogs.filter(w => {
    const term = searchQuery.toLowerCase();
    return (
      w.service.toLowerCase().includes(term) ||
      w.event.toLowerCase().includes(term) ||
      w.id.toLowerCase().includes(term) ||
      JSON.stringify(w.payload).toLowerCase().includes(term)
    );
  });

  const filteredCalls = callLogs.filter(c => {
    const term = searchQuery.toLowerCase();
    return (
      c.customerPhone.includes(term) ||
      c.id.toLowerCase().includes(term) ||
      c.summary.toLowerCase().includes(term) ||
      (c.customerName && c.customerName.toLowerCase().includes(term))
    );
  });

  const getServiceColor = (service: string) => {
    switch (service) {
      case "WhatsApp": return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40";
      case "Razorpay": return "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/40";
      case "Sheets": return "bg-green-50 dark:bg-emerald-950/20 text-green-800 dark:text-emerald-400 border-green-200 dark:border-emerald-900/30";
      case "Call": return "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40";
      default: return "bg-stone-50 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400 border-stone-200 dark:border-zinc-700";
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-6 transition-colors">
      
      {/* Top selection bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-stone-100 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-lg">{t("logs.title")}</h2>
          <p className="text-xs text-stone-500 dark:text-zinc-450">{t("logs.desc")}</p>
        </div>

        <div className="flex bg-stone-100 dark:bg-zinc-800 p-1.5 rounded-xl text-xs gap-1 self-start">
          <button
            onClick={() => setActiveLogSub("webhooks")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeLogSub === "webhooks" 
                ? "bg-white dark:bg-zinc-700 text-stone-950 dark:text-white shadow-xs"
                : "text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200"
            }`}
          >
            {t("logs.webhooks")} ({webhookLogs.length})
          </button>
          <button
            onClick={() => setActiveLogSub("calls")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeLogSub === "calls" 
                ? "bg-white dark:bg-zinc-700 text-stone-950 dark:text-white shadow-xs"
                : "text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200"
            }`}
          >
            {t("logs.voiceCalls")} ({callLogs.length})
          </button>
        </div>
      </div>

      {/* Global search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
        <input
          type="text"
          placeholder={
            activeLogSub === "webhooks" 
              ? t("logs.searchWebhooks")
              : t("logs.searchCalls")
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:bg-white dark:focus:bg-zinc-800 text-stone-800 dark:text-zinc-200"
        />
      </div>

      {/* Subtab Webhook Logs list */}
      {activeLogSub === "webhooks" && (
        <div className="space-y-3" id="webhooks-log-list">
          {filteredWebhooks.length > 0 ? (
            filteredWebhooks.map((w) => {
              const isExpanded = expandedWebhookId === w.id;
              return (
                <div key={w.id} className="border border-stone-200/55 dark:border-zinc-800/80 rounded-xl overflow-hidden transition hover:border-stone-300 dark:hover:border-zinc-700">
                  {/* Summary Bar */}
                  <div 
                    onClick={() => toggleWebhookExpand(w.id)}
                    className="p-4 bg-stone-50/50 dark:bg-zinc-900/30 hover:bg-stone-50 dark:hover:bg-zinc-800/50 cursor-pointer flex justify-between items-center text-xs text-stone-700 dark:text-zinc-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-3.5">
                      <span className="font-mono font-medium text-stone-400 dark:text-zinc-500">{w.id}</span>
                      
                      {/* Badge Service */}
                      <span className={`px-2 py-0.5 rounded text-[9.5px] border font-bold uppercase ${getServiceColor(w.service)}`}>
                        {w.service}
                      </span>

                      {/* Event name */}
                      <strong className="text-stone-900 dark:text-zinc-100 font-mono font-medium">{w.event}</strong>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-stone-400 dark:text-zinc-450 font-mono">
                      <span>{new Date(w.timestamp).toLocaleTimeString()}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded JSON payload */}
                  {isExpanded && (
                    <div className="p-4 bg-stone-950 text-stone-300 border-t border-stone-200/30 dark:border-zinc-800 text-[10px] font-mono leading-relaxed overflow-x-auto select-all">
                      <pre>{JSON.stringify(w.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 font-serif italic text-stone-400 dark:text-zinc-500 text-xs">
              No API webhook entries matched active search filters.
            </div>
          )}
        </div>
      )}

      {/* Subtab Call transcripts Records */}
      {activeLogSub === "calls" && (
        <div className="space-y-4" id="call-transcript-list">
          {filteredCalls.length > 0 ? (
            filteredCalls.map((c) => (
              <div key={c.id} className="bg-stone-50/45 dark:bg-zinc-900/30 p-5 rounded-2xl border border-stone-200/85 dark:border-zinc-800/80 text-xs text-stone-700 dark:text-zinc-300 space-y-3.5 transition-colors">
                
                {/* Header row metadata */}
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="font-serif font-black text-stone-900 dark:text-zinc-100 text-sm">
                        {c.customerName ? c.customerName : "Regular Patron Dial-In"}
                      </strong>
                      <span className="text-[10px] font-mono text-stone-400 dark:text-zinc-500">+{c.customerPhone}</span>
                    </div>
                    <span className="text-[10px] text-stone-400 dark:text-zinc-500 block font-mono mt-0.5">Call Ref ID: {c.id}</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[10px] text-stone-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1 bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-stone-550 dark:text-zinc-350">
                      <Clock className="w-3 h-3 text-stone-400 dark:text-zinc-500" />
                      <span>{c.duration}s length</span>
                    </div>
                    <span className="text-stone-400 dark:text-zinc-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* AI generated summary box */}
                <div className="bg-amber-50/25 dark:bg-amber-950/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 flex gap-2">
                  <span className="text-amber-700 dark:text-amber-400 shrink-0 font-bold font-serif text-[11px] uppercase tracking-wider">AI Bullet:</span>
                  <p className="italic text-stone-600 dark:text-zinc-300 text-[11px] leading-relaxed">
                    {c.summary ? c.summary : "No summarized metrics registered on dial-in check."}
                  </p>
                </div>

                {/* Transcription dialogues collapsible list */}
                {c.transcript && c.transcript.length > 0 && (
                  <div className="space-y-2 bg-white/75 dark:bg-zinc-800/30 p-3 rounded-xl border border-stone-100 dark:border-zinc-800 max-h-[170px] overflow-y-auto scrollbar-none">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-stone-400 dark:text-zinc-500 block mb-1">Dialogues Audiolog</span>
                    {c.transcript.map((line, lIdx) => {
                      const isCustomer = line.speaker === "customer";
                      return (
                        <div key={lIdx} className="text-[11px] leading-relaxed">
                          <span className={`font-mono uppercase text-[9px] font-bold mr-1.5 ${isCustomer ? "text-amber-800 dark:text-amber-400" : "text-stone-400 dark:text-zinc-500"}`}>
                            {isCustomer ? "Customer:" : "AI Sales:"}
                          </span>
                          <span className="text-stone-600 dark:text-zinc-300">{line.phrase}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Actions order parsed indicator */}
                {c.ordersCreated && c.ordersCreated.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-stone-200/40 dark:border-zinc-800 text-[10px]">
                    <span className="font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-widest text-[8px]">Converted Booking Block:</span>
                    {c.ordersCreated.map((oId) => (
                      <span key={oId} className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 px-2 py-0.5 rounded font-mono font-bold">
                        {oId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-10 font-serif italic text-stone-400 dark:text-zinc-550 text-xs">
              No calling loggers matching active queries located.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
