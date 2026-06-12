
import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  icon: LucideIcon;
  sparkline?: React.ReactNode;
}

export default function MetricCard({ title, value, change, isPositive, icon: Icon, sparkline }: MetricCardProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-stone-200/50 shadow-sm flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <div className="p-2 bg-stone-100 rounded-lg">
          <Icon className="w-5 h-5 text-stone-600" />
        </div>
        <span className={`text-xs font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
          {change}
        </span>
      </div>
      <div>
        <h3 className="text-sm text-stone-500 font-medium">{title}</h3>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      {sparkline && <div className="h-10">{sparkline}</div>}
    </div>
  );
}
