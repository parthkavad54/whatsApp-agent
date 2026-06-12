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

interface LogsTabProps {
  webhookLogs: WebhookLog[];
  callLogs: CallLog[];
}

export default function LogsTab({
  webhookLogs = [],
  callLogs = []
}: LogsTabProps) {
  // Nested subtab select "webhooks" | "calls"
  const [activeLogSub, setActiveLogSub] = useState<"webhooks" | "calls">("webhooks");
  const [searchQuery, setSearchQuery] = useState("");
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
      case "WhatsApp": return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "Razorpay": return "bg-amber-100 text-amber-800 border-amber-200";
      case "Sheets": return "bg-green-50 text-green-800 border-green-200";
      case "Call": return "bg-indigo-50 text-indigo-800 border-indigo-200";
      default: return "bg-stone-50 text-stone-500 border-stone-200";
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-6">
      
      {/* Top selection bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-stone-100 pb-4">
        <div>
          <h2 className="font-serif font-bold text-stone-900 text-lg">System Audit Loggers</h2>
          <p className="text-xs text-stone-500">Review live external webhooks pings, and dial-in interactive speech call recordings</p>
        </div>

        <div className="flex bg-stone-100 p-1.5 rounded-xl text-xs gap-1 self-start">
          <button
            onClick={() => setActiveLogSub("webhooks")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeLogSub === "webhooks" 
                ? "bg-white text-stone-950 shadow-sm"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Webhook API Logs ({webhookLogs.length})
          </button>
          <button
            onClick={() => setActiveLogSub("calls")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeLogSub === "calls" 
                ? "bg-white text-stone-950 shadow-sm"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Voice Call Records ({callLogs.length})
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
              ? "Search webhook JSON events, payloads, timestamps..." 
              : "Search call transcripts summaries, buyer phones, ID references..."
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white"
        />
      </div>

      {/* Subtab Webhook Logs list */}
      {activeLogSub === "webhooks" && (
        <div className="space-y-3" id="webhooks-log-list">
          {filteredWebhooks.length > 0 ? (
            filteredWebhooks.map((w) => {
              const isExpanded = expandedWebhookId === w.id;
              return (
                <div key={w.id} className="border border-stone-200/55 rounded-xl overflow-hidden transition hover:border-stone-300">
                  {/* Summary Bar */}
                  <div 
                    onClick={() => toggleWebhookExpand(w.id)}
                    className="p-4 bg-stone-50/50 hover:bg-stone-50 cursor-pointer flex justify-between items-center text-xs text-stone-700"
                  >
                    <div className="flex flex-wrap items-center gap-3.5">
                      <span className="font-mono font-medium text-stone-400">{w.id}</span>
                      
                      {/* Badge Service */}
                      <span className={`px-2 py-0.5 rounded text-[9.5px] border font-bold uppercase ${getServiceColor(w.service)}`}>
                        {w.service}
                      </span>

                      {/* Event name */}
                      <strong className="text-stone-900 font-mono font-medium">{w.event}</strong>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-stone-400 font-mono">
                      <span>{new Date(w.timestamp).toLocaleTimeString()}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded JSON payload */}
                  {isExpanded && (
                    <div className="p-4 bg-stone-950 text-stone-300 border-t border-stone-200/30 text-[10px] font-mono leading-relaxed overflow-x-auto select-all">
                      <pre>{JSON.stringify(w.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 font-serif italic text-stone-400 text-xs">
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
              <div key={c.id} className="bg-stone-50/45 p-5 rounded-2xl border border-stone-200/85 text-xs text-stone-700 space-y-3.5">
                
                {/* Header row metadata */}
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="font-serif font-black text-stone-900 text-sm">
                        {c.customerName ? c.customerName : "Regular Patron Dial-In"}
                      </strong>
                      <span className="text-[10px] font-mono text-stone-400">+{c.customerPhone}</span>
                    </div>
                    <span className="text-[10px] text-stone-400 block font-mono mt-0.5">Call Ref ID: {c.id}</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[10px] text-stone-500">
                    <div className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{c.duration}s length</span>
                    </div>
                    <span className="text-stone-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* AI generated summary box */}
                <div className="bg-amber-50/25 p-3 rounded-xl border border-amber-100 flex gap-2">
                  <span className="text-amber-700 shrink-0 font-bold font-serif text-[11px] uppercase tracking-wider">AI Bullet:</span>
                  <p className="italic text-stone-600 text-[11px] leading-relaxed">
                    {c.summary ? c.summary : "No summarized metrics registered on dial-in check."}
                  </p>
                </div>

                {/* Transcription dialogues collapsible list */}
                {c.transcript && c.transcript.length > 0 && (
                  <div className="space-y-2 bg-white/70 p-3 rounded-xl border border-stone-100 max-h-[170px] overflow-y-auto scrollbar-none">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-stone-400 block mb-1">Dialogues Audiolog</span>
                    {c.transcript.map((line, lIdx) => {
                      const isCustomer = line.speaker === "customer";
                      return (
                        <div key={lIdx} className="text-[11px] leading-relaxed">
                          <span className={`font-mono uppercase text-[9px] font-bold mr-1.5 ${isCustomer ? "text-amber-800" : "text-stone-400"}`}>
                            {isCustomer ? "Customer:" : "AI Sales:"}
                          </span>
                          <span className="text-stone-600">{line.phrase}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Actions order parsed indicator */}
                {c.ordersCreated && c.ordersCreated.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-stone-200/40 text-[10px]">
                    <span className="font-bold text-stone-400 uppercase tracking-widest text-[8px]">Converted Booking Block:</span>
                    {c.ordersCreated.map((oId) => (
                      <span key={oId} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold">
                        {oId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-10 font-serif italic text-stone-400 text-xs">
              No calling loggers matching active queries located.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
