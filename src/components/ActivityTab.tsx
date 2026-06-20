import React, { useState, useMemo } from "react";
import { 
  Zap, 
  Bot, 
  Clock, 
  Play, 
  FileSpreadsheet, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  XCircle, 
  Bell, 
  MessageSquare,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Database
} from "lucide-react";
import { WebhookLog } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface ActivityTabProps {
  webhookLogs: WebhookLog[];
}

interface ActivityItem {
  id: string;
  timestamp: string;
  type: "cron_check" | "ai_chat_reply" | "reminder_dispatch" | "payment_auto" | "sheets_sync" | "other_system";
  title: string;
  description: string;
  service: string;
  event: string;
  rawPayload: any;
  status: "success" | "info" | "warning";
}

export default function ActivityTab({ webhookLogs = [] }: ActivityTabProps) {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Map low level webhookLogs to descriptive Automated System Activities
  const activities = useMemo(() => {
    const list: ActivityItem[] = [];

    webhookLogs.forEach((log) => {
      const { id, timestamp, service, event, payload } = log;
      
      // Initialize mappings
      let type: ActivityItem["type"] = "other_system";
      let title = "System Callback Event";
      let description = "An automated background handler was successfully executed.";
      let status: ActivityItem["status"] = "info";

      if (event === "cron_scheduler_run") {
        type = "cron_check";
        const checks = payload?.reminderChecksCompleted || 0;
        const sent = payload?.remindersDispatched || 0;
        title = language === "gu" ? "સ્વચાલિત પુનઃપ્રાપ્તિ તપાસ ચલાવી" : "Automated Replenishment Check Run";
        description = language === "gu" 
          ? `દૈનિક ડે-૨૫ પુનઃપ્રાપ્તિ ક્રોન ચેક દ્વારા સિસ્ટમે ${checks} સક્રિય ગ્રાહકોનું નિરીક્ષણ કર્યું અને ${sent} પુનઃઓર્ડર ડ્રાફ્ટો તૈયાર કર્યા.`
          : `System verified ${checks} active patrons through the recurrent Day-25 interval checks and compiled ${sent} replenishment drafts.`;
        status = "success";
      } 
      else if (event === "automated_agent_reply") {
        type = "ai_chat_reply";
        const customer = payload?.customerName || "Patron";
        const tools = payload?.toolsUsed && payload.toolsUsed.length > 0 
          ? ` [Tools: ${payload.toolsUsed.join(", ")}]` 
          : "";
        title = language === "gu" ? `${customer} ને સ્વચાલિત એઆઈ જવાબ` : `Automated AI Response sent to ${customer}`;
        description = language === "gu"
          ? `એઆઈ સેલ્સ એજન્ટે ત્રિભાષી (ગુજરાતી/ઇંગ્લિશ/ગુજ્લીશ) બુદ્ધિશાળી મોડેલ દ્વારા ગ્રાહકને જવાબ આપ્યો.${tools}`
          : `Trilingual AI Agent evaluated input context and automatically returned custom localized reply text.${tools}`;
        status = "success";
      } 
      else if (event === "automated_reminder_dispatched") {
        type = "reminder_dispatch";
        const customer = payload?.customerName || "Patron";
        title = language === "gu" ? `${customer} ને ક્રોન રીમાઇન્ડર મોકલ્યું` : `Cron Reminder Dispatched to ${customer}`;
        description = language === "gu"
          ? `વૈદિક ઘી બાકી હોવાની દૈનિક ડે-૨૫ બળતણ રીમાઇન્ડર વોટ્સએપ પર મોકલી દેવામાં આવી.`
          : `Physical remaining stock indicator triggered Day-25 re-order prompt, automatically dispatched via WhatsApp connection.`;
        status = "success";
      }
      else if (event === "payment_authorized_webhook") {
        type = "payment_auto";
        const orderId = payload?.orderId || "N/A";
        title = language === "gu" ? `ઓર્ડર #${orderId} માટે ચુકવણી મંજૂર` : `Payment Authorized for Order #${orderId}`;
        description = language === "gu"
          ? `રેઝરપે ગેટવે દ્વારા પેમેન્ટ આઇડી ${payload?.id || "N/A"} ની મંજૂરી રૂ. ${payload?.amount || 0} ની રકમ પર મળી.`
          : `Razorpay webhooks successfully authorized payment ID ${payload?.id || "N/A"} for manual/automatic ledger clearance of ₹${payload?.amount || 0}.`;
        status = "success";
      }
      else if (event === "payment_link_created") {
        type = "payment_auto";
        const orderId = payload?.orderId || "N/A";
        title = language === "gu" ? `ચુકવણી લિંક જનરેટ થઈ` : `Payment Request Dynamic Link Generated`;
        description = language === "gu"
          ? `ઓર્ડર #${orderId} ની ચુકવણી કન્ફર્મેશન માટે રૂ. ${payload?.amount || 0} ની સ્માર્ટ રેઝરપે લિંક સિસ્ટમે બનાવી.`
          : `Outbound gateway automatically created a dynamic payment link for Order #${orderId} totaling ₹${payload?.amount || 0}.`;
        status = "info";
      }
      else if (event.endsWith("_row_appended")) {
        type = "sheets_sync";
        const rowType = payload?.rowType || "records";
        title = language === "gu" ? `ગૂગલ શીટ્સ સાથે ડેટા સિંક થયો` : `Google Sheets Live Sync Ledger`;
        description = language === "gu"
          ? `નવું સંચાલન પ્રવૃત્તિ પત્રક (${rowType}) સ્વચાલિત ગૂગલ શીટ્સ ક્લાઉડ ક્રેડેન્શિયલ પર અપડેટ થયું.`
          : `System safely synced dynamic records and automatically appended new row structure (${rowType}) on external Google Sheets.`;
        status = "success";
      }
      else if (event === "voice_note_received" || event === "message_received") {
        type = "other_system";
        const customer = payload?.customerName || "Patron";
        title = event === "voice_note_received" 
          ? (language === "gu" ? `વોઇસ નોટ મળી અને કન્વર્ટ થઈ` : "Audio Voice Note Received & Decoded")
          : (language === "gu" ? `ગ્રાહકનો વોટ્સએપ સંદેશ મળ્યો` : "Incoming WhatsApp Message Trigger");
        description = language === "gu"
          ? `ગ્રાહક +${payload?.from || ""} (${customer}) તરફથી ક્લાઉડ એપીઆઈ દ્વારા ઇનકમિંગ સંદેશ મળ્યો.`
          : `Received incoming webhook payload from +${payload?.from || ""} (${customer}) on Meta webhook listener.`;
        status = "info";
      }
      else if (event === "voice_stream_chunk") {
        type = "other_system";
        title = language === "gu" ? "વોઇસ કૉલ મોડ્યુલર ચંક પ્રોસેસ્ડ" : "Voice Stream Signal Processed";
        description = language === "gu"
          ? `ઇન્ટરેક્ટિવ ટેલિફોન સિસ્ટમ દ્વારા રિયલ-ટાઇમ હિન્દી/ગુજરાતી ઓડિયો પિંગ સિગ્નલ ડિકોડ થયો.`
          : `Interactive dial-in stream successfully mapped voice payload: "${payload?.phrase || ""}"`;
        status = "info";
      }
      else if (event === "call_terminated_whatsapp_triggered") {
        type = "reminder_dispatch";
        title = language === "gu" ? "કૉલ પછીનો ફોલોઅપ મોકલ્યો" : "Post-Call WhatsApp Follow-up Auto-Triggered";
        description = language === "gu"
          ? `કોલ રિપોર્ટ તૈયાર કરી ગ્રાહક +${payload?.customerPhone || ""} ને ઓટોમેટીક ડ્રાફ્ટ લિંક મોકલી દેવામાં આવી.`
          : `Upon call wrap-up of ${payload?.durationOfCall || 0}s, the system automatically compiled and triggered summary dispatch payload over WhatsApp.`;
        status = "success";
      }

      list.push({
        id,
        timestamp,
        type,
        title,
        description,
        service,
        event,
        rawPayload: payload,
        status
      });
    });

    return list;
  }, [webhookLogs, language]);

  // Filters logic
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // 1. Filter Type
      if (filterType !== "all" && act.type !== filterType) {
        return false;
      }

      // 2. Search query
      const term = searchQuery.toLowerCase();
      if (!term) return true;

      return (
        act.title.toLowerCase().includes(term) ||
        act.description.toLowerCase().includes(term) ||
        act.event.toLowerCase().includes(term) ||
        act.service.toLowerCase().includes(term) ||
        JSON.stringify(act.rawPayload).toLowerCase().includes(term)
      );
    });
  }, [activities, filterType, searchQuery]);

  // Statistics counters
  const stats = useMemo(() => {
    const counts = {
      cron: 0,
      aiReplies: 0,
      reminders: 0,
      payments: 0,
      sheets: 0
    };

    activities.forEach(a => {
      if (a.type === "cron_check") counts.cron++;
      if (a.type === "ai_chat_reply") counts.aiReplies++;
      if (a.type === "reminder_dispatch") counts.reminders++;
      if (a.type === "payment_auto") counts.payments++;
      if (a.type === "sheets_sync") counts.sheets++;
    });

    return counts;
  }, [activities]);

  const getTypeIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "cron_check": return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "ai_chat_reply": return <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "reminder_dispatch": return <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "payment_auto": return <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case "sheets_sync": return <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />;
      default: return <Layers className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getStatusBadge = (status: ActivityItem["status"]) => {
    switch (status) {
      case "success":
        return "bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-405 dark:border-emerald-900/40";
      case "warning":
        return "bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40";
      default:
        return "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:border-zinc-700/60";
    }
  };

  return (
    <div className="space-y-6" id="system-activity-dashboard">
      
      {/* 1. Dashboard Highlights for Operations Transparency */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 shrink-0">
        
        {/* Cron actions count */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-550">Cron Sweep</span>
            <div className="p-1.5 bg-amber-55/65 dark:bg-amber-950/20 rounded-lg">
              <Play className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{stats.cron}</span>
            <span className="text-[10px] block text-stone-400 dark:text-zinc-500 mt-0.5">{language === "gu" ? "સ્કેનિંગ સાયકલ" : "Scanning sweeps"}</span>
          </div>
        </div>

        {/* AI automated replies count */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-550">AI Agent</span>
            <div className="p-1.5 bg-purple-55/6F dark:bg-purple-950/20 rounded-lg">
              <Bot className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{stats.aiReplies}</span>
            <span className="text-[10px] block text-stone-400 dark:text-zinc-500 mt-0.5">{language === "gu" ? "સ્વચાલિત જવાબો" : "Automated chats"}</span>
          </div>
        </div>

        {/* Day-25 reminders count */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-550">Cron Reminders</span>
            <div className="p-1.5 bg-emerald-55/6F dark:bg-emerald-950/20 rounded-lg">
              <Bell className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{stats.reminders}</span>
            <span className="text-[10px] block text-stone-400 dark:text-zinc-500 mt-0.5">{language === "gu" ? "મોકલેલ વોટ્સએપ" : "WhatsApp dispatches"}</span>
          </div>
        </div>

        {/* Gateway auto webhook actions */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-550">Payments Gateway</span>
            <div className="p-1.5 bg-indigo-55/65 dark:bg-indigo-950/20 rounded-lg">
              <Zap className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{stats.payments}</span>
            <span className="text-[10px] block text-stone-400 dark:text-zinc-500 mt-0.5">{language === "gu" ? "આપોઆપ મંજૂરી" : "Webhook validations"}</span>
          </div>
        </div>

        {/* Sheets Cloud Sync count */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col justify-between shadow-xs transition-all hover:scale-[1.01] col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-550">Sheets Sync</span>
            <div className="p-1.5 bg-green-55/6F dark:bg-green-950/20 rounded-lg">
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{stats.sheets}</span>
            <span className="text-[10px] block text-stone-400 dark:text-zinc-500 mt-0.5">{language === "gu" ? "કોષ્ટકો અપડેટ" : "Ledgers appended"}</span>
          </div>
        </div>
      </div>

      {/* 2. Timeline and Controls Card */}
      <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-6">
        
        {/* Header summary */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="font-serif font-bold text-zinc-900 dark:text-zinc-100 text-lg">
              {language === "gu" ? "સ્વચાલિત સેન્ટ્રલ સિસ્ટમ પ્રવૃત્તિ" : "Automated System Activity Ghee Ledger"}
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-450">
              {language === "gu" 
                ? "ચોકસાઈ અને પારદર્શકતા માટે દરેક સક્રિય ક્રોન સિગ્નલ અને સ્વચાલિત ક્લાઉડ જવાબોનું ટ્રેકિંગ."
                : "Real-time ledger transparency showing every active system signal, WhatsApp agent replies, and automated background tasks."}
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs gap-1 self-start">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterType === "all" 
                  ? "bg-white dark:bg-zinc-700 text-stone-950 dark:text-white shadow-xs"
                  : "text-stone-500 dark:text-zinc-400 hover:text-stone-900"
              }`}
            >
              {language === "gu" ? "બધી પ્રવૃત્તિ" : "All"}
            </button>
            <button
              onClick={() => setFilterType("cron_check")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterType === "cron_check" 
                  ? "bg-white dark:bg-zinc-700 text-stone-950 dark:text-white shadow-xs"
                  : "text-stone-500 dark:text-zinc-400 hover:text-stone-900"
              }`}
            >
              {language === "gu" ? "ક્રોન" : "Cron"}
            </button>
            <button
              onClick={() => setFilterType("ai_chat_reply")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterType === "ai_chat_reply" 
                  ? "bg-white dark:bg-zinc-700 text-stone-950 dark:text-white shadow-xs"
                  : "text-stone-500 dark:text-zinc-400 hover:text-stone-900"
              }`}
            >
              AI Agent
            </button>
            <button
              onClick={() => setFilterType("reminder_dispatch")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterType === "reminder_dispatch" 
                  ? "bg-white dark:bg-zinc-700 text-stone-950 dark:text-white shadow-xs"
                  : "text-stone-500 dark:text-zinc-400 hover:text-stone-900"
              }`}
            >
              {language === "gu" ? "રીમાઇન્ડર" : "Reminder"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            type="text"
            placeholder={language === "gu" ? "પેલોડ, ઇવેન્ટ નામ, સેન્ડર વિગતો શોધો..." : "Search event names, dynamic payload details, patron reference..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:bg-white dark:focus:bg-zinc-800 text-stone-850 dark:text-zinc-200"
          />
        </div>

        {/* Timeline Event Feed */}
        <div className="relative border-l border-zinc-250 dark:border-zinc-800 pl-4 md:pl-6 ml-3 space-y-6">
          {filteredActivities.length > 0 ? (
            filteredActivities.map((act) => {
              const isExpanded = expandedId === act.id;
              
              return (
                <div key={act.id} className="relative group">
                  
                  {/* Timeline point indicator */}
                  <span className="absolute -left-[30px] md:-left-[38px] top-1 rounded-full p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-center transition-all group-hover:scale-110 z-10">
                    {getTypeIcon(act.type)}
                  </span>

                  {/* Main Event Box Card */}
                  <div className="bg-stone-50/50 dark:bg-zinc-900/30 border border-stone-200/50 dark:border-zinc-800 rounded-2xl overflow-hidden transition hover:border-stone-300 dark:hover:border-zinc-700 shadow-3xs">
                    
                    {/* Header Bar */}
                    <div 
                      onClick={() => toggleExpand(act.id)}
                      className="p-4 cursor-pointer flex flex-col md:flex-row justify-between md:items-center gap-2 text-xs transition-colors"
                    >
                      <div className="space-y-1 md:space-y-0.5 max-w-full md:max-w-[70%]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-white text-sm">
                            {act.title}
                          </span>
                          
                          {/* Event String Indicator */}
                          <span className="font-mono text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">
                            {act.event}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                          {act.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 mt-1 md:mt-0 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500 justify-between md:justify-end shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]">{new Date(act.timestamp).toLocaleDateString()}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 ml-0.5" /> : <ChevronDown className="w-4 h-4 ml-0.5" />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Telemetry payload */}
                    {isExpanded && (
                      <div className="border-t border-stone-200/50 dark:border-zinc-800 bg-stone-950 select-all p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9.5px] font-mono text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                            <Info className="w-3 h-3 text-amber-500" />
                            System Execution Payload Debugger (JSON)
                          </span>
                          <span className="text-[9.5px] font-mono text-zinc-500">
                            Log ID: {act.id}
                          </span>
                        </div>

                        <pre className="text-emerald-400/90 text-[10px] font-mono leading-relaxed overflow-x-auto p-1 max-h-[300px]">
                          {JSON.stringify(act.rawPayload, null, 2)}
                        </pre>
                      </div>
                    )}

                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 font-serif italic text-stone-400 dark:text-zinc-500 text-xs">
              {language === "gu" 
                ? "પારદર્શક સિસ્ટમ પ્રવૃત્તિઓમાં કોઈ રેકોર્ડ મળ્યો નથી."
                : "No matching automated system actions compiled on this viewport."}
            </div>
          )}
        </div>

      </div>

      {/* 3. Operational Integrity Pledge Callout */}
      <div className="p-4 bg-amber-50/10 dark:bg-amber-950/5 border border-amber-500/10 dark:border-amber-500/10 rounded-2xl flex gap-3">
        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-400">
            {language === "gu" ? "સંપૂર્ણ પારદર્શિતા બાંહેધરી" : "System Automated Transparency Audit Pledge"}
          </h4>
          <p className="text-[11px] text-zinc-650 dark:text-zinc-400 leading-relaxed max-w-4xl">
            {language === "gu"
              ? "આ સિસ્ટમ વલોણા દેશી ઘી ઓટોમેશન મોનિટરિંગ અને ક્લાઉડ બિલિંગ ચેકિંગ વગેરે પૃષ્ઠભૂમિ ક્રિયાઓને પૂર્ણ ક્ષમતા સાથે ટ્રેક કરે છે. તમામ રિયલ-ટાઇમ ક્રોન જોબ્સ અને પિંગ ઘટનાઓ સંપૂર્ણ ગ્રીન સર્ટિફાઇડ પથ પર ચાલે છે."
              : "This specialized viewport logs every automated background loop. For complete reliability and transparency, whenever our Day-25 replenishment cron trigger evaluates orders or whenever our multilingual model registers automatic customer messages on WhatsApp, the raw payloads are decrypted, formatted, and exposed on this diagnostic table."}
          </p>
        </div>
      </div>

    </div>
  );
}
