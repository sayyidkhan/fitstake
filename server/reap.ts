import type { Product } from "./merchants";

// Adapter over Reap Agentic Payments. The real HTTP calls are NOT implemented yet:
// the endpoint contract and Day 1 -> Day 30 mandate validity must be verified with Reap.
// Until REAP_API_KEY is set, a deterministic sandbox simulator is used. It moves no money.

export type Mandate = {
  providerRef: string;
  validUntil: Date;
  spendingCeilingCents: number;
};

export type Quote = { amountCents: number; currency: string; available: boolean; quoteRef: string };

export type CheckoutResult =
  | { status: "checkout_opened"; providerRef: string; checkoutUrl: string }
  | { status: "requires_approval"; providerRef: string; checkoutUrl: string }
  | { status: "failed"; reason: string };

export interface ReapClient {
  // Returns a hosted enrolment/approval reference. Card numbers never touch our server.
  createMandate(input: { userId: string; spendingCeilingCents: number; validDays: number }): Promise<Mandate>;
  quote(product: Product): Promise<Quote>;
  checkout(input: { mandate: Mandate | { providerRef: string }; quote: Quote; product: Product; idempotencyKey: string }): Promise<CheckoutResult>;
}

class SandboxReap implements ReapClient {
  async createMandate({ userId, spendingCeilingCents, validDays }: Parameters<ReapClient["createMandate"]>[0]) {
    return {
      providerRef: `sandbox_mandate_${userId.slice(0, 8)}`,
      validUntil: new Date(Date.now() + validDays * 86_400_000),
      spendingCeilingCents,
    };
  }
  async quote(product: Product): Promise<Quote> {
    return { amountCents: product.priceCents, currency: product.currency, available: true, quoteRef: `sandbox_quote_${product.id}` };
  }
  async checkout({ idempotencyKey }: Parameters<ReapClient["checkout"]>[0]): Promise<CheckoutResult> {
    return {
      status: "checkout_opened",
      providerRef: `sandbox_checkout_${idempotencyKey.slice(-12)}`,
      checkoutUrl: `https://sandbox.reap.invalid/checkout/${encodeURIComponent(idempotencyKey)}`,
    };
  }
}

class NotImplementedReap extends SandboxReap {
  constructor() {
    super();
    throw new Error("Live Reap integration is not implemented. Unset REAP_API_KEY to use the sandbox simulator.");
  }
}

export function getReap(): ReapClient {
  return process.env.REAP_API_KEY ? new NotImplementedReap() : new SandboxReap();
}
