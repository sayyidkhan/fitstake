// Price band shown next to rewards, from budget-friendly ($) to premium ($$$$).
export type PriceBand = "$" | "$$" | "$$$" | "$$$$";

export const priceBand = (cents: number): PriceBand =>
  cents < 1000 ? "$" : cents < 3000 ? "$$" : cents < 10000 ? "$$$" : "$$$$";
