import React, { useState, useEffect } from "react";
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

  // App Layout Preferences
  const [activeTab, setActiveTab] = useState<
    "analytics" | "orders" | "customers" | "ai-agent" | "analytics-detail" | "integrations" | "logs"
  >("analytics");

  // Hydration API fetching from Express backend
  const loadDatabaseState = async (silent = false) => {
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("Traditional ledger API is unreachable");
      const result = await res.json();
      
      if (result.success && result.data) {
        setDbData(result.data.db);
        setIsGeminiConfigured(result.data.isGeminiConfigured);
        setIsQuotaExhausted(result.data.isQuotaExhausted || false);
        setIsLiteQuotaExhausted(result.data.isLiteQuotaExhausted || false);
      }
      setErrorMsg(null);
    } catch (err: any) {
      console.error("[Data Sync Fail]:", err);
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
          />
        );
      case "customers":
        return (
          <CustomersTab 
            customers={dbData.customers} 
            orders={dbData.orders} 
            onUpdateCustomerNote={handleUpdateCustomerNote}
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
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto space-y-4">
          <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100">
            <RefreshCcw className="w-8 h-8 mx-auto animate-spin" />
            <h1 className="font-serif font-black text-stone-900 text-base mt-2">Local Connection Interrupted</h1>
            <p className="text-xs text-stone-550 mt-1">{errorMsg}</p>
          </div>
          <button 
            onClick={() => loadDatabaseState()} 
            className="bg-stone-900 text-white font-semibold py-2 px-5 rounded-lg text-xs"
          >
            Retry Database Link
          </button>
        </div>
      ) : (
        <AppShell activeTab={activeTab} setActiveTab={setActiveTab}>
          {renderActiveTabContent()}
        </AppShell>
      )}
    </div>
  );
}
