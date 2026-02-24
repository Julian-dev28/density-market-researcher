/**
 * x402 Payment Protocol Unit Tests
 *
 * Tests the HTTP 402 payment utilities:
 * - Payment requirements shape and content
 * - 402 response format
 * - X-PAYMENT header verification (structural checks)
 * - isPaymentEnabled flag
 *
 * No blockchain or network calls — pure unit tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isPaymentEnabled,
  getPaymentRequirements,
  build402Response,
  verifyPaymentHeader,
  buildPaymentResponse,
} from "../../../../web/lib/x402.js";

// ---------------------------------------------------------------------------
// isPaymentEnabled
// ---------------------------------------------------------------------------

describe("isPaymentEnabled", () => {
  const original = process.env.PAYMENT_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.PAYMENT_ENABLED;
    else process.env.PAYMENT_ENABLED = original;
  });

  it("returns false by default (no env var)", () => {
    delete process.env.PAYMENT_ENABLED;
    expect(isPaymentEnabled()).toBe(false);
  });

  it("returns false when PAYMENT_ENABLED=false", () => {
    process.env.PAYMENT_ENABLED = "false";
    expect(isPaymentEnabled()).toBe(false);
  });

  it("returns true when PAYMENT_ENABLED=true", () => {
    process.env.PAYMENT_ENABLED = "true";
    expect(isPaymentEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPaymentRequirements
// ---------------------------------------------------------------------------

describe("getPaymentRequirements", () => {
  const resource = "https://example.com/api/feed";

  it("returns an object with all required x402 fields", () => {
    const req = getPaymentRequirements(resource);

    expect(req.scheme).toBe("exact");
    expect(req.network).toBeTruthy();
    expect(req.maxAmountRequired).toBeTruthy();
    expect(req.resource).toBe(resource);
    expect(req.description).toBeTruthy();
    expect(req.mimeType).toBe("application/json");
    expect(req.payTo).toBeTruthy();
    expect(req.maxTimeoutSeconds).toBeGreaterThan(0);
    expect(req.asset).toMatch(/^0x[a-fA-F0-9]{40}$/); // valid Ethereum address
    expect(req.outputSchema).toBeNull();
    expect(req.extra.name).toBeTruthy();
    expect(req.extra.version).toBeTruthy();
  });

  it("defaults to base-sepolia network when X402_NETWORK not set", () => {
    const original = process.env.X402_NETWORK;
    delete process.env.X402_NETWORK;

    const req = getPaymentRequirements(resource);
    expect(req.network).toBe("base-sepolia");

    if (original) process.env.X402_NETWORK = original;
    else delete process.env.X402_NETWORK;
  });

  it("defaults to 100000 atomic USDC when X402_PRICE_USDC_ATOMIC not set", () => {
    const original = process.env.X402_PRICE_USDC_ATOMIC;
    delete process.env.X402_PRICE_USDC_ATOMIC;

    const req = getPaymentRequirements(resource);
    expect(req.maxAmountRequired).toBe("100000");

    if (original) process.env.X402_PRICE_USDC_ATOMIC = original;
    else delete process.env.X402_PRICE_USDC_ATOMIC;
  });

  it("respects X402_NETWORK env override", () => {
    const original = process.env.X402_NETWORK;
    process.env.X402_NETWORK = "base";

    const req = getPaymentRequirements(resource);
    expect(req.network).toBe("base");

    if (original) process.env.X402_NETWORK = original;
    else delete process.env.X402_NETWORK;
  });

  it("uses USDC contract address matching the network", () => {
    const original = process.env.X402_NETWORK;
    process.env.X402_NETWORK = "base";

    const req = getPaymentRequirements(resource);
    // Base USDC contract
    expect(req.asset.toLowerCase()).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");

    if (original) process.env.X402_NETWORK = original;
    else delete process.env.X402_NETWORK;
  });
});

// ---------------------------------------------------------------------------
// build402Response
// ---------------------------------------------------------------------------

describe("build402Response", () => {
  it("returns HTTP 402 status", async () => {
    const req = getPaymentRequirements("https://example.com/api/feed");
    const resp = build402Response(req);

    expect(resp.status).toBe(402);
  });

  it("response body has x402Version=1", async () => {
    const req = getPaymentRequirements("https://example.com/api/feed");
    const resp = build402Response(req);
    const body = await resp.json() as { x402Version: number; error: string; accepts: unknown[] };

    expect(body.x402Version).toBe(1);
    expect(body.error).toBeTruthy();
    expect(Array.isArray(body.accepts)).toBe(true);
    expect(body.accepts).toHaveLength(1);
  });

  it("accepts array contains the payment requirements", async () => {
    const req = getPaymentRequirements("https://example.com/api/feed");
    const resp = build402Response(req);
    const body = await resp.json() as { accepts: unknown[] };

    expect(body.accepts[0]).toMatchObject({
      scheme: "exact",
      mimeType: "application/json",
    });
  });

  it("has CORS header", () => {
    const req = getPaymentRequirements("https://example.com/api/feed");
    const resp = build402Response(req);

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ---------------------------------------------------------------------------
// verifyPaymentHeader
// ---------------------------------------------------------------------------

describe("verifyPaymentHeader", () => {
  const requirements = getPaymentRequirements("https://example.com/api/feed");

  it("returns invalid when header is null", () => {
    const result = verifyPaymentHeader(null, requirements);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns invalid when header is empty string", () => {
    const result = verifyPaymentHeader("", requirements);
    expect(result.valid).toBe(false);
  });

  it("returns invalid for malformed base64", () => {
    const result = verifyPaymentHeader("not-valid-base64!!!", requirements);
    expect(result.valid).toBe(false);
  });

  it("returns invalid when x402Version is wrong", () => {
    const payload = JSON.stringify({
      x402Version: 2, // wrong version
      scheme: requirements.scheme,
      network: requirements.network,
      payload: { signature: "0xabc" },
    });
    const header = Buffer.from(payload).toString("base64");
    const result = verifyPaymentHeader(header, requirements);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("x402Version");
  });

  it("returns invalid when scheme mismatches", () => {
    const payload = JSON.stringify({
      x402Version: 1,
      scheme: "streaming", // wrong scheme
      network: requirements.network,
      payload: { signature: "0xabc" },
    });
    const header = Buffer.from(payload).toString("base64");
    const result = verifyPaymentHeader(header, requirements);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Scheme");
  });

  it("returns invalid when network mismatches", () => {
    const payload = JSON.stringify({
      x402Version: 1,
      scheme: requirements.scheme,
      network: "ethereum", // wrong network if requirements says base-sepolia
      payload: { signature: "0xabc" },
    });
    const header = Buffer.from(payload).toString("base64");

    // Only test network mismatch when networks actually differ
    if (requirements.network !== "ethereum") {
      const result = verifyPaymentHeader(header, requirements);
      expect(result.valid).toBe(false);
    }
  });

  it("returns invalid when signature is missing", () => {
    const payload = JSON.stringify({
      x402Version: 1,
      scheme: requirements.scheme,
      network: requirements.network,
      payload: {}, // missing signature
    });
    const header = Buffer.from(payload).toString("base64");
    const result = verifyPaymentHeader(header, requirements);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("signature");
  });

  it("returns valid for a well-formed payment header", () => {
    const payload = JSON.stringify({
      x402Version: 1,
      scheme: requirements.scheme,
      network: requirements.network,
      payload: { signature: "0xdeadbeef" },
    });
    const header = Buffer.from(payload).toString("base64");
    const result = verifyPaymentHeader(header, requirements);

    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildPaymentResponse
// ---------------------------------------------------------------------------

describe("buildPaymentResponse", () => {
  it("returns an object with X-PAYMENT-RESPONSE header key", () => {
    const headers = buildPaymentResponse();
    expect(headers["X-PAYMENT-RESPONSE"]).toBeDefined();
  });

  it("X-PAYMENT-RESPONSE is valid JSON", () => {
    const headers = buildPaymentResponse();
    expect(() => JSON.parse(headers["X-PAYMENT-RESPONSE"])).not.toThrow();
  });

  it("X-PAYMENT-RESPONSE has x402Version=1 and status=settled", () => {
    const headers = buildPaymentResponse("0xabc123");
    const body = JSON.parse(headers["X-PAYMENT-RESPONSE"]);

    expect(body.x402Version).toBe(1);
    expect(body.status).toBe("settled");
    expect(body.txHash).toBe("0xabc123");
  });

  it("uses demo txHash when none provided", () => {
    const headers = buildPaymentResponse();
    const body = JSON.parse(headers["X-PAYMENT-RESPONSE"]);

    expect(body.txHash).toBe("demo");
  });
});
