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

const CHART_COLORS = {
  grid: "hsl(var(--border-strong) / 0.14)",
  text: "hsl(var(--text-secondary))",
  revenue: "hsl(var(--brand-primary))",
  expenses: "hsl(var(--semantic-warning))",
  occupancy: "hsl(var(--semantic-success))",
  tooltipBackground: "hsl(var(--surface-raised))",
  tooltipBorder: "hsl(var(--border-strong) / 0.18)",
};

export default function FinanceCharts({ rows, months }: { rows: ChartRow[]; months: number }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Entrate vs Spese" subtitle="Andamento" action={<ChartColumn className="h-4 w-4 text-brand-primary" />} />
        <div className="h-52 md:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ bottom: months >= 6 ? 20 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: CHART_COLORS.text }}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickLine={{ stroke: CHART_COLORS.grid }}
                interval="preserveStartEnd"
                angle={months >= 6 ? -35 : 0}
                textAnchor={months >= 6 ? "end" : "middle"}
                height={months >= 6 ? 48 : 24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.text }}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickLine={{ stroke: CHART_COLORS.grid }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  background: CHART_COLORS.tooltipBackground,
                  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(74,14,36,0.12)",
                }}
              />
              <Bar dataKey="revenue" name="Entrate" fill={CHART_COLORS.revenue} radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" name="Spese" fill={CHART_COLORS.expenses} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tasso occupazione" subtitle="Andamento" action={<LineChartIcon className="h-4 w-4 text-semantic-success" />} />
        <div className="h-52 md:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ bottom: months >= 6 ? 20 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: CHART_COLORS.text }}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickLine={{ stroke: CHART_COLORS.grid }}
                interval="preserveStartEnd"
                angle={months >= 6 ? -35 : 0}
                textAnchor={months >= 6 ? "end" : "middle"}
                height={months >= 6 ? 48 : 24}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: CHART_COLORS.text }}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickLine={{ stroke: CHART_COLORS.grid }}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  background: CHART_COLORS.tooltipBackground,
                  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(74,14,36,0.12)",
                }}
              />
              <Line
                type="monotone"
                dataKey="occupancyRate"
                name="Tasso occupazione"
                stroke={CHART_COLORS.occupancy}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
