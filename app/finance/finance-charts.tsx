"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/card";
import { ChartColumn, LineChartIcon } from "lucide-react";

type ChartRow = {
  month: string;
  monthLabel: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  occupancyRate: number;
};

export default function FinanceCharts({ rows, months }: { rows: ChartRow[]; months: number }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Entrate vs Spese" subtitle="Andamento" action={<ChartColumn className="h-4 w-4 text-primary" />} />
        <div className="h-52 md:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ bottom: months >= 6 ? 20 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0d5c8" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                angle={months >= 6 ? -35 : 0}
                textAnchor={months >= 6 ? "end" : "middle"}
                height={months >= 6 ? 48 : 24}
              />
              <YAxis tick={{ fontSize: 11 }} width={45} />
              <Tooltip
                contentStyle={{
                  background: "#fdfaf7",
                  border: "1px solid #e0d5c8",
                  borderRadius: 12,
                  boxShadow: "0 4px 12px rgba(80,40,20,0.08)",
                }}
              />
              <Bar dataKey="revenue" fill="#701a2f" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" fill="#f5c842" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tasso occupazione" subtitle="Andamento" action={<LineChartIcon className="h-4 w-4 text-emerald-600" />} />
        <div className="h-52 md:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ bottom: months >= 6 ? 20 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0d5c8" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                angle={months >= 6 ? -35 : 0}
                textAnchor={months >= 6 ? "end" : "middle"}
                height={months >= 6 ? 48 : 24}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={35} />
              <Tooltip
                contentStyle={{
                  background: "#fdfaf7",
                  border: "1px solid #e0d5c8",
                  borderRadius: 12,
                  boxShadow: "0 4px 12px rgba(80,40,20,0.08)",
                }}
              />
              <Line type="monotone" dataKey="occupancyRate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
