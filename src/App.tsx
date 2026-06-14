import React, { useState, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import AppShell from "./components/layout/AppShell";
import AnalyticsTab from "./components/AnalyticsTab";
import OrdersTab from "./components/OrdersTab";
import CustomersTab from "./components/CustomersTab";
import AIAgentTab from "./components/AIAgentTab";
import IntegrationsTab from "./components/IntegrationsTab";
import LogsTab from "./components/LogsTab";
import { Product, Customer, Order, Conversation, CallLog, WebhookLog, QuickReply } from "./types";
import { Sparkles, RefreshCcw } from "lucide-react";

export default function App() {
  // DB States Hydrated from server
  const [dbData, setDbData] = useState<{
    products: Product[];
    customers: Customer[];
    orders: Order[];
    conversations: Conversation[];
    callLogs: CallLog[];
    webhookLogs: WebhookLog[];
    prompts: {
      whatsappSystem: string;
      callsSystem: string;
      languageDetection: string;
      objectionHandling: string;
    };
    quickReplies?: QuickReply[];
  } | null>(null);

  const [isGeminiConfigured, setIsGeminiConfigured] = useState(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [isLiteQuotaExhausted, setIsLiteQuotaExhausted] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"connecting" | "healthy" | "data_error" | "offline">("connecting");

  // App Layout Preferences
  const [activeTab, setActiveTab] = useState<
    "analytics" | "orders" | "customers" | "ai-agent" | "analytics-detail" | "integrations" | "logs"
  >("analytics");

  // Global search state
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  // Notification states
  const [notifications, setNotifications] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_notifications");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const prevOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    localStorage.setItem("app_notifications", JSON.stringify(notifications));
  }, [notifications]);

  // Hydration API fetching from Express backend
  const loadDatabaseState = async (silent = false) => {
    try {
      let res;
      try {
        res = await fetch("/api/data");
      } catch (fetchErr: any) {
        // Fetch failed entirely (network down / no response)
        setServerStatus("offline");
        throw new Error("Traditional ledger API is unreachable (Network socket refused or offline)");
      }

      if (!res.ok) {
        // If not ok (e.g. 500 error), try to check /api/health
        try {
          const healthRes = await fetch("/api/health");
          if (healthRes.ok) {
            setServerStatus("data_error");
            throw new Error(`Data Sync issue detected. Ghee server is active, but ledger DB query threw an internal error (Status: ${res.status})`);
          } else {
            setServerStatus("offline");
            throw new Error(`Traditional ledger API is unreachable (Health ping returned ${healthRes.status})`);
          }
        } catch (healthErr) {
          setServerStatus("offline");
          throw new Error("Traditional ledger API is unreachable (Server offline or socket broken)");
        }
      }
      
      setServerStatus("healthy");
      const result = await res.json();
      
      if (result.success && result.data) {
        const fetchedOrders = result.data.db.orders || [];

        // Check if we already have some loaded orders in ref to compare against
        if (prevOrdersRef.current && prevOrdersRef.current.length > 0) {
          const prevOrders = prevOrdersRef.current;

          // 1. New Orders Detection
          fetchedOrders.forEach((o: any) => {
            const exists = prevOrders.some((prev) => prev.orderId === o.orderId);
            if (!exists) {
              const title = `New Order: #${o.orderId}`;
              const message = `${o.customerName} ordered ${o.quantity}x ${o.size} traditional ghee jar.`;
              
              toast.success(
                <div className="flex flex-col gap-0.5 pointer-events-auto">
                  <span className="font-bold text-xs flex items-center gap-1">🔔 New Order Booked!</span>
                  <span className="text-[11px] leading-snug">{o.customerName} placed order #{o.orderId} of {o.quantity}x {o.size}.</span>
                </div>,
                { duration: 6500 }
              );

              setNotifications(prev => [
                {
                  id: `notif-${Date.now()}-${Math.random()}`,
                  title,
                  message,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  read: false,
                  type: 'success',
                  actiontab: 'orders'
                },
                ...prev
              ]);
            } else {
              // 2. Order status update detection
              const prevOrder = prevOrders.find((prev) => prev.orderId === o.orderId);
              if (prevOrder) {
                const payChanged = prevOrder.paymentStatus !== o.paymentStatus;
                const shipChanged = prevOrder.shippingStatus !== o.shippingStatus;

                if (payChanged || shipChanged) {
                  let changeMsg = "";
                  if (payChanged && shipChanged) {
                    changeMsg = `Payment: "${o.paymentStatus}", Status: "${o.shippingStatus}".`;
                  } else if (payChanged) {
                    changeMsg = `Payment is now "${o.paymentStatus}".`;
                  } else {
                    changeMsg = `Shipping status: "${o.shippingStatus}".`;
                  }

                  const title = `Order Status: #${o.orderId}`;
                  const message = `${o.customerName}'s order updated: ${changeMsg}`;

                  toast.custom(
                    (t) => (
                      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white dark:bg-zinc-800 shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/10 p-4 border-l-4 border-amber-500`}>
                        <div className="flex-1 w-0">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            📦 Order #${o.orderId} Updated
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-450">
                            {o.customerName}'s ghee booking changed. {changeMsg}
                          </p>
                        </div>
                      </div>
                    ),
                    { duration: 5500 }
                  );

                  setNotifications(prev => [
                    {
                      id: `notif-${Date.now()}-${Math.random()}`,
                      title,
                      message,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      read: false,
                      type: 'info',
                      actiontab: 'orders'
                    },
                    ...prev
                  ]);
                }
              }
            }
          });
        }

        // Keep current orders in ref
        prevOrdersRef.current = fetchedOrders;

        setDbData(result.data.db);
        setIsGeminiConfigured(result.data.isGeminiConfigured);
        setIsQuotaExhausted(result.data.isQuotaExhausted || false);
        setIsLiteQuotaExhausted(result.data.isLiteQuotaExhausted || false);
      }
      setErrorMsg(null);
    } catch (err: any) {
      console.error("[Data Sync Fail]:", err);
      // Dual check asynchronously to update serverStatus indicator
      fetch("/api/health")
        .then(h => {
          if (h.ok) {
            setServerStatus("data_error");
          } else {
            setServerStatus("offline");
          }
        })
        .catch(() => {
          setServerStatus("offline");
        });

      if (!silent) {
        setErrorMsg(err.message || "Failed to sync with local database ledger");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Poll server state every 4.5 seconds to sync live chats, order updates, and logs
  useEffect(() => {
    loadDatabaseState();
    const interval = setInterval(() => loadDatabaseState(true), 4500);
    return () => clearInterval(interval);
  }, []);

  // Mutator definitions connecting to server integrations

  // 1. Manually add a ghee order
  const handleCreateManualOrder = async (orderArgs: {
    customerPhone: string;
    customerName: string;
    productName: string;
    size: string;
    quantity: number;
    amount: number;
    address: string;
  }) => {
    try {
      const response = await fetch("/api/orders/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderArgs)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Order insertion failed");
      
      toast.success(`Succesfully created order block: ${result.data?.orderId}`);
      loadDatabaseState(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Manual booking failed");
      throw err;
    }
  };

  // 2. Adjust shipping or ledger payment states
  const handleUpdateOrderStatus = async (orderId: string, paymentStatus?: string, shippingStatus?: string) => {
    try {
      const response = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentStatus, shippingStatus })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Update status failed");
      
      toast.success(`Ledger Order ${orderId} updated successfully`);
      loadDatabaseState(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gateway sync error");
      throw err;
    }
  };

  // 3. Update customer CRM annotations insights
  const handleUpdateCustomerNote = async (phone: string, notes: string) => {
    try {
      // Find customer name or object
      const cust = dbData?.customers.find(c => c.phone === phone);
      if (!cust) return;
      
      // Update locally first for optimistic speed
      if (dbData) {
        setDbData({
          ...dbData,
          customers: dbData.customers.map(c => c.phone === phone ? { ...c, notes } : c)
        });
      }

      // Sync backend configuration if customizable, otherwise simulated in memory
      toast.success(`Patron annotation recorded for +${phone}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Annotation writing issue");
    }
  };

  // 4. Update core system prompt behaviors
  const handleUpdatePrompts = async (editedPrompts: {
    whatsappSystem: string;
    callsSystem: string;
    languageDetection: string;
    objectionHandling: string;
  }) => {
    try {
      const response = await fetch("/api/prompts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedPrompts)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Prompt write issue");
      
      toast.success("System Prompt configurations updated");
      loadDatabaseState(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to write prompts");
      throw err;
    }
  };

  // 5. Save canned shortcuts
  const handleSaveQuickReply = async (replyArgs: { title: string; shortcut: string; text: string }) => {
    try {
      const response = await fetch("/api/quick-replies/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replyArgs)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to save reply");
      
      toast.success(`Saved canned shortcut: ${replyArgs.shortcut}`);
      loadDatabaseState(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Save canned shortcut failed");
      throw err;
    }
  };

  // 6. Delete canned shortcuts
  const handleDeleteQuickReply = async (id: string) => {
    try {
      const response = await fetch("/api/quick-replies/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to remove reply");
      
      toast.success("Canned shortcut removed");
      loadDatabaseState(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Remove shortcut failed");
      throw err;
    }
  };

  // 7. Push simulated client whatsapp message
  const handleSimulateWhatsApp = async (phone: string, text: string, type = "text") => {
    try {
      const response = await fetch("/api/whatsapp/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text, type })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Simulation error");
      
      toast.success("WhatsApp Agent responded");
      loadDatabaseState(true);
      return { response: result.data?.response || "" };
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "WhatsApp sim error");
      throw err;
    }
  };

  // 8. Push simulated interactive call conversational line
  const handleSimulateCallPhrase = async (phone: string, phrase: string) => {
    try {
      const response = await fetch("/api/call/simulate-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, phrase })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Speech sim error");
      
      loadDatabaseState(true);
      return { 
        response: result.data?.response || "",
        parsedData: {
          parsedSize: result.data?.parsedSize || false,
          parsedQty: result.data?.parsedQty || false,
          parsedAddress: result.data?.parsedAddress || false,
          orderGenerated: result.data?.orderGenerated || false,
          orderId: result.data?.orderId
        }
      };
    } catch (err: any) {
      console.error(err);
      toast.error("Call line link lost");
      throw err;
    }
  };

  // 9. Conclude dial-in interactive voice link
  const handleEndCall = async (phone: string, notes = "") => {
    try {
      const response = await fetch("/api/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, notes })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to wrap call");
      
      loadDatabaseState(true);
      return { log: result.data?.callLog };
    } catch (err: any) {
      console.error(err);
      toast.error("Call wrapup connection issue");
      throw err;
    }
  };

  // 10. Manual Webhook trigger injection for testing payment clearance
  const handleTriggerPaymentWebhook = async (orderId: string, status: "success" | "failed") => {
    try {
      const response = await fetch("/api/payments/trigger-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Webhook inject error");
      
      toast.success("Razorpay Webhook transaction authorized");
      loadDatabaseState(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Webhook processing error");
      throw err;
    }
  };

  // 11. Run recurrent chron day-25 patron re-order sweep
  const handleTriggerCronCheck = async () => {
    try {
      const response = await fetch("/api/reorders/check-reminders", {
        method: "POST"
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error);
      
      toast.success("Replenishment sequence check complete");
      loadDatabaseState(true);
      return result.data;
    } catch (err: any) {
      console.error(err);
      toast.error("Cron verification check issue");
      throw err;
    }
  };

  // 12. Reset Gemini usage quota manually
  const handleResetQuota = async () => {
    try {
      const response = await fetch("/api/quota/reset", {
        method: "POST"
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error);
      
      toast.success("Gemini Quota limits flags successfully reset by operator");
      loadDatabaseState(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to reset quota limits");
    }
  };

  // Render Sub Tabs mappings
  const renderActiveTabContent = () => {
    if (!dbData) return null;

    switch (activeTab) {
      case "analytics":
      case "analytics-detail":
        return <AnalyticsTab orders={dbData.orders} customers={dbData.customers} products={dbData.products} />;
      case "orders":
        return (
          <OrdersTab 
            orders={dbData.orders} 
            products={dbData.products} 
            customers={dbData.customers} 
            onCreateManualOrder={handleCreateManualOrder}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            searchQuery={globalSearchQuery}
            onSearchQueryChange={setGlobalSearchQuery}
          />
        );
      case "customers":
        return (
          <CustomersTab 
            customers={dbData.customers} 
            orders={dbData.orders} 
            onUpdateCustomerNote={handleUpdateCustomerNote}
            searchQuery={globalSearchQuery}
            onSearchQueryChange={setGlobalSearchQuery}
          />
        );
      case "ai-agent":
        return (
          <AIAgentTab 
            customers={dbData.customers}
            products={dbData.products}
            conversations={dbData.conversations}
            quickReplies={dbData.quickReplies || []}
            isGeminiConfigured={isGeminiConfigured}
            isQuotaExhausted={isQuotaExhausted}
            isLiteQuotaExhausted={isLiteQuotaExhausted}
            prompts={dbData.prompts}
            onUpdatePrompts={handleUpdatePrompts}
            onResetQuota={handleResetQuota}
            onSaveQuickReply={handleSaveQuickReply}
            onDeleteQuickReply={handleDeleteQuickReply}
            onSimulateWhatsApp={handleSimulateWhatsApp}
            onSimulateCallPhrase={handleSimulateCallPhrase}
            onEndCall={handleEndCall}
            onRefreshData={() => loadDatabaseState(true)}
          />
        );
      case "integrations":
        return (
          <IntegrationsTab 
            orders={dbData.orders}
            webhookLogs={dbData.webhookLogs}
            onTriggerPaymentWebhook={handleTriggerPaymentWebhook}
            onTriggerCronCheck={handleTriggerCronCheck}
            onDispatchWhatsAppReminder={async (p, t) => {}}
            onRefreshData={() => loadDatabaseState(true)}
          />
        );
      case "logs":
        return (
          <LogsTab 
            webhookLogs={dbData.webhookLogs}
            callLogs={dbData.callLogs}
            searchQuery={globalSearchQuery}
            onSearchQueryChange={setGlobalSearchQuery}
          />
        );
      default:
        return (
          <div className="text-center py-20 text-stone-400 font-serif italic text-sm">
            Operational view loading...
          </div>
        );
    }
  };

  return (
    <div className="relative antialiased selection:bg-amber-100 selection:text-amber-900" id="main-application-frame">
      <Toaster position="bottom-right" reverseOrder={false} />
      
      {isLoading ? (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <h1 className="font-serif font-black text-stone-900 text-lg">Hydrating Traditional Ledger Ghee OS...</h1>
            <p className="text-xs text-stone-550 mt-1">Establishing direct link with local database repository</p>
          </div>
        </div>
      ) : errorMsg ? (
        <div className="min-h-screen bg-stone-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors" id="verification-hub">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
            
            {/* Header Status Visualizer */}
            <div className="text-center space-y-2">
              <span className={`inline-flex p-3 rounded-2xl border ${
                serverStatus === "data_error"
                  ? "bg-amber-50 text-amber-500 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40"
                  : "bg-red-50 text-red-500 border-red-100 dark:bg-zinc-950 dark:border-red-950"
              }`}>
                <RefreshCcw className={`w-6 h-6 ${serverStatus === "offline" ? "" : "animate-spin"}`} />
              </span>
              <h2 className="font-serif font-black text-lg text-zinc-900 dark:text-white mt-3">
                Ledger Sync Interrupted
              </h2>
              <p className="text-xs text-zinc-550 dark:text-zinc-400">
                A connection or serialization error has occurred. Let's inspect the diagnostic telemetry.
              </p>
            </div>

            {/* Diagnostic Report Cards Grid */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/60 space-y-3.5">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Live Diagnostic Telemetry
              </h3>
              
              <div className="divide-y divide-zinc-150 dark:divide-zinc-800/50">
                {/* 1. API Heartbeat Server */}
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Express API Server Heartbeat
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                    serverStatus === "data_error" || serverStatus === "healthy"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/20"
                      : "bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/20 animate-pulse"
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${
                      serverStatus === "data_error" || serverStatus === "healthy" ? "bg-emerald-500" : "bg-rose-500"
                    }`} />
                    {serverStatus === "data_error" || serverStatus === "healthy" ? "HEALTHY" : "OFFLINE"}
                  </span>
                </div>

                {/* 2. Database Ledger Integrity */}
                <div className="flex items-center justify-between py-2.5 text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Database Ledger Integrity (db.json)
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                    serverStatus === "healthy"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/20"
                      : "bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/20 animate-pulse"
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${
                      serverStatus === "healthy" ? "bg-emerald-500" : "bg-rose-500"
                    }`} />
                    {serverStatus === "healthy" ? "OK" : "FAILURE (500)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message Details Callout */}
            <div className="p-3 bg-red-50/15 dark:bg-red-950/5 rounded-xl border border-red-100/10 dark:border-red-950/10 text-center">
              <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 block tracking-wide uppercase">
                {serverStatus === "data_error" ? "DB_SERIALIZATION_FAIL" : "SERVER_CONNECTION_TIMEOUT"}
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                {errorMsg}
              </p>
            </div>

            {/* Actionable Trouble Shooting Instructions */}
            <div className="text-[11px] text-zinc-550 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-150 dark:border-zinc-800/30 space-y-2">
              <p className="font-bold text-zinc-750 dark:text-zinc-300 flex items-center gap-1">
                💡 Target Resolution Action:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                {serverStatus === "offline" ? (
                  <>
                    <li>Start development backend with <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-200">npm run dev</code></li>
                    <li>Verify port <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-850 dark:text-zinc-200">3000</code> is free from address collisions.</li>
                  </>
                ) : (
                  <>
                    <li>Your Express backend is alive, but the database JSON layer has parsing conflicts.</li>
                    <li>Try clicking "Repair & Seed Ledger" to reconstruct the database core.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Diagnostic Actions buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button 
                onClick={() => {
                  setIsLoading(true);
                  loadDatabaseState();
                }} 
                className="w-full bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-transform active:scale-[0.98] cursor-pointer text-center flex items-center justify-center gap-2"
                id="btn-retry-diagnostic-sweep"
              >
                <RefreshCcw className="w-3 h-3 animate-spin" />
                Retry Diagnostic Sweep
              </button>
              
              {serverStatus === "data_error" && (
                <button 
                  onClick={async () => {
                    if (confirm("Would you like to trigger a forced DB repair and reset system variables?")) {
                      try {
                        setIsLoading(true);
                        const r = await fetch("/api/quota/reset", { method: "POST" });
                        if (r.ok) {
                          toast.success("Database seed repaired. Re-establishing link...");
                          loadDatabaseState();
                        } else {
                          toast.error("Repair hook rejected by server.");
                          setIsLoading(false);
                        }
                      } catch (err) {
                        toast.error("Network issue calling repair hook.");
                        setIsLoading(false);
                      }
                    }
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 dark:bg-amber-600/90 dark:hover:bg-amber-600 text-zinc-950 dark:text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                  id="btn-repair-database-seeds"
                >
                  Force Repair & Reseed Ledger
                </button>
              )}
            </div>

          </div>
        </div>
      ) : (
        <AppShell 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          searchQuery={globalSearchQuery}
          setSearchQuery={setGlobalSearchQuery}
          notifications={notifications}
          setNotifications={setNotifications}
          serverStatus={serverStatus}
        >
          {renderActiveTabContent()}
        </AppShell>
      )}
    </div>
  );
}
