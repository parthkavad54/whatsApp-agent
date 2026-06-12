
import { Bot, CheckCircle, TrendingUp, Clock } from "lucide-react";
import MetricCard from "./MetricCard";
import { AgentTable } from "./AgentTable";
import { LiveActivity } from "./LiveActivity";

export default function DashboardOverview() {
  return (
    <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Active AI Agents" value="24" change="+12%" isPositive={true} icon={Bot} />
            <MetricCard title="Tasks Completed Today" value="1,847" change="+23%" isPositive={true} icon={CheckCircle} />
            <MetricCard title="Success Rate" value="96.8%" change="+2.4%" isPositive={true} icon={TrendingUp} />
            <MetricCard title="Avg Response Time" value="1.2s" change="-18%" isPositive={true} icon={Clock} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <AgentTable agents={[
                    { id: 1, name: "Support Bot Alpha", role: "Customer Support", status: "Running", performance: 98 },
                    { id: 2, name: "SalesAI Pro", role: "Sales Assistant", status: "Running", performance: 93 },
                    { id: 3, name: "Data Analyzer X", role: "Data Analyst", status: "Learning", performance: 90 },
                    { id: 4, name: "Ops Manager AI", role: "Operations", status: "Running", performance: 87 },
                ]} />
            </div>
            <div className="lg:col-span-1">
                <LiveActivity activities={[
                    { text: "Resolved customer ticket #4523", time: "2min ago" },
                    { text: "Automated inventory update", time: "5min ago" },
                    { text: "Completed sales trend analysis", time: "7min ago" },
                    { text: "Triggered lead nurturing sequence", time: "11min ago" },
                ]} />
            </div>
        </div>
    </div>
  );
}
