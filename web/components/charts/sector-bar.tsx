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
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#8a8a8a", fontSize: 9, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#8a8a8a", fontSize: 9, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DataPoint;
            return (
              <div
                style={{
                  background: "#0e0f10",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 0,
                  padding: "8px 12px",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                }}
              >
                <p style={{ color: "#f0ede6", marginBottom: 4, fontFamily: "var(--font-sans)" }}>{d.fullName}</p>
                <p style={{ color: d.dayChange > 0 ? "#4ade80" : d.dayChange < 0 ? "#f87171" : "#8a8a8a" }}>
                  {d.dayChange > 0 ? "+" : ""}{d.dayChange.toFixed(2)}%
                </p>
              </div>
            );
          }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
        <Bar dataKey="dayChange" radius={[2, 2, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.dayChange >= 0 ? "#4ade80" : "#f87171"}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
