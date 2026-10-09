import type { Product } from "./merchants.js";
import { DEMO_SHIPPING_ADDRESS } from "./demoAddress.js";

// Adapter over Reap Agentic Payments (https://docs.reap.global/agentic-payments/overview).
// Reap mandates are not live yet, so Day 30 purchases go through the hosted approval flow:
// Day 1 enrols a card (hosted page, card data never touches us) and Day 30 checkouts return an approval link.
// Without REAP_API_KEY a local simulator is used; it moves no money.

export type Enrollment = {
  enrollmentId: string;
  active: boolean;
  approvalUrl: string | null;
};
export type Quote = { quoteId: string; amountCents: number; currency: string };
export type CheckoutStatus =
  "requires_approval" | "checkout_opened" | "completed" | "failed";
export type CheckoutResult = {
  status: CheckoutStatus;
  providerRef?: string;
  approvalUrl?: string | null;
  amountCents?: number;
  reason?: string;
};

export interface ReapClient {
  createEnrollment(input: {
    userId: string;
    name: string;
    email: string;
    returnUrl: string;
    idempotencyKey: string;
  }): Promise<Enrollment>;
  getEnrollment(
    enrollmentId: string,
  ): Promise<{ active: boolean; failed: boolean }>;
  quote(input: {
    product: Product;
    email: string;
    idempotencyKey: string;
  }): Promise<Quote>;
  checkout(input: {
    quote: Quote;
    enrollmentId: string;
    returnUrl: string;
    idempotencyKey: string;
  }): Promise<CheckoutResult>;
  getCheckout(checkoutId: string): Promise<CheckoutResult>;
}

class SandboxReap implements ReapClient {
  async createEnrollment({ userId }: { userId: string }) {
    return {
      enrollmentId: `sim_enr_${userId.slice(0, 8)}`,
      active: true,
      approvalUrl: null,
    };
  }
  async getEnrollment() {
    return { active: true, failed: false };
  }
  async quote({ product }: { product: Product }) {
    return {
      quoteId: `sim_quote_${product.id}`,
      amountCents: product.priceCents,
      currency: product.currency,
    };
  }
  async checkout({
    quote,
    idempotencyKey,
  }: {
    quote: Quote;
    idempotencyKey: string;
  }): Promise<CheckoutResult> {
    return {
      status: "completed",
      providerRef: `sim_checkout_${idempotencyKey.slice(-12)}`,
      amountCents: quote.amountCents,
    };
  }
  async getCheckout(id: string): Promise<CheckoutResult> {
    return { status: "completed", providerRef: id };
  }
}

type Json = Record<string, any>;

// Reap amounts are assumed to be major units (e.g. "58.00"); verify against a real sandbox response.
function toCents(v: unknown): number {
  const raw = typeof v === "object" && v !== null ? (v as Json).amount : v;
  const n = Number(raw);
  if (!Number.isFinite(n))
    throw new Error("Unrecognised amount in Reap response");
  return Math.round(n * 100);
}

class LiveReap implements ReapClient {
  constructor(
    private key: string,
    private version: string,
    private base: string,
  ) {}

  private async req(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
    extra: Record<string, string> = {},
  ): Promise<Json> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Reap-Version": this.version,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok)
      throw new Error(
        `Reap ${method} ${path} failed (${res.status}): ${json.message ?? json.error?.message ?? json.code ?? "unknown error"}`,
      );
    return json;
  }

  async createEnrollment({
    userId,
    name,
    email,
    returnUrl,
    idempotencyKey,
  }: Parameters<ReapClient["createEnrollment"]>[0]) {
    const r = await this.req(
      "POST",
      "/agentic/enrollments",
      {
        source: "EXTERNAL",
        owner: { type: "CLIENT_REFERENCE", id: userId, name, email },
        presentation: { type: "REDIRECT", returnUrl },
      },
      idempotencyKey,
    );
    return {
      enrollmentId: r.id as string,
      active: r.status === "ACTIVE",
      approvalUrl: (r.nextAction?.url as string) ?? null,
    };
  }

  async getEnrollment(id: string) {
    const r = await this.req(
      "GET",
      `/agentic/enrollments/${encodeURIComponent(id)}`,
    );
    return {
      active: r.status === "ACTIVE",
      failed: ["FAILED", "EXPIRED", "REVOKED"].includes(r.status),
    };
  }

  // Resolves the catalogue item to a purchasable variant via Reap product search.
  // Uses product.variantId when pinned; otherwise the best available match's preview variant.
  private async variantFor(product: Product): Promise<string> {
    if (product.variantId) return product.variantId;
    const r = await this.req("POST", "/agentic/products/search", {
      query: `${product.merchant} ${product.name}`,
      context: { country: "SG", currency: product.currency },
      filters: { availability: "AVAILABLE_ONLY" },
      pagination: { limit: 10 },
    });
    const hit = (r.products as Json[] | undefined)?.find(
      (p) =>
        p.available !== false &&
        String(p.merchant?.name ?? "")
          .toLowerCase()
          .includes(product.merchant.toLowerCase()) &&
        p.previewVariant?.available !== false,
    );
    if (!hit?.previewVariant?.id)
      throw new Error(`No purchasable Reap variant found for ${product.name}`);
    return hit.previewVariant.id as string;
  }

  async quote({
    product,
    email,
    idempotencyKey,
  }: Parameters<ReapClient["quote"]>[0]) {
    const variantId = await this.variantFor(product);
    const r = await this.req(
      "POST",
      "/agentic/quotes",
      {
        items: [{ variantId, quantity: 1 }],
        email,
        shippingAddress: DEMO_SHIPPING_ADDRESS,
      },
      idempotencyKey,
    );
    const total = r.amountBreakdown?.finalAmount;
    return {
      quoteId: r.id as string,
      amountCents: toCents(total),
      currency:
        (typeof total === "object" && total?.currency) || product.currency,
    };
  }

  private map(r: Json): CheckoutResult {
    const url = (r.nextAction?.url as string) ?? null;
    const base = { providerRef: r.id as string, approvalUrl: url };
    switch (r.status) {
      case "COMPLETED":
        return {
          ...base,
          status: "completed",
          amountCents: r.finalAmount ? toCents(r.finalAmount) : undefined,
        };
      case "PROCESSING":
        return { ...base, status: "checkout_opened" };
      case "REQUIRES_ACTION":
        return { ...base, status: "requires_approval" };
      default:
        return {
          ...base,
          status: "failed",
          reason: `Reap checkout ${r.status}`,
        };
    }
  }

  async checkout({
    quote,
    enrollmentId,
    returnUrl,
    idempotencyKey,
  }: Parameters<ReapClient["checkout"]>[0]) {
    const sim: Record<string, string> =
      process.env.REAP_SIMULATE_COMPLETE === "true"
        ? { "X-Simulate-Checkout": "COMPLETED" }
        : {};
    const r = await this.req(
      "POST",
      "/agentic/checkouts",
      {
        quoteId: quote.quoteId,
        enrollmentId,
        presentation: { type: "REDIRECT", returnUrl },
      },
      idempotencyKey,
      sim,
    );
    return this.map(r);
  }

  async getCheckout(id: string) {
    return this.map(
      await this.req("GET", `/agentic/checkouts/${encodeURIComponent(id)}`),
    );
  }
}

export function getReap(): ReapClient {
  const key = process.env.REAP_API_KEY;
  if (!key) return new SandboxReap();
  // Latest per https://docs.reap.global/api-reference/overview; override with REAP_VERSION.
  const version = process.env.REAP_VERSION || "2025-02-14";
  return new LiveReap(
    key,
    version,
    process.env.REAP_BASE_URL || "https://sg.sandbox.api.reap.global",
  );
}
