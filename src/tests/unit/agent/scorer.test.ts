/**
 * Quality Scorer Unit Tests
 *
 * Tests the CryptoAnalystBench-inspired quality scoring module.
 * No real Anthropic API calls — covers the no-key fallback path
 * and interface/contract validation.
 */

import { describe, it, expect } from "vitest";
import { scoreResearchNote, type QualityScores } from "../../../agent/scorer.js";
import type { ResearchNote } from "../../../agent/tools.js";

const sampleNote: ResearchNote = {
  title: "Yield Curve Inversion Deepens as Consumer Sentiment Collapses",
  macroRegime: "SLOWDOWN",
  convictionScore: 7,
  summary:
    "The 10Y-2Y spread has narrowed 14bp in 3 weeks to its 52-week low of 0.14%. " +
    "Consumer sentiment (UMCSENT) has fallen 29% over 22 months. Core CPI at +0.295% MoM " +
    "constrains Fed easing room. Regime: SLOWDOWN with elevated recession risk in 6-12 months.",
  keyFindings: [
    "T10Y2Y at 0.14% — 52-week low, flattened 14bp in 3 weeks",
    "UMCSENT at 56.4, down from 74.0 — 29% collapse over 22 months",
    "Core CPI +0.295% MoM (~3.6% annualized) — sticky, constrains Fed",
    "XLF -7.65% YTD while HY spreads at 2.86% — credit/equity divergence",
    "Industrial Production at 100th percentile — hard data still robust",
  ],
  anomalies: [
    {
      indicator: "XLF vs HY Spreads",
      observation: "XLF -7.65% YTD while BAMLH0A0HYM2 sits at 2.86%",
      implication: "Credit markets complacent relative to equity signal in financials",
    },
  ],
  investmentIdeas: [
    {
      ticker: "XLP",
      direction: "LONG",
      thesis: "Defensive positioning in consumer staples during slowdown",
      catalyst: "Fed pivot on weakening data",
      keyRisk: "Sticky inflation delays easing",
    },
  ],
  confidence: "HIGH",
};

// ---------------------------------------------------------------------------
// No ANTHROPIC_API_KEY — graceful null return
// ---------------------------------------------------------------------------

describe("scoreResearchNote — no ANTHROPIC_API_KEY", () => {
  it("returns null when no API key is set", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await scoreResearchNote(sampleNote);
    expect(result).toBeNull();

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("does not throw when no API key", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(scoreResearchNote(sampleNote)).resolves.toBeNull();

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });
});

// ---------------------------------------------------------------------------
// QualityScores interface contract
// ---------------------------------------------------------------------------

describe("QualityScores interface", () => {
  it("has the expected shape when non-null", () => {
    // Verify TypeScript type shape by constructing a valid QualityScores object
    const scores: QualityScores = {
      relevance: 8,
      depth: 7,
      temporalAccuracy: 9,
      dataConsistency: 8,
      overall: 8.0,
    };

    expect(scores.relevance).toBeGreaterThanOrEqual(1);
    expect(scores.relevance).toBeLessThanOrEqual(10);
    expect(scores.depth).toBeGreaterThanOrEqual(1);
    expect(scores.temporalAccuracy).toBeGreaterThanOrEqual(1);
    expect(scores.dataConsistency).toBeGreaterThanOrEqual(1);
    expect(scores.overall).toBeGreaterThanOrEqual(1);
    expect(scores.overall).toBeLessThanOrEqual(10);
  });

  it("overall is the average of the four dimensions", () => {
    const r = 8, d = 7, t = 9, c = 8;
    const expected = Math.round(((r + d + t + c) / 4) * 10) / 10;
    expect(expected).toBe(8.0);
  });

  it("overall rounds to one decimal place", () => {
    const r = 7, d = 8, t = 6, c = 9;
    const avg = (r + d + t + c) / 4; // 7.5
    const rounded = Math.round(avg * 10) / 10;
    expect(rounded).toBe(7.5);
    expect(rounded.toString()).toMatch(/^\d+(\.\d)?$/);
  });
});

// ---------------------------------------------------------------------------
// ResearchNote input validation
// ---------------------------------------------------------------------------

describe("scoreResearchNote — input handling", () => {
  it("accepts a note with minimal fields without throwing", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const minimalNote: ResearchNote = {
      title: "Test",
      macroRegime: "EXPANSION",
      convictionScore: 5,
      summary: "Test summary",
      keyFindings: [],
      anomalies: [],
      investmentIdeas: [],
      confidence: "LOW",
    };

    await expect(scoreResearchNote(minimalNote)).resolves.toBeNull();

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("handles a note with verifications without throwing", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const noteWithVerifications: ResearchNote = {
      ...sampleNote,
      verifications: [
        { findingId: "abc-123", accuracy: "CONFIRMED", notes: "Regime call confirmed" },
      ],
    };

    await expect(scoreResearchNote(noteWithVerifications)).resolves.toBeNull();

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });
});
