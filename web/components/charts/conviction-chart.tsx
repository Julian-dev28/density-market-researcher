"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from "recharts";

type DataPoint = {
  date: string;
  conviction: number;
  regime: string;
  title: string;
  verification: string | null;
};

const REGIME_COLOR: Record<string, string> = {
  EXPANSION:   "#4ade80",
  RECOVERY:    "#60a5fa",
  SLOWDOWN:    "#facc15",
  CONTRACTION: "#f87171",
};

const VERIFICATION_DOT: Record<string, string> = {
  CONFIRMED: "#4ade80",
  PARTIAL:   "#facc15",
  WRONG:     "#f87171",
  PENDING:   "#6b7280",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const color = VERIFICATION_DOT[payload.verification ?? "PENDING"] ?? "#6b7280";
  return <Dot cx={cx} cy={cy} r={5} fill={color} stroke="oklch(0.145 0 0)" strokeWidth={2} />;
}

export function ConvictionChart({ data }: { data: DataPoint[] }) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "oklch(0.708 0 0)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fill: "oklch(0.708 0 0)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          ticks={[2, 4, 6, 8, 10]}
        />
        <ReferenceLine y={5} stroke="oklch(1 0 0 / 15%)" strokeDasharray="4 4" />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DataPoint;
            const regimeColor = REGIME_COLOR[d.regime] ?? "#e5e7eb";
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md max-w-xs">
                <p className="font-medium text-popover-foreground mb-1 line-clamp-2">{d.title}</p>
                <p style={{ color: regimeColor }}>{d.regime}</p>
                <p className="text-muted-foreground">Conviction: {d.conviction}/10</p>
                {d.verification && d.verification !== "PENDING" && (
                  <p style={{ color: VERIFICATION_DOT[d.verification] }}>
                    Verified: {d.verification}
                  </p>
                )}
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="conviction"
          stroke="oklch(0.708 0 0)"
          strokeWidth={1.5}
          dot={<CustomDot />}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
