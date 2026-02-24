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
  return <Dot cx={cx} cy={cy} r={4} fill={color} stroke="#080909" strokeWidth={2} />;
}

export function ConvictionChart({ data }: { data: DataPoint[] }) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#8a8a8a", fontSize: 9, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fill: "#8a8a8a", fontSize: 9, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          ticks={[2, 4, 6, 8, 10]}
        />
        <ReferenceLine y={5} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DataPoint;
            const regimeColor = REGIME_COLOR[d.regime] ?? "#f0ede6";
            return (
              <div
                style={{
                  background: "#0e0f10",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 0,
                  padding: "8px 12px",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  maxWidth: 220,
                }}
              >
                <p style={{ color: "#f0ede6", marginBottom: 4, lineHeight: 1.4, fontFamily: "var(--font-sans)" }} className="line-clamp-2">{d.title}</p>
                <p style={{ color: regimeColor }}>{d.regime}</p>
                <p style={{ color: "#8a8a8a" }}>conviction {d.conviction}/10</p>
                {d.verification && d.verification !== "PENDING" && (
                  <p style={{ color: VERIFICATION_DOT[d.verification] }}>
                    {d.verification.toLowerCase()}
                  </p>
                )}
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="conviction"
          stroke="#718698"
          strokeWidth={1.5}
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: "#718698", stroke: "#080909", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
