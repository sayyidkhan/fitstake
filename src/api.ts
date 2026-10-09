export type Reward = { id: string; userId: string; tier: "lowest" | "best"; merchant: string; productName: string; priceCents: number };
export type State = {
  challenge: { id: string; name: string; inviteCode: string; status: "draft" | "active" | "settled"; winnerUserId: string | null; loserUserId: string | null };
  participants: { user: { id: string; name: string; email: string }; rewards: Reward[]; authorised: boolean }[];
  leaderboard: { userId: string; points: number; adherentDays: number; totalSteps: number }[];
  transactions: { id: string; payerUserId: string; recipientUserId: string; status: string; amountCents: number | null; checkoutUrl: string | null; failureReason: string | null }[];
};
export type Product = { id: string; merchant: string; name: string; category: string; tier: "lowest" | "best"; priceCents: number };
export type Recommendation = { lowest: Product; best: Product; reasoning: string; source: string };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

export const api = {
  create: (name: string, creator: { name: string; email: string }) =>
    call<{ challengeId: string; userId: string; inviteCode: string }>("/challenges", { name, creator }),
  join: (inviteCode: string, p: { name: string; email: string }) =>
    call<{ challengeId: string; userId: string }>("/join", { inviteCode, ...p }),
  state: (id: string) => call<State>(`/challenges/${id}`),
  merchants: () => call<Product[]>("/merchants"),
  recommend: (id: string, preferences: string) => call<Recommendation>(`/challenges/${id}/recommend`, { preferences }),
  lock: (id: string, userId: string, lowestId: string, bestId: string) => call<State>(`/challenges/${id}/rewards`, { userId, lowestId, bestId }),
  authorize: (id: string, userId: string, spendingCeilingCents: number) => call<State>(`/challenges/${id}/authorize`, { userId, spendingCeilingCents }),
  simulate: (id: string) => call<State>(`/challenges/${id}/simulate-activity`, {}),
  settle: (id: string) => call<State>(`/challenges/${id}/settle`, {}),
};

export const money = (cents: number) => `S$${(cents / 100).toFixed(2)}`;
