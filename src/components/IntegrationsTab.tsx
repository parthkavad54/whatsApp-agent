import React, { useState } from "react";
import { 
  Plug, 
  FileSpreadsheet, 
  Coins, 
  Calendar, 
  Download, 
  Cpu, 
  RotateCcw, 
  CheckCircle,
  AlertTriangle,
  Wifi,
  Send
} from "lucide-react";
import { Order, WebhookLog } from "../types";

interface IntegrationsTabProps {
  orders: Order[];
  webhookLogs: WebhookLog[];
  onTriggerPaymentWebhook: (orderId: string, status: "success" | "failed") => Promise<void>;
  onTriggerCronCheck: () => Promise<any>;
  onDispatchWhatsAppReminder: (phone: string, text: string) => Promise<any>;
  onRefreshData: () => void;
}

export default function IntegrationsTab({
  orders,
  webhookLogs = [],
  onTriggerPaymentWebhook,
  onTriggerCronCheck,
  onDispatchWhatsAppReminder,
  onRefreshData
}: IntegrationsTabProps) {
  // Webhook form states
  const [selectedOrderId, setSelectedOrderId] = useState(orders.find(o => o.paymentStatus === "Pending")?.orderId || "");
  const [paymentStatus, setPaymentStatus] = useState<"success" | "failed">("success");
  const [injectingWebhook, setInjectingWebhook] = useState(false);

  // Day 25 simulation states
  const [runningCron, setRunningCron] = useState(false);
  const [cronLogs, setCronLogs] = useState<string[]>([]);

  // Filter orders eligible for payments testing
  const pendingOrders = orders.filter(o => o.paymentStatus === "Pending");

  // WhatsApp Gateway Connectivity test states
  const [testPhone, setTestPhone] = useState("");
  const [testingStatus, setTestingStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    responseBody?: string;
    error?: string;
  } | null>(null);

  // SQLite Database Migration States
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "migrating" | "success" | "error">("idle");
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [migrationError, setMigrationError] = useState("");

  const handleRunSqlMigration = async () => {
    setMigrationStatus("migrating");
    setMigrationResult(null);
    setMigrationError("");
    try {
      const res = await fetch("/api/db/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMigrationStatus("success");
        setMigrationResult(data);
        onRefreshData();
      } else {
        setMigrationStatus("error");
        setMigrationError(data.error || "Migration failed due to server error.");
      }
    } catch (err: any) {
      setMigrationStatus("error");
      setMigrationError(err.message || "Network request failed while migrating.");
    }
  };

  const handleConnectivityTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      setTestResult({
        success: false,
        error: "Please enter a valid recipient phone number (including country code, e.g. +91XXXXXXXXXX) to run the diagnostic test."
      });
      setTestingStatus("failed");
      return;
    }
    setTestingStatus("testing");
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestingStatus("success");
        setTestResult(data);
      } else {
        setTestingStatus("failed");
        setTestResult(data || { success: false, error: "Received empty, unexpected, or non-successful API response" });
      }
    } catch (err: any) {
      setTestingStatus("failed");
      setTestResult({
        success: false,
        error: err.message || "Failed to establish a network connection with the local backend endpoint."
      });
    }
  };

  const handleWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      alert("Please select a pending order");
      return;
    }
    setInjectingWebhook(true);
    try {
      await onTriggerPaymentWebhook(selectedOrderId, paymentStatus);
      alert(`Razorpay Webhook dispatched! Order ${selectedOrderId} updated to: ${paymentStatus === 'success' ? 'Paid' : 'Failed'}.`);
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setInjectingWebhook(false);
    }
  };

  const handleCronTrigger = async () => {
    setRunningCron(true);
    setCronLogs(["Scanning database records for recurring patrons..."]);
    try {
      const res = await onTriggerCronCheck();
      onRefreshData();
      
      const newLogs = [
        "Triggered day 25 re-order verification sequence.",
        `Matched ${res?.remindersCheckedCount || 0} regular customers who ordered ~25 days ago.`,
        res?.notifiedPhone 
          ? `Dispatched dynamic WhatsApp template to notification thread: +${res.notifiedPhone}` 
          : "All active client intervals checked. No immediate checkout prompts required today."
      ];
      setCronLogs(prev => [...prev, ...newLogs]);
    } catch (err) {
      setCronLogs(prev => [...prev, "Cron run halted due to active limitations."]);
      console.error(err);
    } finally {
      setRunningCron(false);
    }
  };

  const downloadSheetCSV = (sheetName: "dispatches" | "accounting" | "patrons") => {
    // Generates a mock but structured CSV directly
    let headers: string[] = [];
    let rows: string[][] = [];

    if (sheetName === "dispatches") {
      headers = ["OrderID", "CustomerPhone", "CustomerName", "ProductVolume", "Qty", "Status", "Timestamp"];
      rows = orders.map(o => [o.orderId, o.customerPhone, o.customerName, o.size, String(o.quantity), o.shippingStatus, o.createdAt]);
    } else if (sheetName === "accounting") {
      headers = ["OrderID", "PatronName", "TotalAmount", "Payment", "RazorPayReference", "Timestamp"];
      rows = orders.map(o => [o.orderId, o.customerName, String(o.amount), o.paymentStatus, o.razorpayPaymentId || "N/A", o.createdAt]);
    } else {
      headers = ["Phone", "PatronName", "Dialect", "CountOrders", "HistoricalAddress"];
      // Collect unique patrons
      const uniquePhoneMap: Record<string, string[]> = {};
      orders.forEach(o => {
        uniquePhoneMap[o.customerPhone] = [o.customerName, o.address];
      });
      rows = Object.entries(uniquePhoneMap).map(([p, [n, a]]) => [p, n, "Gujlish", "1", a]);
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GoogleSheets_SuprGhee_${sheetName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="integrations-tab">
      
      {/* Left side: Razorpay Webhooks and Google Sheets trackers */}
      <div className="lg:col-span-8 space-y-6">
        {/* Razorpay Webhook simulator panel */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-4 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span>Razorpay Gateway Webhook Sandbox</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Inject raw merchant webhook payloads to test ledger state transitions</p>
            </div>
            <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">
              Secure Auth Link
            </span>
          </div>

          {pendingOrders.length > 0 ? (
            <form onSubmit={handleWebhookSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Select Unpaid/Pending Order</label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    required
                    className="w-full bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 focus:bg-white dark:focus:bg-zinc-800 rounded-lg px-3 py-2 outline-hidden"
                  >
                    <option value="" className="dark:bg-zinc-900">-- Choose Pending Order --</option>
                    {pendingOrders.map(o => (
                      <option key={o.orderId} value={o.orderId} className="dark:bg-zinc-900">
                        Ref: {o.orderId} - {o.customerName} (₹{o.amount})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Set Transaction Outcome</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 focus:bg-white dark:focus:bg-zinc-800 rounded-lg px-3 py-2 outline-hidden"
                  >
                    <option value="success" className="dark:bg-zinc-900">SUCCESS (Mark Paid + Issue Shipment Ledger)</option>
                    <option value="failed" className="dark:bg-zinc-900">FAILED (Flag Transaction Issue)</option>
                  </select>
                </div>
              </div>

              <div className="bg-stone-50 dark:bg-zinc-950 p-3 rounded-lg border border-stone-200/60 dark:border-zinc-800/80 font-mono text-[9.5px] text-stone-500 dark:text-zinc-400 select-all leading-relaxed whitespace-pre-wrap overflow-x-auto">
{`{
  "event": "payment.authorized",
  "payload": {
    "order_id": "${selectedOrderId || "ORD-XXXX"}",
    "payment_id": "pay_S${Date.now().toString().slice(-6)}",
    "status": "${paymentStatus === "success" ? "authorized" : "failed"}"
  }
}`}
              </div>

              <button
                type="submit"
                disabled={injectingWebhook || !selectedOrderId}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-stone-205 dark:disabled:bg-zinc-800 text-stone-950 disabled:text-stone-400 dark:disabled:text-zinc-500 px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-none"
                id="btn-trigger-webhook"
              >
                <Cpu className="w-4 h-4" />
                <span>{injectingWebhook ? "Injectical pinging..." : "Inject Razorpay Webhook Transaction"}</span>
              </button>
            </form>
          ) : (
            <div className="bg-stone-50 dark:bg-zinc-950/30 p-5 rounded-xl border border-stone-200 dark:border-zinc-850 text-center text-stone-500 dark:text-zinc-400 font-serif italic text-xs">
              Every current order in the active queue is successfully paid! No pending ledger items to test.
            </div>
          )}
        </div>

        {/* Google sheets synchronizer visualizer */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-4 transition-colors">
          <div>
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Google Sheets Synchronization Portal</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">Manual triggers to synchronize or download local spreadsheets trackers</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="p-4 bg-stone-50 dark:bg-zinc-955/35 rounded-xl border border-stone-200/65 dark:border-zinc-800 flex flex-col justify-between">
              <div>
                <strong className="block text-stone-800 dark:text-zinc-200 text-[12px] font-serif">Dispatches Run</strong>
                <p className="text-[10px] text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">Packing lists synchronizations logs matching Courier express</p>
              </div>
              <button 
                onClick={() => downloadSheetCSV("dispatches")}
                className="mt-3.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 hover:border-emerald-600 dark:hover:border-emerald-500 text-stone-700 dark:text-zinc-200 hover:text-emerald-800 dark:hover:text-emerald-400 font-semibold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Dispatch CSV</span>
              </button>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-zinc-955/35 rounded-xl border border-stone-200/65 dark:border-zinc-800 flex flex-col justify-between">
              <div>
                <strong className="block text-stone-800 dark:text-zinc-200 text-[12px] font-serif">Accounting Settle</strong>
                <p className="text-[10px] text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">Financial summaries matching banks clearance ledgers</p>
              </div>
              <button 
                onClick={() => downloadSheetCSV("accounting")}
                className="mt-3.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 hover:border-emerald-600 dark:hover:border-emerald-500 text-stone-700 dark:text-zinc-200 hover:text-emerald-800 dark:hover:text-emerald-400 font-semibold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download accounts CSV</span>
              </button>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-zinc-955/35 rounded-xl border border-stone-200/65 dark:border-zinc-800 flex flex-col justify-between">
              <div>
                <strong className="block text-stone-800 dark:text-zinc-200 text-[12px] font-serif">Patrons Directory</strong>
                <p className="text-[10px] text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">Regular organic buyers dialect and address logs sync</p>
              </div>
              <button 
                onClick={() => downloadSheetCSV("patrons")}
                className="mt-3.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 hover:border-emerald-600 dark:hover:border-emerald-500 text-stone-700 dark:text-zinc-200 hover:text-emerald-800 dark:hover:text-emerald-400 font-semibold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Patrons CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Day 25 cron trigger sandbox */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-stone-950 text-stone-100 p-6 rounded-2xl border border-stone-800 space-y-4">
          <div className="flex gap-2.5 items-center">
            <Calendar className="w-5 h-5 text-amber-500" />
            <h3 className="font-serif font-black text-amber-100 text-sm">Day 25 Re-Order Engine</h3>
          </div>
          <p className="text-[11px] text-stone-300 leading-relaxed">
            Our traditional bilona ghee has a high replenishment window of 25-30 days per 1 Litre container. 
            Simulate our daily cron job run to find customers who placed an order ~25 days ago, and send customized re-order reminders!
          </p>

          <button
            onClick={handleCronTrigger}
            disabled={runningCron}
            className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-2.5 rounded-xl text-xs transition uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-stone-800 border-none"
            id="btn-day25-cron"
          >
            <RotateCcw className={`w-4 h-4 ${runningCron ? "animate-spin" : ""}`} />
            <span>{runningCron ? "Scanning Patrons..." : "Simulate Day 25 Cron"}</span>
          </button>

          {cronLogs.length > 0 && (
            <div className="space-y-1 bg-stone-900 border border-stone-800 p-3 rounded-xl font-mono text-[9px] text-stone-400 select-all max-h-[140px] overflow-y-auto scrollbar-none">
              {cronLogs.map((logLine, index) => (
                <div key={index} className="leading-relaxed">
                  <span className="text-stone-600">{`>`}</span> {logLine}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp Gateway Diagnostics Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 space-y-4 shadow-xs transition-colors">
          <div className="flex gap-2.5 items-center">
            <Wifi className="w-5 h-5 text-amber-500" />
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">WhatsApp API Connectivity Test</h3>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">
            Validate whether your configured <code className="bg-stone-50 dark:bg-zinc-800/40 px-1 py-0.5 rounded font-mono text-[10px]">WHATSAPP_TOKEN</code> and <code className="bg-stone-50 dark:bg-zinc-805/40 px-1 py-0.5 rounded font-mono text-[10px]">WHATSAPP_PHONE_NUMBER_ID</code> match the Graph API correctly by transmitting a live webhook test ping.
          </p>

          <form onSubmit={handleConnectivityTest} className="space-y-3">
            <div>
              <label className="text-[9px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Target Test Recipient Number</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. +919876543210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 focus:bg-white dark:focus:bg-zinc-800 rounded-lg px-3 py-2 text-xs outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={testingStatus === "testing"}
              className="w-full bg-stone-900 hover:bg-stone-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-stone-300 dark:disabled:bg-zinc-800 disabled:text-stone-500 border-none"
            >
              <Send className={`w-3.5 h-3.5 ${testingStatus === "testing" ? "animate-pulse" : ""}`} />
              <span>{testingStatus === "testing" ? "Verifying Keys..." : "Send Live Connectivity Ping"}</span>
            </button>
          </form>

          {testResult && (
            <div className="space-y-3.5 pt-1">
              {testResult.success ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-3 rounded-xl flex gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[10.5px] text-emerald-850 dark:text-emerald-300">
                    <strong className="block font-semibold">Test Message Dispatched Successfully!</strong>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                      HTTP Status <code className="bg-emerald-100 dark:bg-emerald-950 px-1 py-0.5 rounded font-mono text-[9px] font-bold">{testResult.statusCode}</code>
                    </span>
                    <span className="text-[9.5px] text-emerald-700 dark:text-emerald-400 select-all block mt-1.5 bg-white dark:bg-zinc-950/40 p-1.5 rounded border border-emerald-200/50 dark:border-emerald-900/20 font-mono text-[9px] max-h-[80px] overflow-y-auto">
                      {testResult.responseBody}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 dark:bg-rose-950/20 border border-red-200 dark:border-rose-900/40 p-3 rounded-xl flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-[10.5px] text-red-850 dark:text-rose-300">
                    <strong className="block font-semibold text-red-750 dark:text-rose-200">Transmission Blocked / Credentials Missed</strong>
                    <span className="text-[10px] text-red-700 dark:text-rose-450 mt-0.5 block">
                      Status Code: <code className="bg-red-100 dark:bg-red-950 px-1 py-0.5 rounded font-mono text-[9px] font-bold text-red-805 dark:text-rose-300">{testResult.statusCode || "N/A"}</code>
                    </span>
                    {testResult.error && (
                      <p className="text-[10px] text-balance text-red-650 dark:text-rose-400 mt-1">
                        Reason: {testResult.error}
                      </p>
                    )}
                    {testResult.responseBody && (
                      <div className="mt-2.5 space-y-3">
                        {/* Parse and display structured Meta error details if present */}
                        {(() => {
                          try {
                            const parsed = JSON.parse(testResult.responseBody);
                            const metaErr = parsed?.error;
                            if (metaErr) {
                              return (
                                <div className="bg-red-100/40 dark:bg-rose-950/30 p-3 rounded-xl border border-red-200/40 dark:border-rose-900/30 space-y-1.5 text-[11px]">
                                  <span className="text-[9px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400 block">Structured Error Diagnostics</span>
                                  <p className="font-semibold text-rose-900 dark:text-rose-100 leading-normal">
                                    {metaErr.message}
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-rose-700 dark:text-rose-350 pt-1 border-t border-red-200/30 dark:border-rose-900/10">
                                    <div><span className="font-sans text-stone-500 dark:text-zinc-500 font-medium">Type:</span> {metaErr.type || "N/A"}</div>
                                    <div><span className="font-sans text-stone-500 dark:text-zinc-500 font-medium">Error Code:</span> {metaErr.code || "N/A"}</div>
                                    {metaErr.error_subcode !== undefined && (
                                      <div><span className="font-sans text-stone-500 dark:text-zinc-500 font-medium">Sub Code:</span> {metaErr.error_subcode}</div>
                                    )}
                                    {metaErr.fbtrace_id && (
                                      <div className="col-span-2 truncate"><span className="font-sans text-stone-500 dark:text-zinc-500 font-medium">Trace ID:</span> {metaErr.fbtrace_id}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          } catch (_) {}
                          return null;
                        })()}

                        <span className="text-[9px] text-red-600 dark:text-rose-400 uppercase tracking-widest font-bold block">Meta Graph raw response:</span>
                        <pre className="text-[9.5px] select-all bg-white dark:bg-zinc-950/60 text-red-700 dark:text-rose-300 p-2 rounded border border-red-200/50 dark:border-rose-900/25 font-mono text-[9px] max-h-[140px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                          {testResult.responseBody}
                        </pre>
                        {testResult.responseBody.includes('"error"') && (
                          <div className="bg-amber-50 dark:bg-amber-955/40 border border-amber-200/50 dark:border-amber-900/40 p-2.5 rounded-lg space-y-1 text-[10px] text-amber-850 dark:text-amber-200 mt-2">
                            <strong className="block font-bold">Diagnosed Sandbox Restriction (Error 400):</strong>
                            <p className="leading-normal">
                              Meta requires you to explicitly register recipient numbers in the <strong>Meta Developer App Studio Settings</strong> before you can communicate with them in Sandbox mode. Please register <span className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.5 rounded font-bold">{testPhone || "your tester number"}</span> in your Meta dashboard to whitelist it.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SQLite Database Migration Portal */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-805 space-y-3.5 shadow-xs transition-colors">
          <div className="flex gap-2.5 items-center">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">SQLite Relational Engine</h3>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">
            Execute professional SQLite migration to synchronize and inject local <code className="bg-stone-50 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">db.json</code> records into our new high-speed SQL tables.
          </p>

          <button
            onClick={handleRunSqlMigration}
            disabled={migrationStatus === "migrating"}
            className="w-full bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-stone-950 dark:text-stone-100 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-stone-200 dark:disabled:bg-zinc-850 border-none"
            id="btn-sqlite-migration"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${migrationStatus === "migrating" ? "animate-spin" : ""}`} />
            <span>{migrationStatus === "migrating" ? "Migrating Records..." : "Execute SQLite Data Migration"}</span>
          </button>

          {migrationStatus === "success" && migrationResult && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 p-3 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 block">✓ Migration Sync Successful!</span>
              <p className="text-[9.5px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Source parsed and written to <code className="bg-emerald-100/50 dark:bg-emerald-950 px-1 py-0.5 rounded font-mono">db.sqlite</code>.
              </p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px] text-stone-500 dark:text-zinc-400 pt-1.5 border-t border-emerald-200/30 dark:border-emerald-900/10">
                <div>Customers: <strong className="text-stone-700 dark:text-zinc-350">{migrationResult.migratedCounts?.customers ?? 0}</strong></div>
                <div>Orders: <strong className="text-stone-700 dark:text-zinc-350">{migrationResult.migratedCounts?.orders ?? 0}</strong></div>
                <div>Calls Logs: <strong className="text-stone-700 dark:text-zinc-350">{migrationResult.migratedCounts?.callLogs ?? 0}</strong></div>
                <div>Webhooks: <strong className="text-stone-700 dark:text-zinc-350">{migrationResult.migratedCounts?.webhookLogs ?? 0}</strong></div>
                <div>Conversations: <strong className="text-stone-700 dark:text-zinc-350">{migrationResult.migratedCounts?.conversations ?? 0}</strong></div>
                <div>Replies: <strong className="text-stone-700 dark:text-zinc-350">{migrationResult.migratedCounts?.quickReplies ?? 0}</strong></div>
              </div>
            </div>
          )}

          {migrationStatus === "error" && (
            <div className="bg-red-50 dark:bg-rose-950/20 border border-red-200 dark:border-rose-900/40 p-3 rounded-xl flex gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="text-[10px] text-red-800 dark:text-rose-300">
                <strong>Migration Failed</strong>
                <p className="mt-0.5 leading-normal">{migrationError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sync tracking indicators helper */}
        <div className="p-4 bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 flex items-start gap-3 transition-colors">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-stone-600 dark:text-zinc-400 leading-relaxed">
            <strong className="block text-stone-900 dark:text-zinc-100 text-xs">Active Satcom Linkage</strong>
            <span>Continuous syncing of order tracking data, webhook notifications, and financial ledgers, keeping operations secure.</span>
          </div>
        </div>
      </div>

    </div>
  );
}
