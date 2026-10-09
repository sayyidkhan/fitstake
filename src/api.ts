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

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  // Same-origin requests carry the HttpOnly session cookie automatically.
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      json.detail
        ? `${json.error}: ${json.detail}`
        : typeof json.error === "string"
          ? json.error
          : (json.error?.issues?.[0]?.message ?? "Request failed"),
      res.status,
    );
  return json as T;
}

export type AuthUser = { id: string; name: string; email: string };

export type LobbyEntry = {
  id: string;
  name: string;
  activity: string;
  durationDays: number;
  host: string;
  players: number;
  maxPlayers: number;
};

export type MyChallenge = {
  id: string;
  name: string;
  status: "draft" | "active" | "settled" | "cancelled";
  activity: string;
  durationDays: number;
  inviteCode: string;
  players: number;
};

export const api = {
  // Accounts
  requestCode: (email: string) =>
    call<{ ok: true; devCode?: string }>("/auth/request-code", { email }),
  verify: (p: { email: string; code: string; name?: string; acceptedTerms?: boolean }) =>
    call<{ user: AuthUser }>("/auth/verify", p),
  me: () => call<{ user: AuthUser }>("/auth/me"),
  logout: () => call<{ ok: true }>("/auth/logout", {}),
  logoutAll: () => call<{ ok: true }>("/auth/logout-all", {}),
  mine: () => call<MyChallenge[]>("/challenges/mine"),

  // Challenges (the server knows who you are from your session)
  lobby: (activity?: string) =>
    call<LobbyEntry[]>(`/lobby${activity ? `?activity=${encodeURIComponent(activity)}` : ""}`),
  joinLobby: (id: string) =>
    call<{ challengeId: string; userId: string }>(`/lobby/${id}/join`, {}),
  config: () =>
    call<{ payments: "simulated" | "reap_sandbox" | "unavailable" }>("/config"),
  create: (name: string, durationDays: number, activity: string, isPublic: boolean) =>
    call<{ challengeId: string; userId: string; inviteCode: string }>(
      "/challenges",
      { name, durationDays, activity, isPublic },
    ),
  join: (inviteCode: string) =>
    call<{ challengeId: string; userId: string }>("/join", { inviteCode }),
  cancel: (id: string) => call<State>(`/challenges/${id}/cancel`, {}),
  state: (id: string) => call<State>(`/challenges/${id}`),
  merchants: () => call<Product[]>("/merchants"),
  recommend: (id: string, preferences: string, budgetCents: number) =>
    call<Recommendation>(`/challenges/${id}/recommend`, { preferences, budgetCents }),
  lock: (id: string, lowestId: string, bestId: string, budgetCents: number) =>
    call<State>(`/challenges/${id}/rewards`, { lowestId, bestId, budgetCents }),
  updateCeiling: (id: string, spendingCeilingCents: number) =>
    call<State>(`/challenges/${id}/ceiling`, { spendingCeilingCents }),
  authorize: (id: string, spendingCeilingCents: number) =>
    call<{ approvalUrl: string | null; state: State }>(
      `/challenges/${id}/authorize`,
      { spendingCeilingCents, returnUrl: window.location.origin },
    ),
  enrollmentStatus: (id: string) =>
    call<State>(`/challenges/${id}/enrollment-status`, {}),
  refreshTransactions: (id: string) =>
    call<State>(`/challenges/${id}/refresh-transactions`, {}),
  simulate: (id: string) =>
    call<State>(`/challenges/${id}/simulate-activity`, {}),
  settle: (id: string) => call<State>(`/challenges/${id}/settle`, {}),
};

export const money = (cents: number) => `S$${(cents / 100).toFixed(2)}`;
