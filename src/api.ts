export type Reward = {
  id: string;
  userId: string;
  tier: "lowest" | "best";
  productId?: string;
  merchant: string;
  productName: string;
  priceCents: number;
};
export type State = {
  challenge: {
    id: string;
    name: string;
    inviteCode: string;
    durationDays: number;
    activity: string;
    isPublic: boolean;
    status: "draft" | "active" | "settled" | "cancelled";
    winnerUserId: string | null;
    loserUserId: string | null;
  };
  hostUserId?: string;
  participants: {
    user: { id: string; name: string };
    rewards: Reward[];
    authorised: boolean;
    enrolmentPending: boolean;
    ceilingCents?: number | null;
    requiredCeilingCents?: number | null;
  }[];
  leaderboard: {
    userId: string;
    points: number;
    adherentDays: number;
    totalSteps: number;
  }[];
  transactions: {
    id: string;
    payerUserId: string;
    recipientUserId: string;
    status: string;
    amountCents: number | null;
    checkoutUrl: string | null;
    failureReason: string | null;
  }[];
};
export type Product = {
  id: string;
  merchant: string;
  name: string;
  category: string;
  tier: "lowest" | "best";
  priceCents: number;
  imageUrl?: string;
  demoOnly?: boolean;
};
export type Recommendation = {
  lowest: Product;
  best: Product;
  options: { lowest: Product[]; best: Product[] };
  budgetCents: number;
  reasoning: string;
  source: string;
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      json.detail
        ? `${json.error}: ${json.detail}`
        : (json.error ?? "Request failed"),
    );
  return json as T;
}

export type LobbyEntry = {
  id: string;
  name: string;
  activity: string;
  durationDays: number;
  host: string;
  players: number;
  maxPlayers: number;
};

export const api = {
  cancel: (id: string, userId: string) =>
    call<State>(`/challenges/${id}/cancel`, { userId }),
  lobby: (activity?: string) =>
    call<LobbyEntry[]>(`/lobby${activity ? `?activity=${encodeURIComponent(activity)}` : ""}`),
  joinLobby: (id: string, p: { name: string; email: string }) =>
    call<{ challengeId: string; userId: string }>(`/lobby/${id}/join`, { ...p, acceptedTerms: true }),
  config: () =>
    call<{ payments: "simulated" | "reap_sandbox" | "unavailable" }>("/config"),
  create: (
    name: string,
    creator: { name: string; email: string },
    durationDays: number,
    activity: string,
    isPublic: boolean,
  ) =>
    call<{ challengeId: string; userId: string; inviteCode: string }>(
      "/challenges",
      { name, creator, durationDays, activity, isPublic, acceptedTerms: true },
    ),
  join: (inviteCode: string, p: { name: string; email: string }) =>
    call<{ challengeId: string; userId: string }>("/join", {
      inviteCode,
      ...p,
      acceptedTerms: true,
    }),
  state: (id: string) => call<State>(`/challenges/${id}`),
  merchants: () => call<Product[]>("/merchants"),
  recommend: (id: string, preferences: string, budgetCents: number) =>
    call<Recommendation>(`/challenges/${id}/recommend`, { preferences, budgetCents }),
  lock: (
    id: string,
    userId: string,
    lowestId: string,
    bestId: string,
    budgetCents: number,
  ) =>
    call<State>(`/challenges/${id}/rewards`, { userId, lowestId, bestId, budgetCents }),
  updateCeiling: (id: string, userId: string, spendingCeilingCents: number) =>
    call<State>(`/challenges/${id}/ceiling`, { userId, spendingCeilingCents }),
  authorize: (id: string, userId: string, spendingCeilingCents: number) =>
    call<{ approvalUrl: string | null; state: State }>(
      `/challenges/${id}/authorize`,
      { userId, spendingCeilingCents, returnUrl: window.location.origin },
    ),
  enrollmentStatus: (id: string, userId: string) =>
    call<State>(`/challenges/${id}/enrollment-status`, { userId }),
  refreshTransactions: (id: string) =>
    call<State>(`/challenges/${id}/refresh-transactions`, {}),
  simulate: (id: string) =>
    call<State>(`/challenges/${id}/simulate-activity`, {}),
  settle: (id: string) => call<State>(`/challenges/${id}/settle`, {}),
};

export const money = (cents: number) => `S$${(cents / 100).toFixed(2)}`;
