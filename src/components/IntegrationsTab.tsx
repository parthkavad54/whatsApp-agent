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
  AlertTriangle
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
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <span>Razorpay Gateway Webhook Sandbox</span>
              </h3>
              <p className="text-xs text-stone-500">Inject raw merchant webhook payloads to test ledger state transitions</p>
            </div>
            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase">
              Secure Auth Link
            </span>
          </div>

          {pendingOrders.length > 0 ? (
            <form onSubmit={handleWebhookSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Select Unpaid/Pending Order</label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    required
                    className="w-full bg-stone-50 border border-stone-200 focus:bg-white rounded-lg px-3 py-2 outline-hidden"
                  >
                    <option value="">-- Choose Pending Order --</option>
                    {pendingOrders.map(o => (
                      <option key={o.orderId} value={o.orderId}>
                        Ref: {o.orderId} - {o.customerName} (₹{o.amount})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Set Transaction Outcome</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 focus:bg-white rounded-lg px-3 py-2 outline-hidden"
                  >
                    <option value="success">SUCCESS (Mark Paid + Issue Shipment Ledger)</option>
                    <option value="failed">FAILED (Flag Transaction Issue)</option>
                  </select>
                </div>
              </div>

              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/60 font-mono text-[9.5px] text-stone-500 select-all leading-relaxed whitespace-pre-wrap overflow-x-auto">
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
                className="bg-amber-500 hover:bg-amber-600 border border-amber-500 disabled:bg-stone-200 text-stone-950 px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                id="btn-trigger-webhook"
              >
                <Cpu className="w-4 h-4" />
                <span>{injectingWebhook ? "Injectical pinging..." : "Inject Razorpay Webhook Transaction"}</span>
              </button>
            </form>
          ) : (
            <div className="bg-stone-50 p-5 rounded-xl border border-stone-200 text-center text-stone-500 font-serif italic text-xs">
              Every current order in the active queue is successfully paid! No pending ledger items to test.
            </div>
          )}
        </div>

        {/* Google sheets synchronizer visualizer */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Google Sheets Synchronization Portal</span>
            </h3>
            <p className="text-xs text-stone-500">Manual triggers to synchronize or download local spreadsheets trackers</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/65 flex flex-col justify-between">
              <div>
                <strong className="block text-stone-800 text-[12px] font-serif">Dispatches Run</strong>
                <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">Packing lists synchronizations logs matching Courier express</p>
              </div>
              <button 
                onClick={() => downloadSheetCSV("dispatches")}
                className="mt-3.5 bg-white border border-stone-300 hover:border-emerald-600 text-stone-700 hover:text-emerald-800 font-semibold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Dispatch CSV</span>
              </button>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/65 flex flex-col justify-between">
              <div>
                <strong className="block text-stone-800 text-[12px] font-serif">Accounting Settle</strong>
                <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">Financial summaries matching banks clearance ledgers</p>
              </div>
              <button 
                onClick={() => downloadSheetCSV("accounting")}
                className="mt-3.5 bg-white border border-stone-300 hover:border-emerald-600 text-stone-700 hover:text-emerald-800 font-semibold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download accounts CSV</span>
              </button>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/65 flex flex-col justify-between">
              <div>
                <strong className="block text-stone-800 text-[12px] font-serif">Patrons Directory</strong>
                <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">Regular organic buyers dialect and address logs sync</p>
              </div>
              <button 
                onClick={() => downloadSheetCSV("patrons")}
                className="mt-3.5 bg-white border border-stone-300 hover:border-emerald-600 text-stone-700 hover:text-emerald-800 font-semibold py-1.5 rounded-lg text-[10px] flex items-center justify-center gap-1 transition"
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
            className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-2.5 rounded-xl text-xs transition uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-stone-800"
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

        {/* Sync tracking indicators helper */}
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-stone-600 leading-relaxed">
            <strong className="block text-stone-900 text-xs">Active Satcom Linkage</strong>
            <span>Continuous syncing of order tracking data, webhook notifications, and financial ledgers, keeping operations secure.</span>
          </div>
        </div>
      </div>

    </div>
  );
}
