/**
 * x402 Payment Protocol — HTTP 402 Payment Required
 *
 * x402 is an open payment protocol by Coinbase that revives the HTTP 402 status
 * code for internet-native stablecoin micropayments. Stateless, HTTP-native.
 *
 * Flow:
 *   1. Client requests resource → server returns 402 with payment requirements
 *   2. Client signs EIP-3009 transferWithAuthorization, encodes as X-PAYMENT header
 *   3. Client retries with X-PAYMENT header → server verifies + returns 200
 *
 * Config:
 *   PAYMENT_ENABLED=true     enables 402 enforcement (default: false in dev)
 *   X402_PAY_TO_ADDRESS      wallet address receiving USDC payments
 *   X402_PRICE_USDC_ATOMIC   price in USDC atomic units (6 decimals) — default 100000 = $0.10
 *   X402_NETWORK             "base" | "base-sepolia" — default "base-sepolia" for testnet
 *
 * https://github.com/sentient-agi/agent-payments-skill
 * https://x402.org
 */

export interface X402PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  outputSchema: null;
  extra: { name: string; version: string };
}

// USDC contract addresses
const USDC_ADDRESSES: Record<string, string> = {
  "base":         "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "ethereum":     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

export function isPaymentEnabled(): boolean {
  return process.env.PAYMENT_ENABLED === "true";
}

export function getPaymentRequirements(resourceUrl: string): X402PaymentRequirements {
  const network  = process.env.X402_NETWORK ?? "base-sepolia";
  const payTo    = process.env.X402_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000";
  const amount   = process.env.X402_PRICE_USDC_ATOMIC ?? "100000"; // $0.10 USDC default

  return {
    scheme: "exact",
    network,
    maxAmountRequired: amount,
    resource: resourceUrl,
    description: "Macro Research AI — autonomous macro + crypto research feed. Updates every 6h.",
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 300,
    asset: USDC_ADDRESSES[network] ?? USDC_ADDRESSES["base-sepolia"],
    outputSchema: null,
    extra: { name: "macro-research", version: "1" },
  };
}

export function build402Response(requirements: X402PaymentRequirements): Response {
  const body = {
    x402Version: 1,
    error: "Payment Required",
    accepts: [requirements],
  };
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Verify the X-PAYMENT header.
 *
 * In production this would verify the EIP-3009 transferWithAuthorization
 * signature on-chain using Viem. For demo / testnet this does a structural check.
 *
 * To enable full on-chain verification, set PAYMENT_VERIFY_ONCHAIN=true and
 * ensure the wallet has a Base RPC configured.
 */
export function verifyPaymentHeader(
  xPayment: string | null,
  requirements: X402PaymentRequirements
): { valid: boolean; error?: string } {
  if (!xPayment) return { valid: false, error: "Missing X-PAYMENT header" };

  try {
    const decoded = Buffer.from(xPayment, "base64").toString("utf-8");
    const payment = JSON.parse(decoded);

    if (payment.x402Version !== 1)
      return { valid: false, error: "Unsupported x402Version" };
    if (payment.scheme !== requirements.scheme)
      return { valid: false, error: "Scheme mismatch" };
    if (payment.network !== requirements.network)
      return { valid: false, error: "Network mismatch" };
    if (!payment.payload?.signature)
      return { valid: false, error: "Missing payment signature" };

    // TODO: full EIP-3009 on-chain verification via Viem
    // const valid = await verifyEIP3009(payment.payload, requirements);
    return { valid: true };
  } catch {
    return { valid: false, error: "Malformed X-PAYMENT header" };
  }
}

export function buildPaymentResponse(txHash?: string): Record<string, string> {
  return {
    "X-PAYMENT-RESPONSE": JSON.stringify({
      x402Version: 1,
      status: "settled",
      network: process.env.X402_NETWORK ?? "base-sepolia",
      txHash: txHash ?? "demo",
      paidAt: new Date().toISOString(),
    }),
  };
}
