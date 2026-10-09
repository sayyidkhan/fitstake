import OpenAI from "openai";
import { CATALOGUE, type Product } from "./merchants.js";

export type Recommendation = { lowest: Product; best: Product; reasoning: string; source: "openai" | "fallback" };

const lowest = CATALOGUE.find((p) => p.tier === "lowest")!;
const best = CATALOGUE.find((p) => p.tier === "best")!;

// Picks from the supported catalogue only; the model never invents products.
export async function recommend(preferences: string): Promise<Recommendation> {
  const fallback: Recommendation = {
    lowest,
    best,
    reasoning: "Default picks from the supported merchant list.",
    source: "fallback",
  };
  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const openai = new OpenAI();
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Pick one "lowest" and one "best" reward for a friendly fitness challenge from the catalogue. ' +
            'Only use catalogue ids. Reply JSON: {"lowestId": string, "bestId": string, "reasoning": string (max 2 sentences)}.',
        },
        {
          role: "user",
          content: `Catalogue: ${JSON.stringify(CATALOGUE)}\nOpted-in preferences: ${preferences.slice(0, 500) || "none"}`,
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    const l = CATALOGUE.find((p) => p.id === parsed.lowestId && p.tier === "lowest");
    const b = CATALOGUE.find((p) => p.id === parsed.bestId && p.tier === "best");
    if (!l || !b) return fallback;
    return { lowest: l, best: b, reasoning: String(parsed.reasoning ?? "").slice(0, 300), source: "openai" };
  } catch {
    return fallback;
  }
}
