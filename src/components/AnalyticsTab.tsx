import React from "react";
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Coins, 
  MessageSquare, 
  Phone, 
  Scale, 
  Layers,
  AlertTriangle,
  FileDown,
  Download,
  FileSpreadsheet
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Product, Order, Customer } from "../types";
import { useLanguage } from "../context/LanguageContext";
import { exportOrdersCSV, exportCustomersCSV, exportConsolidatedPDF } from "../utils/exportUtils";

interface AnalyticsTabProps {
  orders: Order[];
  customers: Customer[];
  products: Product[];
}

export default function AnalyticsTab({ orders, customers, products }: AnalyticsTabProps) {
  const { t } = useLanguage();
  // Aggregate Metrics
  const totalRevenue = orders
    .filter(o => o.paymentStatus === "Paid")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalOrders = orders.length;
  const activePatrons = customers.length;
  const paidOrdersCount = orders.filter(o => o.paymentStatus === "Paid").length;
  const averageTicketSize = paidOrdersCount > 0 ? Math.round(totalRevenue / paidOrdersCount) : 0;

  // Process Daily revenue trends (last 7 days or matching available orders)
  const processRevenueTrends = () => {
    const daysMap: Record<string, { date: string; revenue: number; volume: number }> = {};
    const sortedOrders = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sortedOrders.forEach(o => {
      const dateStr = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!daysMap[dateStr]) {
        daysMap[dateStr] = { date: dateStr, revenue: 0, volume: 0 };
      }
      daysMap[dateStr].volume += 1;
      if (o.paymentStatus === "Paid") {
        daysMap[dateStr].revenue += o.amount;
      }
    });

    return Object.values(daysMap).slice(-7);
  };

  const trendData = processRevenueTrends();

  // Process Product Size Breakdown (500ml, 1L, 5L)
  const processSizeBreakdown = () => {
    const sizeMap: Record<string, number> = { "500ml": 0, "1L": 0, "5L": 0 };
    orders.forEach(o => {
      const s = o.size || "1L";
      if (sizeMap[s] !== undefined) {
        sizeMap[s] += o.quantity;
      } else {
        sizeMap[s] = o.quantity;
      }
    });

    return Object.entries(sizeMap).map(([name, value]) => ({ name, value }));
  };

  const sizeBreakdownData = processSizeBreakdown();
  const COLORS_SIZE = ["#D97706", "#F59E0B", "#FBBF24"];

  // Process Payment status breakdown
  const processPaymentBreakdown = () => {
    const statusMap: Record<string, number> = { Paid: 0, Pending: 0, Failed: 0 };
    orders.forEach(o => {
      if (statusMap[o.paymentStatus] !== undefined) {
        statusMap[o.paymentStatus] += 1;
      }
    });
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
  };

  const paymentBreakdownData = processPaymentBreakdown();
  const COLORS_PAYMENT = ["#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="space-y-6" id="analytics-tab-container">
      {/* Report Generating Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors" id="business-report-export-toolbar">
        <div>
          <h2 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm flex items-center gap-2">
            <FileDown className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            <span>Business Reports & Export Portal</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            Generate and download business compliance spreadsheets (CSV) or high-fidelity certified PDF executive summaries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {/* PDF Export Button */}
          <button
            onClick={() => exportConsolidatedPDF(orders, customers, products, totalRevenue, totalOrders, averageTicketSize)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs transition duration-150 cursor-pointer"
            title="Download full business PDF summary"
            id="download-pdf-report-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Executive PDF</span>
          </button>

          {/* Orders CSV Button */}
          <button
            onClick={() => exportOrdersCSV(orders)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-semibold text-xs rounded-xl border border-stone-200 dark:border-zinc-800 transition duration-150 cursor-pointer"
            title="Export orders lists/spreadsheet"
            id="download-orders-csv-btn"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Orders CSV</span>
          </button>

          {/* Customers CSV Button */}
          <button
            onClick={() => exportCustomersCSV(customers)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-semibold text-xs rounded-xl border border-stone-200 dark:border-zinc-800 transition duration-150 cursor-pointer"
            title="Export customers roster"
            id="download-customers-csv-btn"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Customers CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Revenue */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">{t("metrics.revenue")}</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900 dark:text-zinc-100">₹{totalRevenue.toLocaleString("en-IN")}</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{t("metrics.revenueDesc")}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Orders */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">{t("metrics.dispatches")}</span>
            <div className="p-2 bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900 dark:text-zinc-100">{totalOrders} Jars</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-500 dark:text-zinc-400 font-medium">
              <Layers className="w-3.5 h-3.5" />
              <span>{t("metrics.dispatchesDesc")}</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Patrons */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">{t("metrics.patrons")}</span>
            <div className="p-2 bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900 dark:text-zinc-100">{activePatrons}</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium font-serif">
              <span>{t("metrics.patronsDesc")}</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Average Order size */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">{t("metrics.avgValue")}</span>
            <div className="p-2 bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900 dark:text-zinc-100">₹{averageTicketSize}</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-500 dark:text-zinc-400 font-medium font-mono">
              <span>{t("metrics.avgValueDesc")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Sales performance */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs lg:col-span-8 flex flex-col transition-colors">
          <div className="mb-4">
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">{t("charts.growthLedger")}</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">{t("charts.growthDesc")}</p>
          </div>
          <div className="h-64 w-full text-xs">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F4" className="stroke-zinc-100 dark:stroke-zinc-800" />
                  <XAxis dataKey="date" stroke="#A8A29E" fontSize={10} />
                  <YAxis stroke="#A8A29E" fontSize={10} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgb(24, 24, 27)', borderColor: 'rgb(63, 63, 70)', color: '#fff' }} formatter={(value: any) => [`₹${value.toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#D97706" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400 dark:text-zinc-500">
                Awaiting order ledger activation...
              </div>
            )}
          </div>
        </div>

        {/* Jar Size Breakdown */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs lg:col-span-4 flex flex-col transition-colors">
          <div className="mb-4">
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">{t("charts.jarDistribution")}</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">{t("charts.jarDesc")}</p>
          </div>
          <div className="h-48 w-full relative flex items-center justify-center text-xs">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={sizeBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sizeBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_SIZE[index % COLORS_SIZE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgb(24, 24, 27)', borderColor: 'rgb(63, 63, 70)', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-550">Core Size</span>
              <strong className="text-stone-800 dark:text-zinc-100 text-sm font-serif font-bold">1L Jar</strong>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {sizeBreakdownData.map((item, idx) => (
              <div key={item.name} className="flex justify-between items-center text-xs text-stone-600 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_SIZE[idx % COLORS_SIZE.length] }} />
                  <span>{item.name} Traditional Jar</span>
                </div>
                <strong className="text-stone-900 dark:text-zinc-100">{item.value} dispatches</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Physical Inventory Control Card */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs transition-colors" id="inventory-control-section">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm flex items-center gap-2">
              <span className="p-1 px-1.5 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 font-bold rounded text-[9px] uppercase tracking-wider select-none align-middle">Bilona ERP</span>
              <span className="align-middle">{t("analytics.inventoryTitle")}</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">{t("analytics.inventoryDesc")}</p>
          </div>
          <div className="text-[10px] font-mono font-bold bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 px-2.5 py-1 rounded-lg self-start sm:self-center">
            Low Stock Alert Threshold: &lt; 10 Units
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]" id="inventory-table">
            <thead>
              <tr className="border-b border-stone-100 dark:border-zinc-800 text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500">
                <th className="py-2.5 font-bold tracking-wider">{t("analytics.item")}</th>
                <th className="py-2.5 font-bold tracking-wider text-center">{t("analytics.size")}</th>
                <th className="py-2.5 font-bold tracking-wider text-right">{t("analytics.price")}</th>
                <th className="py-2.5 font-bold tracking-wider text-right">{t("analytics.stockLeft")}</th>
                <th className="py-2.5 font-bold tracking-wider text-right">{t("analytics.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800 text-xs">
              {products.map((p) => {
                const isLowStock = p.stock < 10;
                return (
                  <tr key={p.id} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-serif font-black text-stone-900 dark:text-zinc-100">{p.name || "Gir Cow A2 Desi Ghee"}</div>
                      <div className="text-[10px] text-stone-400 dark:text-zinc-500 line-clamp-1 mt-0.5">{p.origin || "Gir Satva Farms, Gujarat"}</div>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-stone-700 dark:text-zinc-300">
                      {p.size}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-stone-800 dark:text-zinc-200">
                      ₹{p.price.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 text-right pr-4">
                      <div className="inline-flex flex-col items-end">
                        <span className={`font-mono font-bold ${isLowStock ? 'text-rose-600 dark:text-rose-400 font-extrabold animate-pulse' : 'text-stone-800 dark:text-zinc-250'}`}>
                          {p.stock} Jars
                        </span>
                        {/* Miniature visual progress bar */}
                        <div className="w-16 h-1 bg-stone-100 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isLowStock ? 'bg-rose-500' : 'bg-amber-500'}`} 
                            style={{ width: `${Math.min(100, (p.stock / 100) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-bold px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider border border-rose-200/50 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>{t("analytics.badgeLow")}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/15 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider border border-emerald-100/55">
                          <span>{t("analytics.badgeNormal")}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Settle Metrics */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col transition-colors">
          <div className="mb-3">
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">{t("charts.clearanceLedger")}</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">{t("charts.clearanceDesc")}</p>
          </div>
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-around py-4">
            <div className="h-36 w-36 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={paymentBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_PAYMENT[index % COLORS_PAYMENT.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgb(24, 24, 27)', borderColor: 'rgb(63, 63, 70)', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4 sm:mt-0 text-xs text-stone-600 dark:text-zinc-300">
              {paymentBreakdownData.map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-4 justify-between w-40">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_PAYMENT[idx % COLORS_PAYMENT.length] }} />
                    <span>{entry.name}</span>
                  </div>
                  <strong className="text-stone-900 dark:text-zinc-100 font-mono">{entry.value} orders</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Traditional Vedic Standard compliance helper Card */}
        <div className="bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-100 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col justify-between transition-colors shadow-xs">
          <div>
            <span className="bg-amber-500 text-stone-950 font-bold px-2.5 py-0.5 rounded text-[9px] uppercase tracking-wider">{t("charts.complianceGuard")}</span>
            <h3 className="font-serif font-black text-amber-700 dark:text-amber-100 text-base mt-2">{t("charts.complianceTitle")}</h3>
            <p className="text-stone-600 dark:text-stone-300 text-xs mt-1.5 leading-relaxed">
              {t("charts.complianceDesc")}
            </p>
          </div>
          <div className="mt-6 border-t border-stone-200 dark:border-stone-800 pt-4 flex justify-between items-center text-[10px] text-stone-500 dark:text-stone-400 font-mono">
            <span>{t("charts.traceability")}</span>
            <span className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded font-medium">{t("charts.registryActive")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
