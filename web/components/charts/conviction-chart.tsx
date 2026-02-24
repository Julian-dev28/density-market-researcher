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
  CONFIRMED: "#3d6e4f",
  PARTIAL:   "#b07a2a",
  WRONG:     "#b84455",
  PENDING:   "#c0b0a0",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const color = VERIFICATION_DOT[payload.verification ?? "PENDING"] ?? "#c0b0a0";
  return <Dot cx={cx} cy={cy} r={4} fill={color} stroke="#faf7f2" strokeWidth={2} />;
}

export function ConvictionChart({ data }: { data: DataPoint[] }) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(90,70,50,0.08)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#7a6a58", fontSize: 9, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fill: "#7a6a58", fontSize: 9, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          ticks={[2, 4, 6, 8, 10]}
        />
        <ReferenceLine y={5} stroke="rgba(90,70,50,0.12)" strokeDasharray="4 4" />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DataPoint;
            const regimeColor = REGIME_COLOR[d.regime] ?? "#f0ede6";
            return (
              <div
                style={{
                  background: "#f4ede3",
                  border: "1px solid rgba(90,70,50,0.14)",
                  borderRadius: 0,
                  padding: "8px 12px",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  maxWidth: 220,
                }}
              >
                <p style={{ color: "#1a1510", marginBottom: 4, lineHeight: 1.4, fontFamily: "var(--font-sans)" }} className="line-clamp-2">{d.title}</p>
                <p style={{ color: regimeColor }}>{d.regime}</p>
                <p style={{ color: "#7a6a58" }}>conviction {d.conviction}/10</p>
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
          stroke="#4d7c5f"
          strokeWidth={1.5}
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: "#4d7c5f", stroke: "#faf7f2", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
