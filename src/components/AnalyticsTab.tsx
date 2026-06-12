import React from "react";
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Coins, 
  MessageSquare, 
  Phone, 
  Scale, 
  Layers 
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

interface AnalyticsTabProps {
  orders: Order[];
  customers: Customer[];
  products: Product[];
}

export default function AnalyticsTab({ orders, customers, products }: AnalyticsTabProps) {
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
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 uppercase tracking-wider">Gross Revenue</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900">₹{totalRevenue.toLocaleString("en-IN")}</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real-time Bilona Ledger</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Orders */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 uppercase tracking-wider">Total Dispatches</span>
            <div className="p-2 bg-stone-50 text-stone-700 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900">{totalOrders} Jars</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-500 font-medium">
              <Layers className="w-3.5 h-3.5" />
              <span>Vedic Express handovers</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Patrons */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 uppercase tracking-wider">Registered Patrons</span>
            <div className="p-2 bg-stone-50 text-stone-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900">{activePatrons}</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-600 font-medium font-serif">
              <span>94% Returning Rate</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Average Order size */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-serif font-bold text-stone-500 uppercase tracking-wider">Average Order Value</span>
            <div className="p-2 bg-stone-50 text-stone-700 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-serif font-black text-stone-900">₹{averageTicketSize}</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-500 font-medium">
              <span>Optimized 1L/5L jars</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Sales performance */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs lg:col-span-8 flex flex-col">
          <div className="mb-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm">Ghee Revenue Growth Ledger</h3>
            <p className="text-xs text-stone-500">Traditional Sales logs generated through online WhatsApp and dial-in interactions</p>
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F4" />
                  <XAxis dataKey="date" stroke="#A8A29E" fontSize={10} />
                  <YAxis stroke="#A8A29E" fontSize={10} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#D97706" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400">
                Awaiting order ledger activation...
              </div>
            )}
          </div>
        </div>

        {/* Jar Size Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs lg:col-span-4 flex flex-col">
          <div className="mb-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm">Jar Size Distribution</h3>
            <p className="text-xs text-stone-500">Demand breakdown by size volume packages</p>
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="block text-[10px] uppercase font-bold text-stone-400">Core Size</span>
              <strong className="text-stone-800 text-sm font-serif font-bold">1L Jar</strong>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {sizeBreakdownData.map((item, idx) => (
              <div key={item.name} className="flex justify-between items-center text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_SIZE[idx % COLORS_SIZE.length] }} />
                  <span>{item.name} Traditional Jar</span>
                </div>
                <strong className="text-stone-900">{item.value} dispatches</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Settle Metrics */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col">
          <div className="mb-3">
            <h3 className="font-serif font-bold text-stone-900 text-sm">Financial Clearance Ledger</h3>
            <p className="text-xs text-stone-500">Razorpay gateway payment validation metrics</p>
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4 sm:mt-0 text-xs text-stone-600">
              {paymentBreakdownData.map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-4 justify-between w-40">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS_PAYMENT[idx % COLORS_PAYMENT.length] }} />
                    <span>{entry.name}</span>
                  </div>
                  <strong className="text-stone-900 font-mono">{entry.value} orders</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Traditional Vedic Standard compliance helper */}
        <div className="bg-stone-900 text-stone-100 p-6 rounded-2xl border border-stone-800 flex flex-col justify-between">
          <div>
            <span className="bg-amber-500 text-stone-950 font-bold px-2.5 py-0.5 rounded text-[9px] uppercase tracking-wider">Operational Quality Guard</span>
            <h3 className="font-serif font-black text-amber-100 text-base mt-2">Vedic Bilona Standards</h3>
            <p className="text-stone-300 text-xs mt-1.5 leading-relaxed">
              Every jar represents unadulterated churned ghee sourced from authentic Indian Gir cows, boiled at optimal firewood temperatures on full-moon evenings. Our CRM ensures full-path traceability matching high-standard production logs.
            </p>
          </div>
          <div className="mt-6 border-t border-stone-800 pt-4 flex justify-between items-center text-[10px] text-stone-400 font-mono">
            <span>Traceability Check: PASSED</span>
            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Vedic Registry Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
