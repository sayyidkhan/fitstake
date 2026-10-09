import OpenAI from "openai";
import { getCatalogue, type Product } from "./merchants.js";
import { HttpError } from "./service.js";

export type Recommendation = {
  lowest: Product;
  best: Product;
  // Alternatives within the cap: cheaper items for the little treat, pricier items for the bigger win.
  options: { lowest: Product[]; best: Product[] };
  budgetCents: number;
  reasoning: string;
  source: "openai" | "fallback";
};

const fmt = (cents: number) => `S$${(cents / 100).toFixed(2)}`;
const asTier = (p: Product, tier: "lowest" | "best"): Product => ({ ...p, tier });

// Everything the player could afford is a candidate. The cap sets the range the AI can choose from:
// a low cap leaves a few cheap items; a high cap opens up more items and premium ones.
export function candidatesFor(budgetCents: number) {
  const all = [...getCatalogue()].sort((a, b) => a.priceCents - b.priceCents);
  const pool = all.filter((p) => p.priceCents <= budgetCents);
  if (pool.length < 2) {
    const needed = all[1]?.priceCents ?? all[0]?.priceCents ?? 0;
    throw new HttpError(400, `Your cap is too low to choose two rewards. Raise it to at least ${fmt(needed)}.`);
  }
  const half = Math.floor(pool.length / 2);
  return {
    pool,
    lowOptions: pool.slice(0, half).slice(-6).map((p) => asTier(p, "lowest")),
    bestOptions: pool.slice(half).slice(-6).map((p) => asTier(p, "best")),
  };
}

// Picks from the supported catalogue only; the model never invents products.
export async function recommend(preferences: string, budgetCents: number): Promise<Recommendation> {
  const { lowOptions, bestOptions } = candidatesFor(budgetCents);
  const options = { lowest: lowOptions, best: bestOptions };
  const fallback: Recommendation = {
    lowest: lowOptions[0]!,
    best: bestOptions[bestOptions.length - 1]!,
    options,
    budgetCents,
    reasoning: `Cheapest and most premium picks within your ${fmt(budgetCents)} cap.`,
    source: "fallback",
  };
  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const openai = new OpenAI();
    const slim = (list: Product[]) =>
      list.map((p) => ({ id: p.id, merchant: p.merchant, name: p.name, category: p.category, price: fmt(p.priceCents) }));
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Pick one "lowest" (a small treat) and one "best" (the bigger win) reward for a friendly fitness challenge. ' +
            "Choose lowestId only from lowOptions and bestId only from bestOptions; never invent ids. " +
            "Prefer the most premium best reward that fits the person's interests. " +
            'Reply JSON: {"lowestId": string, "bestId": string, "reasoning": string (max 2 sentences)}.',
        },
        {
          role: "user",
          content: `Spending cap: ${fmt(budgetCents)}\nlowOptions: ${JSON.stringify(slim(lowOptions))}\nbestOptions: ${JSON.stringify(slim(bestOptions))}\nOpted-in preferences: ${preferences.slice(0, 500) || "none"}`,
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    const l = lowOptions.find((p) => p.id === parsed.lowestId);
    const b = bestOptions.find((p) => p.id === parsed.bestId);
    if (!l || !b || l.priceCents >= b.priceCents) return fallback;
    return { lowest: l, best: b, options, budgetCents, reasoning: String(parsed.reasoning ?? "").slice(0, 300), source: "openai" };
  } catch {
    return fallback;
  }
}
