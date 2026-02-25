/**
 * BTC 15-Minute Prediction
 *
 * Fetches the last 16 15m BTC/USDT candles from Binance (public API, no key)
 * and asks Claude Sonnet to predict the next 15-minute direction.
 *
 * Uses claude-sonnet-4-6 — smarter than Haiku, fast enough for real-time use.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface BtcPrediction {
  direction: "BULLISH" | "BEARISH" | "SIDEWAYS";
  confidence: number;
  currentPrice: number;
  targetRange: { low: number; high: number };
  signals: string[];
  rationale: string;
  predictedAt: string;
  expiresAt: string;
}

const SYSTEM_PROMPT = `You are a short-term BTC price action analyst specializing in 15-minute chart patterns.
Analyze the OHLCV data and context provided, then predict the direction of the NEXT 15-minute candle.

Rules:
- Be honest about uncertainty — confidence should reflect genuine signal strength (50–90 range)
- Cite specific price levels, patterns, or volume signals in your signals array
- Target range should be realistic (typically ±0.2% to ±0.8% for 15 minutes)

Respond with ONLY valid JSON, no other text:
{
  "direction": "BULLISH" | "BEARISH" | "SIDEWAYS",
  "confidence": <integer 50–90>,
  "targetRange": { "low": <price>, "high": <price> },
  "signals": ["<signal>", "<signal>", "<signal>"],
  "rationale": "<1-2 sentences citing specific price levels or patterns>"
}`;

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  try {
    // Fetch 16 x 15m candles + current price from Binance (no auth required)
    const [klineRes, tickerRes] = await Promise.all([
      fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=16"),
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
    ]);

    if (!klineRes.ok || !tickerRes.ok) {
      throw new Error("Binance API unavailable");
    }

    const klines: (string | number)[][] = await klineRes.json();
    const ticker: { price: string } = await tickerRes.json();
    const currentPrice = parseFloat(ticker.price);

    // Format candles as compact OHLCV text
    const candleText = klines
      .map((k) => {
        const t = new Date(k[0] as number).toISOString().slice(11, 16);
        const o = parseFloat(k[1] as string).toFixed(0);
        const h = parseFloat(k[2] as string).toFixed(0);
        const l = parseFloat(k[3] as string).toFixed(0);
        const c = parseFloat(k[4] as string).toFixed(0);
        const v = (parseFloat(k[5] as string) / 1000).toFixed(1);
        const chg = ((parseFloat(k[4] as string) - parseFloat(k[1] as string)) / parseFloat(k[1] as string) * 100).toFixed(2);
        return `${t}  O:${o} H:${h} L:${l} C:${c}  V:${v}k  ${parseFloat(chg) >= 0 ? "+" : ""}${chg}%`;
      })
      .join("\n");

    // Pull Fear & Greed from DB for extra context (non-critical)
    let fearGreedLine = "";
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("crypto_metrics")
        .select("latest_value, signal_rationale")
        .eq("metric_id", "FEAR_GREED")
        .single();
      if (data) {
        fearGreedLine = `\nFear & Greed Index: ${data.latest_value}/100 — ${data.signal_rationale}`;
      }
    } catch { /* non-critical */ }

    const userContent =
      `BTC/USDT 15-minute candles — last 4 hours (oldest → newest):\n${candleText}\n\nCurrent price: $${currentPrice.toLocaleString()}${fearGreedLine}\n\nPredict the next 15-minute candle.`;

    // Call Claude Sonnet
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`);

    const msg = await resp.json();
    const raw: string = msg.content?.[0]?.text?.trim() ?? "{}";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000);

    const prediction: BtcPrediction = {
      direction: ["BULLISH", "BEARISH", "SIDEWAYS"].includes(parsed.direction)
        ? parsed.direction
        : "SIDEWAYS",
      confidence: Math.min(90, Math.max(50, Math.round(Number(parsed.confidence ?? 60)))),
      currentPrice,
      targetRange: {
        low:  Number(parsed.targetRange?.low  ?? currentPrice * 0.999),
        high: Number(parsed.targetRange?.high ?? currentPrice * 1.001),
      },
      signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 5) : [],
      rationale: parsed.rationale ?? "",
      predictedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    return NextResponse.json(prediction);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Prediction failed" },
      { status: 500 }
    );
  }
}
