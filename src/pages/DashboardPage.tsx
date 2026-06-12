import { Coins, ShoppingBag, Users, Clock } from "lucide-react";
import MetricCard from "../components/MetricCard";
import { AgentTable } from "../components/AgentTable";
import { LiveActivity } from "../components/LiveActivity";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import React from "react";

export default function DashboardPage({ data, totalRevenue, totalOrdersCount, customerBaseCount, dailyTrendsData, sizeBarData, languagePieData, COLORS, paidOrdersCount, pendingOrdersCount, paymentStatusPieData }: any) {
  return (
    <div className="space-y-6" id="panel-analytics">
      {/* Dynamic KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} change="+12.5%" isPositive={true} icon={Coins} />
        <MetricCard title="Total Orders" value={totalOrdersCount} change="+5%" isPositive={true} icon={ShoppingBag} />
        <MetricCard title="Active Customers" value={customerBaseCount} change="+18%" isPositive={true} icon={Users} />
        <MetricCard title="Avg Response" value="1.2s" change="-18%" isPositive={true} icon={Clock} />
      </div>

      {/* 30-Day Daily Revenue Trend Line Chart */}
      <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4" id="chart-revenue-trends">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Daily Revenue Trend (Last 30 Days)
            </h3>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Completed sales revenue flow tracked via simulated billing webhooks
            </p>
          </div>
        </div>
        <div className="h-64 w-full min-h-[256px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={dailyTrendsData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
              <XAxis dataKey="date" stroke="#78716c" fontSize={10} tickLine={false} dy={8} />
              <YAxis stroke="#78716c" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v}`} dx={-8} />
              <Tooltip formatter={(value) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="Revenue" stroke="#d97706" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3, strokeWidth: 1 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
