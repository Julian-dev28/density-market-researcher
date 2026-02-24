"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DataPoint {
  name: string;
  fullName: string;
  dayChange: number;
  weekChange: number;
  monthChange: number;
  ytdChange: number;
}

export function SectorBarChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DataPoint;
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="font-medium text-popover-foreground">{d.fullName}</p>
                <p className={`mt-1 ${d.dayChange > 0 ? "text-green-400" : d.dayChange < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  Day: {d.dayChange > 0 ? "+" : ""}{d.dayChange.toFixed(2)}%
                </p>
              </div>
            );
          }}
        />
        <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" />
        <Bar dataKey="dayChange" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.dayChange >= 0 ? "oklch(0.696 0.17 162.48)" : "oklch(0.704 0.191 22.216)"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
