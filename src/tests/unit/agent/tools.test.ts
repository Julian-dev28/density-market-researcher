/**
 * Agent Tools Unit Tests
 *
 * Tests the graceful fallback paths and schema correctness for all 7 agent tools.
 * No real DB or API connections — covers the no-credential paths that fire in
 * dry-run / CI environments, plus tool schema validation.
 */

import { describe, it, expect } from "vitest";
import type { Config } from "../../../config.js";
import {
  AGENT_TOOLS,
  execReadPriorFindings,
  execVerifyPriorCalls,
  execQuerySimilarRegimes,
  execExpandDataSources,
  execReadFoundryObjects,
  execFetchFredSeries,
  execWriteResearchNote,
  type ResearchNote,
} from "../../../agent/tools.js";

// ---------------------------------------------------------------------------
// Config — no credentials (triggers graceful fallback paths)
// ---------------------------------------------------------------------------

const noCredsConfig: Config = {
  FRED_API_KEY: undefined,
  ALPHA_VANTAGE_API_KEY: undefined,
  COINMARKETCAP_API_KEY: undefined,
  DATABASE_URL: undefined,
  OPENHANDS_API_KEY: undefined,
  GITHUB_REPO: undefined,
  MODE: "all",
  DRY_RUN: true,
  LOG_LEVEL: "warn",
  BATCH_SIZE: 50,
  FRED_LOOKBACK_OBSERVATIONS: 53,
};

// ---------------------------------------------------------------------------
// Tool schema validation
// ---------------------------------------------------------------------------

describe("AGENT_TOOLS schema", () => {
  it("exports exactly 7 tools", () => {
    expect(AGENT_TOOLS).toHaveLength(7);
  });

  it("all tools have name, description, and input_schema", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe("object");
    }
  });

  it("includes all expected tool names", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(names).toContain("read_prior_findings");
    expect(names).toContain("verify_prior_calls");
    expect(names).toContain("query_similar_regimes");
    expect(names).toContain("read_foundry_objects");
    expect(names).toContain("fetch_fred_series");
    expect(names).toContain("expand_data_sources");
    expect(names).toContain("write_research_note");
  });

  it("write_research_note requires convictionScore", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "write_research_note")!;
    expect(tool.input_schema.required).toContain("convictionScore");
  });

  it("query_similar_regimes requires regime", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "query_similar_regimes")!;
    expect(tool.input_schema.required).toContain("regime");
  });

  it("expand_data_sources requires description and dataGap", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "expand_data_sources")!;
    expect(tool.input_schema.required).toContain("description");
    expect(tool.input_schema.required).toContain("dataGap");
  });
});

// ---------------------------------------------------------------------------
// execReadPriorFindings — no DATABASE_URL
// ---------------------------------------------------------------------------

describe("execReadPriorFindings — no DATABASE_URL", () => {
  it("returns a non-empty string message", async () => {
    const result = await execReadPriorFindings(5, noCredsConfig);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not throw", async () => {
    await expect(execReadPriorFindings(5, noCredsConfig)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// execVerifyPriorCalls — no DATABASE_URL
// ---------------------------------------------------------------------------

describe("execVerifyPriorCalls — no DATABASE_URL", () => {
  it("returns graceful message without DATABASE_URL", async () => {
    const result = await execVerifyPriorCalls(3, noCredsConfig);
    expect(typeof result).toBe("string");
    expect(result).toContain("DATABASE_URL");
  });

  it("does not throw", async () => {
    await expect(execVerifyPriorCalls(3, noCredsConfig)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// execQuerySimilarRegimes — no DATABASE_URL
// ---------------------------------------------------------------------------

describe("execQuerySimilarRegimes — no DATABASE_URL", () => {
  it("returns graceful message without DATABASE_URL", async () => {
    const result = await execQuerySimilarRegimes("SLOWDOWN", undefined, 5, noCredsConfig);
    expect(typeof result).toBe("string");
    expect(result).toContain("DATABASE_URL");
  });

  it("handles keyword argument without throwing", async () => {
    const result = await execQuerySimilarRegimes("EXPANSION", "yield curve", 3, noCredsConfig);
    expect(typeof result).toBe("string");
  });

  it("does not throw for any valid regime", async () => {
    for (const regime of ["EXPANSION", "SLOWDOWN", "CONTRACTION", "RECOVERY"]) {
      await expect(
        execQuerySimilarRegimes(regime, undefined, 5, noCredsConfig)
      ).resolves.toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// execExpandDataSources — no OPENHANDS_API_KEY
// ---------------------------------------------------------------------------

describe("execExpandDataSources — no OPENHANDS_API_KEY", () => {
  it("returns graceful message without OPENHANDS_API_KEY", async () => {
    const result = await execExpandDataSources(
      "Fetch Treasury auction data from TreasuryDirect",
      "Cannot analyze auction demand / tail risk",
      "test-finding-id",
      noCredsConfig,
    );
    expect(typeof result).toBe("string");
    expect(result).toContain("OPENHANDS_API_KEY");
  });

  it("does not throw", async () => {
    await expect(
      execExpandDataSources("test task", "test gap", "test-id", noCredsConfig)
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// execReadFoundryObjects — no DATABASE_URL
// ---------------------------------------------------------------------------

describe("execReadFoundryObjects — no DATABASE_URL", () => {
  it("returns graceful message for each object type", async () => {
    for (const objectType of ["Density", "SectorSnapshot", "CryptoMetric", "CategorySnapshot"]) {
      const result = await execReadFoundryObjects(objectType, noCredsConfig);
      expect(typeof result).toBe("string");
      expect(result).toContain("DATABASE_URL");
    }
  });

  it("handles unknown objectType gracefully", async () => {
    const result = await execReadFoundryObjects("UnknownType", noCredsConfig);
    expect(typeof result).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// execFetchFredSeries — no FRED_API_KEY
// ---------------------------------------------------------------------------

describe("execFetchFredSeries — no FRED_API_KEY", () => {
  it("returns graceful message without FRED_API_KEY", async () => {
    const result = await execFetchFredSeries("T10Y2Y", 24, noCredsConfig);
    expect(typeof result).toBe("string");
    expect(result).toContain("FRED_API_KEY");
  });

  it("does not throw", async () => {
    await expect(execFetchFredSeries("CPIAUCSL", 12, noCredsConfig)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// execWriteResearchNote — disk write (no DB)
// ---------------------------------------------------------------------------

describe("execWriteResearchNote — no DATABASE_URL", () => {
  const sampleNote: ResearchNote = {
    title: "Test Research Note",
    macroRegime: "SLOWDOWN",
    convictionScore: 7,
    summary: "Test summary for unit test — not a real research note.",
    keyFindings: ["Finding 1: test data", "Finding 2: test signal"],
    anomalies: [
      {
        indicator: "T10Y2Y",
        observation: "Yield curve at 52-week low",
        implication: "Recession risk elevated",
      },
    ],
    investmentIdeas: [
      {
        ticker: "XLP",
        direction: "LONG",
        thesis: "Defensive positioning in slowdown",
        catalyst: "Fed pivot",
        keyRisk: "Sticky inflation",
      },
    ],
    confidence: "MEDIUM",
  };

  it("writes a markdown file and returns the path", async () => {
    const result = await execWriteResearchNote(sampleNote, noCredsConfig);
    expect(typeof result).toBe("string");
    expect(result).toContain("reports/agent_note_");
    expect(result).toContain(".md");
  });

  it("includes conviction score in result message", async () => {
    const result = await execWriteResearchNote(sampleNote, noCredsConfig);
    expect(result).toContain("conviction=7/10");
  });

  it("handles verifications array without throwing", async () => {
    const noteWithVerifications: ResearchNote = {
      ...sampleNote,
      verifications: [
        {
          findingId: "00000000-0000-0000-0000-000000000000",
          accuracy: "CONFIRMED",
          notes: "The SLOWDOWN call was confirmed by subsequent data.",
        },
      ],
    };
    await expect(
      execWriteResearchNote(noteWithVerifications, noCredsConfig)
    ).resolves.toBeDefined();
  });

  it("does not throw when DATABASE_URL is missing", async () => {
    await expect(execWriteResearchNote(sampleNote, noCredsConfig)).resolves.toBeDefined();
  });
});
