import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, money, type AuthUser, type MyChallenge, type LobbyEntry, type Product, type Recommendation, type State } from "./api";
import { priceBand } from "../shared/pricing";
import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  DEFAULT_ACTIVITY,
  getActivity,
} from "../shared/activities";
import { LEGAL, LegalPage, type LegalPageId } from "./legal";

type Session = { challengeId: string; userId: string };
// Only the id of the challenge you last opened is remembered in the browser. Who you are is the HttpOnly session cookie.
const KEY = "fitstake.challenge";
const loadChallengeId = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const RETURN_KEY = "fitstake.returnTo";

type AuthState = { me: AuthUser | null | undefined; setMe: (u: AuthUser | null) => void; logout: (everywhere?: boolean) => Promise<void> };
const AuthCtx = createContext<AuthState>({ me: undefined, setMe: () => {}, logout: async () => {} });
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    api
      .me()
      .then((r) => setMe(r.user))
      .catch(() => setMe(null));
  }, []);
  const logout = async (everywhere = false) => {
    await (everywhere ? api.logoutAll() : api.logout()).catch(() => {});
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setMe(null);
    window.location.hash = "";
  };
  return <AuthCtx.Provider value={{ me, setMe, logout }}>{children}</AuthCtx.Provider>;
}


// The six-step product workflow, shown on the landing page and tracked on the dashboard.
// Day label for each workflow step. Pass the challenge length for exact days; omit it for generic labels.
function stepDay(i: number, days?: number): string {
  if (i === 0) return "DAY 1";
  if (i === 3) {
    if (days === undefined) return "THE DAYS IN BETWEEN";
    if (days <= 1) return "DAY 1";
    if (days === 2) return "DAYS 1–2";
    return days === 3 ? "DAY 2" : `DAYS 2–${days - 1}`;
  }
  if (i === 4) return days === undefined ? "FINAL DAY" : `DAY ${days}`;
  return "";
}

const WORKFLOW = [
  { title: "Create a challenge", short: "Create", copy: "Pick an activity and how many days, invite friends, and agree on scoring rules" },
  { title: "AI recommends rewards", short: "Rewards", copy: "Each friend locks in their lowest reward and best reward" },
  { title: "Pre-authorise payment", short: "Authorise", icon: "shield", copy: "Each friend registers a card and approves spending rules through Reap" },
  { title: "Compete and improve", short: "Compete", copy: "Track healthy progress, complete personal goals and climb the leaderboard" },
  { title: "AI determines the results", short: "Results", copy: "The winner unlocks their best reward; the loser unlocks their lowest reward" },
  { title: "Agentic payment", short: "Payment", icon: "card", copy: "AI quotes and initiates both reward purchases using Reap" },
] as const;

function Icon({ name }: { name: "shield" | "card" }) {
  return (
    <svg className="wf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "shield" ? (
        <>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </>
      ) : (
        <>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <path d="M3 10h18M16 14h2" />
        </>
      )}
    </svg>
  );
}

function Workflow({ days }: { days?: number }) {
  return (
    <section className="workflow-section" aria-labelledby="workflow-title">
      <h2 id="workflow-title">The end-to-end workflow</h2>
      <ol className="workflow">
        {WORKFLOW.map((step, i) => (
          <li key={step.title}>
            {stepDay(i, days) && (
              <span className="wf-day">{stepDay(i, days)}</span>
            )}
            {"icon" in step && <Icon name={step.icon} />}
            <h3>
              {i + 1}. {step.title}
            </h3>
            <p>{step.copy}</p>
            {i < WORKFLOW.length - 1 && (
              <span className="wf-arrow" aria-hidden="true">
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

const DETAILS = [
  {
    you: "Pick the activity (running, swimming, badminton and more) and how many days, invite one friend with a code, and both of you agree to the scoring rules.",
    app: "Sets the challenge window you chose (from a single day up to a year) and shows the same scoring rules to both players. The rules are fixed from the start.",
    note: "Scoring rewards consistency: active minutes (capped at 90 a day) plus a bonus for every day with 30+ minutes. There are no weight-loss targets.",
  },
  {
    you: "Optionally say what you like, then lock in one lowest-value reward and one best-value reward.",
    app: "AI suggests from the supported merchant catalogue only (currently Six Eleven and Kydra) and explains its picks. It never invents products.",
    note: "Rewards are locked once chosen, so nobody can change them after seeing the leaderboard.",
  },
  {
    you: "Enrol a card on Reap’s secure hosted page and set a spending ceiling.",
    app: "Stores your name, email, enrolment reference and spending ceiling. Card details stay with Reap.",
    note: "No money is held in escrow. Reap’s automatic payment mandates aren’t available yet, so you approve each final-day charge yourself.",
  },
  {
    you: "Stay active, log or connect your activity, and follow the leaderboard.",
    app: "Scores each day with the agreed rules and keeps the leaderboard up to date. In this demo, activity is simulated.",
    note: "Healthy progress wins: daily minutes are capped so extreme effort doesn’t help.",
  },
  {
    you: "Nothing. Results appear when the challenge closes.",
    app: "Applies the locked rules to name a winner and a loser. Ties go to more active days, then more steps, then a fixed tie-break. The winner unlocks their best reward; the loser unlocks their lowest.",
    note: "The result is deterministic and reproducible. AI explains it but never decides it.",
  },
  {
    you: "Approve your charge on Reap’s hosted page.",
    app: "Checks availability, gets a fresh quote, confirms it is within your ceiling, then opens a separate checkout for each purchase. The loser buys the winner’s best reward; the winner buys the loser’s lowest.",
    note: "Each purchase is its own transaction and can’t be duplicated. Sandbox only: no real money moves and nothing ships.",
  },
] as const;

function HowItWorks({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="hiw-hero">
        <p className="eyebrow">HOW IT WORKS</p>
        <h1>Day 1: Commit. Final day: Settle.</h1>
        <p className="hero-copy">
          Two friends compete for as many days as they choose (from a single day) on healthy, consistency-first goals.
          The loser buys the winner’s best reward; the winner buys the loser’s
          lowest. Everyone gets something, and better progress unlocks the
          better prize.
        </p>
        <button className={btn} onClick={onStart}>
          Start a challenge <span>→</span>
        </button>
      </section>
      <Workflow />
      <section className="hiw-steps" aria-labelledby="hiw-steps-title">
        <h2 id="hiw-steps-title">Step by step</h2>
        {WORKFLOW.map((step, i) => (
          <article key={step.title} className="hiw-step">
            <div className="hiw-badge">{i + 1}</div>
            <div>
              {stepDay(i, undefined) && (
                <span className="hiw-day">{stepDay(i, undefined)}</span>
              )}
              <h3>{step.title}</h3>
              <dl>
                <dt>What you do</dt>
                <dd>{DETAILS[i]!.you}</dd>
                <dt>What FitStake does</dt>
                <dd>{DETAILS[i]!.app}</dd>
                <dt>Good to know</dt>
                <dd>{DETAILS[i]!.note}</dd>
              </dl>
            </div>
          </article>
        ))}
      </section>
      <section className="hiw-faq" aria-labelledby="hiw-faq-title">
        <h2 id="hiw-faq-title">Questions, answered</h2>
        <details>
          <summary>Is my money held anywhere?</summary>
          <p>No. FitStake doesn’t hold funds or run an escrow. Money only moves when you approve a purchase on the final day, and in this demo nothing real is charged.</p>
        </details>
        <details>
          <summary>Where are my card details stored?</summary>
          <p>With the payment provider, Reap. FitStake keeps your name, email, enrolment reference and the spending ceiling you set. See the <a href="#privacy">Privacy Policy</a> and <a href="#data-policy">Data Policy</a>.</p>
        </details>
        <details>
          <summary>What if the quote is higher than my ceiling?</summary>
          <p>The purchase is stopped and marked failed with the reason. Nothing is charged, and you can retry once it is resolved.</p>
        </details>
        <details>
          <summary>Who decides the winner?</summary>
          <p>The scoring rules everyone agreed on Day 1. They are deterministic, so the same activity always gives the same result.</p>
        </details>
        <details>
          <summary>Is this real?</summary>
          <p>It is a proof of concept. Fitness data is simulated and purchases run in Reap’s sandbox, so no money moves and nothing ships.</p>
        </details>
      </section>
    </>
  );
}

type Page = "home" | "how" | "lobby" | "login" | LegalPageId;
const PAGE_BY_HASH: Record<string, Page> = {
  "#how-it-works": "how",
  "#challenges": "lobby",
  "#login": "login",
  "#privacy": "privacy",
  "#terms": "terms",
  "#data-policy": "data-policy",
};
const pageFromHash = (): Page => PAGE_BY_HASH[window.location.hash] ?? "home";

const card = "panel rounded-2xl p-5";
const btn = "action px-4 py-2 font-semibold disabled:opacity-40";
const input = "field w-full px-3 py-2";

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { me: account, setMe } = useAuth();
  const [challengeId, setChallengeId] = useState<string | null>(loadChallengeId);
  const session: Session | null = account && challengeId ? { challengeId, userId: account.id } : null;
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMe(null);
        setError("Your session has ended. Please log in again.");
      } else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, [setMe]);

  const start = (s: { challengeId: string }) => {
    try {
      localStorage.setItem(KEY, s.challengeId);
    } catch {
      /* ignore */
    }
    setChallengeId(s.challengeId);
  };
  const leave = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setChallengeId(null);
    setState(null);
    setJoinedName(null);
  }, []);
  // Logged out (or logged in as someone else): forget the open challenge.
  useEffect(() => {
    if (account === null) leave();
  }, [account, leave]);

  useEffect(() => {
    if (!session) return;
    api
      .state(session.challengeId)
      .then(setState)
      .catch((e) => {
        // Not a member of this challenge any more (or it no longer exists): go back to the start.
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) leave();
        else setError(e instanceof Error ? e.message : "Could not load your challenge");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.challengeId, session?.userId]);

  const waiting = state?.challenge.status === "draft";
  useEffect(() => {
    if (!session || !waiting) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible")
        api.state(session.challengeId).then(setState).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [session, waiting]);

  if (page === "privacy" || page === "terms" || page === "data-policy")
    return (
      <Shell page={page}>
        <LegalPage id={page} />
      </Shell>
    );
  const finishLogin = (u: AuthUser) => {
    setMe(u);
    let back = "";
    try {
      back = sessionStorage.getItem(RETURN_KEY) ?? "";
      sessionStorage.removeItem(RETURN_KEY);
    } catch {
      /* ignore */
    }
    window.location.hash = back;
  };
  if (page === "login")
    return (
      <Shell page={page}>
        <div className="auth-page">
          <AuthCard onAuthed={finishLogin} />
        </div>
      </Shell>
    );
  if (page === "lobby")
    return (
      <Shell page={page}>
        <Lobby
          me={account}
          onJoined={(r, name) => {
            setJoinedName(name);
            start(r);
            window.location.hash = "";
          }}
        />
      </Shell>
    );
  if (page === "how")
    return (
      <Shell page={page}>
        <HowItWorks
          onStart={() => {
            window.location.hash = "";
          }}
        />
      </Shell>
    );
  if (account === undefined)
    return (
      <Shell page={page}>
        <p role="status" className="text-slate-400">Loading…</p>
      </Shell>
    );
  if (!session)
    return (
      <Shell page={page}>
        <Start me={account} onAuthed={finishLogin} onStart={start} run={run} busy={busy} error={error} />
      </Shell>
    );
  if (!state)
    return (
      <Shell page={page}>
        <div className="panel p-5">
          <p role="status">{error || "Loading your challenge…"}</p>
          <button
            className={btn + " mt-4"}
            onClick={() => {
              leave();
            }}
          >
            Back to start
          </button>
        </div>
      </Shell>
    );

  if (state.challenge.status === "cancelled")
    return (
      <Shell page={page}>
        <div className="panel p-5 cancelled-panel" role="status">
          <p className="eyebrow">CHALLENGE CANCELLED</p>
          <h1 className="dashboard-title">{state.challenge.name}</h1>
          <p className="text-sm text-slate-400">
            This challenge was cancelled before it started, so nothing was
            charged. You can start a new one or join another from the lobby.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={btn}
              onClick={() => {
                leave();
              }}
            >
              Start a new challenge
            </button>
            <button
              className={btn}
              onClick={() => {
                leave();
                window.location.hash = "#challenges";
              }}
            >
              Browse open challenges
            </button>
          </div>
        </div>
      </Shell>
    );

  const apply = (p: Promise<State>) =>
    run(() => p).then((s) => s && setState(s));
  const { challenge, participants, leaderboard, transactions } = state;
  const me = participants.find((p) => p.user.id === session.userId);
  const nameOf = (id: string | null) =>
    participants.find((p) => p.user.id === id)?.user.name ?? "?";
  const maxPoints = challenge.durationDays * 100; // 90 capped minutes + 10 bonus per day
  // Current workflow step (0-based): 0 create/invite, 1 rewards, 2 authorise, 3 compete, 5 payment.
  const stepIndex: number =
    challenge.status === "settled"
      ? transactions.length > 0 && transactions.every((t) => t.status === "completed")
        ? 6
        : 5
      : challenge.status === "active"
        ? 3
        : participants.length < 2
          ? 0
          : participants.every((p) => p.rewards.length === 2)
            ? 2
            : 1;

  return (
    <Shell page={page}>
      {joinedName && (
        <p role="status" className="success-banner mb-4">
          <span>
            ✓ You’ve joined <b>{joinedName}</b>.{" "}
            {challenge.status === "draft" ? "Next: pick your rewards below, then the challenge starts once everyone has." : "Good luck!"}
          </span>
          <button className="text-link" onClick={() => setJoinedName(null)} aria-label="Dismiss">
            Dismiss
          </button>
        </p>
      )}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">YOUR CHALLENGE HQ</p>
          <h1 className="dashboard-title">{challenge.name}</h1>
          <p className="activity-chip">
            <span aria-hidden="true">{getActivity(challenge.activity).icon}</span>{" "}
            {getActivity(challenge.activity).label}
          </p>
          <p className="text-sm text-slate-400">
            Status: <b className="text-teal-400">{challenge.status}</b> · Invite
            code: <b>{challenge.inviteCode}</b>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            className={btn}
            disabled={busy}
            onClick={() => apply(api.state(challenge.id))}
          >
            Refresh challenge
          </button>
          {challenge.status === "draft" &&
            state.hostUserId === session.userId && (
              <button
                className="text-sm text-red-700 underline"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      participants.length > 1
                        ? "Cancel this challenge? Your friend will be told it was cancelled."
                        : "Cancel this challenge? It will be removed from the lobby.",
                    )
                  )
                    apply(api.cancel(challenge.id));
                }}
              >
                Cancel challenge
              </button>
            )}
          <button
            className="text-sm text-slate-400 underline"
            onClick={() => {
              leave();
            }}
          >
            Back to start
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="error-banner mb-4">
          {error}
        </p>
      )}

      <ol className="journey" aria-label="Challenge workflow">
        {WORKFLOW.map((step, i) => (
          <li
            key={step.title}
            aria-current={i === stepIndex ? "step" : undefined}
            className={i === stepIndex ? "current" : i < stepIndex ? "done" : ""}
          >
            <span>{i < stepIndex ? "✓" : `0${i + 1}`}</span>
            {step.short}
          </li>
        ))}
      </ol>
      <div className="dashboard-stats">
        <div>
          <span>THE COMMITMENT</span>
          <strong>
            {challenge.durationDays} <small>{challenge.durationDays === 1 ? "day" : "days"}</small>
          </strong>
        </div>
        <div>
          <span>THE ACTIVITY</span>
          <strong className="next-step">
            {getActivity(challenge.activity).icon}{" "}
            {getActivity(challenge.activity).label.split(" (")[0]}
          </strong>
        </div>
        <div>
          <span>YOUR TEAM</span>
          <strong>
            {participants.length}
            <small> / 2 friends</small>
          </strong>
        </div>
        <div>
          <span>REWARD CATALOGUE</span>
          <strong>
            S$58<small> · best tier</small>
          </strong>
        </div>
        <div>
          <span>THE NEXT STEP</span>
          <strong className="next-step">
            {stepIndex >= 6
              ? "All done"
              : stepIndex === 0
                ? "Invite your friend"
                : stepIndex === 1
                  ? "Lock in your rewards"
                  : stepIndex === 2
                    ? "Enrol your card"
                    : `${stepIndex + 1}. ${WORKFLOW[stepIndex]!.title}`}
          </strong>
        </div>
      </div>
      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        {participants.map((p) => (
          <div key={p.user.id} className={card}>
            <div className="participant-heading">
              <span className="avatar">
                {p.user.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="eyebrow">
                  {p.user.id === session.userId
                    ? "YOUR COMMITMENT"
                    : "YOUR CHALLENGE PARTNER"}
                </p>
                <h2 className="font-semibold">
                  {p.user.name}
                  {p.user.id === session.userId && " (you)"}
                </h2>
              </div>
            </div>
            <ul className="mt-2 text-sm text-slate-300">
              {p.rewards.length ? (
                p.rewards.map((r) => (
                  <li key={r.id} className="reward-row">
                    <ProductImage
                      id={r.productId}
                      name={r.productName}
                      className="row-img"
                    />
                    <div>
                      <span className="eyebrow">
                        {r.tier === "best" ? "BEST REWARD" : "LITTLE TREAT"} ·{" "}
                        {r.merchant}
                      </span>
                      <p>{r.productName}</p>
                    </div>
                    <strong>{money(r.priceCents)}</strong>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">Rewards not locked</li>
              )}
            </ul>
            <p className="mt-2 text-sm">
              {p.authorised
                ? "✅ Sandbox enrolment ready"
                : p.enrolmentPending
                  ? "⏳ Awaiting card enrolment"
                  : "⏳ No card yet"}
            </p>
          </div>
        ))}
        {participants.length < 2 && <InviteCard code={challenge.inviteCode} isPublic={challenge.isPublic} />}
      </section>

      {challenge.status === "draft" && me && (
        <Setup
          waitingForFriend={participants.length < 2}
          me={me}
          challengeId={challenge.id}
          userId={session.userId}
          apply={apply}
          busy={busy}
        />
      )}

      {challenge.status !== "draft" && (
        <section className={card + " mb-6"}>
          <p className="eyebrow">{stepDay(3, challenge.durationDays)}</p>
          <h2 className="mb-3 font-semibold">4. Compete and improve</h2>
          {leaderboard[0] && leaderboard[0].points > 0 ? (
            <ol className="space-y-1">
              {leaderboard.map((s, i) => (
                <li key={s.userId} className="ranking-row">
                  <div>
                    <span className="rank">0{i + 1}</span>
                    <strong>{nameOf(s.userId)}</strong>
                    <span className="points">
                      {s.points.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="score-track">
                    <span
                      style={{
                        width: `${Math.min(100, (s.points / maxPoints) * 100)}%`,
                      }}
                    />
                  </div>
                  <p>
                    {s.adherentDays} active days ·{" "}
                    {getActivity(challenge.activity).stepsPerMinute > 0 &&
                      `${s.totalSteps.toLocaleString()} steps · `}
                    {Math.round((s.points / maxPoints) * 100)}% of maximum score
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-slate-400">No activity yet.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Rules: up to 90 active min/day count, +10 for each day with 30+
            minutes. Ties: more active days, then more steps, then a fixed hash.
          </p>
          {challenge.status === "active" && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className={btn}
                disabled={busy}
                onClick={() => apply(api.simulate(challenge.id))}
              >
                Simulate {challenge.durationDays} {challenge.durationDays === 1 ? "day" : "days"} of activity
              </button>
              <button
                className={btn}
                disabled={busy || !leaderboard[0]?.points}
                onClick={() => apply(api.settle(challenge.id))}
              >
                Simulate Day {challenge.durationDays} — settle
              </button>
            </div>
          )}
        </section>
      )}

      {challenge.status === "settled" && (
        <section className={card}>
          <p className="eyebrow">DAY {challenge.durationDays}</p>
          <h2 className="font-semibold">
            5. AI determines the results: {nameOf(challenge.winnerUserId)} wins
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Fixed scoring rules pick the winner; AI only explains the result.
          </p>
          <h2 className="mt-5 font-semibold">6. Agentic payment</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {transactions.map((t) => (
              <li key={t.id}>
                {nameOf(t.payerUserId)} buys for {nameOf(t.recipientUserId)}:{" "}
                {t.amountCents ? money(t.amountCents) : "—"} ·{" "}
                <b
                  className={
                    t.status === "completed"
                      ? "text-teal-400"
                      : "text-amber-400"
                  }
                >
                  {t.status.replace("_", " ")}
                </b>
                {t.status === "requires_approval" &&
                  t.checkoutUrl &&
                  t.payerUserId === session.userId && (
                    <a
                      className="ml-2 text-teal-400 underline"
                      href={t.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Approve payment
                    </a>
                  )}
                {t.failureReason && (
                  <span className="text-red-300"> ({t.failureReason})</span>
                )}
              </li>
            ))}
          </ul>
          {transactions.some(
            (t) =>
              t.status === "requires_approval" ||
              t.status === "checkout_opened",
          ) && (
            <button
              className={btn + " mt-3 mr-3"}
              disabled={busy}
              onClick={() => apply(api.refreshTransactions(challenge.id))}
            >
              Refresh payment status
            </button>
          )}
          {transactions.some((t) => t.status === "failed") && (
            <button
              className={btn + " mt-3"}
              disabled={busy}
              onClick={() => apply(api.settle(challenge.id))}
            >
              Retry failed checkouts
            </button>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Sandbox only: no money moves and nothing ships.
          </p>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children, page }: { children: React.ReactNode; page: Page }) {
  const { me, logout } = useAuth();
  const [mode, setMode] = useState("Checking…");
  useEffect(() => {
    api
      .config()
      .then((c) =>
        setMode(
          c.payments === "reap_sandbox"
            ? "Reap sandbox"
            : c.payments === "simulated"
              ? "Local simulator"
              : "Payment setup required",
        ),
      )
      .catch(() => setMode("Connection unavailable"));
  }, []);
  return (
    <div className="app-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="FitStake home">
          FitStake<span className="brand-dot">.</span>
        </a>
        <nav className="topnav" aria-label="Main">
          <a href="#" aria-current={page === "home" ? "page" : undefined}>
            Home
          </a>
          <a
            href="#challenges"
            aria-current={page === "lobby" ? "page" : undefined}
          >
            Challenges
          </a>
          <a
            href="#how-it-works"
            aria-current={page === "how" ? "page" : undefined}
          >
            How it works
          </a>
        </nav>
        <div className="topbar-right">
        {me ? (
          <details className="account-menu">
            <summary>
              <span className="avatar-sm" aria-hidden="true">{me.name.slice(0, 1).toUpperCase()}</span>
              <span className="account-name">{me.name.split(" ")[0]}</span>
            </summary>
            <div className="account-pop">
              <p>
                <b>{me.name}</b>
                <small>{me.email}</small>
              </p>
              <a href="#">My challenges</a>
              <button onClick={() => logout()}>Log out</button>
              <button onClick={() => logout(true)}>Log out of all devices</button>
            </div>
          </details>
        ) : me === null ? (
          <a className="login-link" href="#login">Log in</a>
        ) : null}
        <span className="sandbox-pill">
          <i /> {mode}
        </span>
        </div>
      </nav>
      <main className="workspace">{children}</main>
      <footer>
        <span>FITSTAKE · MADE FOR YOUR NEXT PERSONAL BEST</span>
        <nav className="footer-legal" aria-label="Legal">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms</a>
          <a href="#data-policy">Data Policy</a>
          <span>
            © {new Date().getFullYear()} {LEGAL.operator}
          </span>
        </nav>
        <span>
          Simulated fitness. Sandbox purchases. No real money or deliveries.
        </span>
      </footer>
    </div>
  );
}

function Start({
  me,
  onAuthed,
  onStart,
  run,
  busy,
  error,
}: {
  me: AuthUser | null;
  onAuthed: (u: AuthUser) => void;
  onStart: (s: { challengeId: string }) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  busy: boolean;
  error: string;
}) {
  const [title, setTitle] = useState("Our personal best");
  const invited = new URLSearchParams(window.location.search).get("join") ?? "";
  const [code, setCode] = useState(invited.toUpperCase().slice(0, 16));
  const [mode, setMode] = useState<"create" | "join">(invited ? "join" : "create");
  const [rules, setRules] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [days, setDays] = useState(30);
  const [activity, setActivity] = useState(DEFAULT_ACTIVITY);
  const [isPublic, setIsPublic] = useState(true);
  const daysOk = Number.isInteger(days) && days >= 1 && days <= 365;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      mode === "create"
        ? api.create(title.trim(), days, activity, isPublic)
        : api.join(code.trim()),
    ).then((r) => r && onStart(r));
  };
  return (
    <>
      <div className="landing-grid">
        <section className="hero">
          <p className="eyebrow">YOUR GOALS. YOUR FRIEND. YOUR REWARDS.</p>
          <h1>
            Good habits.
            <br />
            Friendly rivalry.
            <br />
            <em>Better rewards.</em>
          </h1>
          <p className="hero-copy">
            Turn “we should work out” into a commitment. Challenge a
            friend, build a healthier routine, and make every active day count.
          </p>
          <div className="hero-tags">
            <span>↗ Days of momentum</span>
            <span>◎ 1 friend by your side</span>
            <a className="text-link" href="#challenges">
              Browse open challenges ↗
            </a>
            <a className="text-link" href="#how-it-works">
              See how it works ↗
            </a>
          </div>
          <div className="reward-preview">
            <div className="reward-art" aria-hidden="true">
              <svg viewBox="0 0 180 150">
                <path
                  d="M42 30h96l-5 26 17 69-54 6-7-50-6 50-53-6 17-69z"
                  fill="#273c36"
                />
                <path d="M44 31h92v12H44z" fill="#142c24" />
                <path
                  d="M88 43v38M51 57l-9 60M126 57l13 60"
                  stroke="#70847a"
                  strokeWidth="2"
                />
                <path
                  d="M85 40l-4 26m10-26 6 26"
                  stroke="#e6e4c4"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div>
              <p className="eyebrow">A LITTLE EXTRA MOTIVATION</p>
              <h3>Your next win looks good.</h3>
              <p>KYDRA Axis Linerless Shorts</p>
              <span className="reward-price">
                S$58.00 <small>· Best reward</small>
              </span>
            </div>
          </div>
          <p className="catalog-note">
            Illustrative reward · final availability and price checked at
            checkout
          </p>
        </section>
        <section className="onboarding panel">
          {!me ? (
            <AuthCard onAuthed={onAuthed} />
          ) : (
            <>
          <div className="card-heading">
            <span className="eyebrow">LET’S MAKE IT HAPPEN</span>
            <span className="step-dot">STEP 1 · DAY 1</span>
          </div>
          <h2>
            Your next chapter
            <br />
            starts together.
          </h2>
          <p>Welcome back, {me?.name.split(" ")[0]}. Choose how many days, invite a friend, and agree on the scoring rules.</p>
          <div className="tabs" role="tablist" aria-label="Challenge action">
            <button
              role="tab"
              aria-selected={mode === "create"}
              onClick={() => setMode("create")}
            >
              Start a challenge <span>↗</span>
            </button>
            <button
              role="tab"
              aria-selected={mode === "join"}
              onClick={() => setMode("join")}
            >
              Join a friend <span>↗</span>
            </button>
          </div>
          <form onSubmit={submit} className="start-form">
            {mode === "create" ? (
              <>
                <label>
                  Challenge name
                  <input
                    className={input}
                    required
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Activity
                  <select
                    className={input}
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                  >
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {ACTIVITIES.filter((a) => a.category === cat).map(
                          (a) => (
                            <option key={a.id} value={a.id}>
                              {a.icon} {a.label}
                            </option>
                          ),
                        )}
                      </optgroup>
                    ))}
                  </select>
                  <small className="field-hint">
                    Both players do this activity. Scoring counts active
                    minutes, so any activity is fair.
                  </small>
                </label>
                <label className="agree">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <span>
                    List my challenge in the public lobby so anyone can join.
                    Untick to keep it invite-only.
                  </span>
                </label>
                <label>
                  Challenge length (days)
                  <input
                    className={input}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    step={1}
                    required
                    value={Number.isNaN(days) ? "" : days}
                    onChange={(e) => setDays(e.target.valueAsNumber)}
                  />
                  <small className="field-hint">
                    From 1 to 365 days. Settlement happens on the final day.
                  </small>
                </label>
              </>
            ) : (
              <label>
                Invite code
                <input
                  className={input}
                  placeholder="Enter your friend’s code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </label>
            )}
            <label className="agree">
              <input
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                I agree to the scoring rules: active minutes (capped at 90 a day) plus a bonus for each active day. Ties use active days, then steps.
              </span>
            </label>
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            {!busy && (
              <p className="field-hint" role="status">
                {mode === "create" && !daysOk
                  ? "Choose a length from 1 to 365 days."
                      : mode === "join" && code.trim().length < 4
                        ? "Enter your friend’s invite code."
                        : !agreed
                          ? "Tick the box to agree to the scoring rules."
                          : ""}
              </p>
            )}
            <button
              className={btn + " submit-action"}
              disabled={
                busy ||
                !agreed ||
                (mode === "create"
                  ? !title.trim() || !daysOk
                  : code.trim().length < 4)
              }
            >
              {busy
                ? "Getting things ready…"
                : mode === "create"
                  ? "Create my challenge"
                  : "Join the challenge"}
              <span>→</span>
            </button>
          </form>
          <p className="form-note">
            Two friends. One commitment. Everyone gets a reward.
          </p>
          <button
            className="text-link"
            onClick={() => setRules(!rules)}
            aria-expanded={rules}
          >
            {rules ? "Hide scoring rules" : "How does scoring work?"}{" "}
            <span>↗</span>
          </button>
          {rules && (
            <div className="rules-note">
              Earn one point per active minute, capped at 90 per day, plus 10
              points on days with at least 30 active minutes. Ties use active
              days, steps, then a fixed hash. No weight-loss targets.
            </div>
          )}
            </>
          )}
        </section>
      </div>
      {me && <MyChallenges onOpen={onStart} />}
    </>
  );
}

function Lobby({ me, onJoined }: { me: AuthUser | null | undefined; onJoined: (s: { challengeId: string }, challengeName: string) => void }) {
  const [list, setList] = useState<LobbyEntry[] | null>(null);
  const [activity, setActivity] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .lobby(activity || undefined)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load challenges"));
  }, [activity]);

  useEffect(() => {
    refresh();
    // Full challenges drop off the list, so keep it fresh while the page is open.
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const join = async (c: LobbyEntry) => {
    setError("");
    if (!me) {
      // Joining needs an account: log in, then come back here.
      try {
        sessionStorage.setItem(RETURN_KEY, "#challenges");
      } catch {
        /* ignore */
      }
      window.location.hash = "#login";
      return;
    }
    setJoining(c.id);
    try {
      onJoined(await api.joinLobby(c.id), c.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
      refresh();
    } finally {
      setJoining(null);
    }
  };

  return (
    <section className="lobby">
      <p className="eyebrow">OPEN CHALLENGES</p>
      <h1>Pick a challenge to join</h1>
      <p className="hero-copy">
        Challenges are created by people like you. Choose one that fits your
        sport and schedule. When both seats are taken it disappears from this
        list.
      </p>
      <div className={card + " lobby-who"}>
        <p className="lobby-as">
          {me ? <>Joining as <b>{me.name}</b></> : <>You’ll need a free account to join. <a href="#login" onClick={() => { try { sessionStorage.setItem(RETURN_KEY, "#challenges"); } catch { /* ignore */ } }}>Log in or sign up</a></>}
        </p>
        <label>
          Activity
          <select className={input} value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">All activities</option>
            {ACTIVITY_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {ACTIVITIES.filter((a) => a.category === cat).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="error-banner mt-4">
          {error}
        </p>
      )}
      <div className="lobby-head">
        <span>{list ? `${list.length} open ${list.length === 1 ? "challenge" : "challenges"}` : "Loading…"}</span>
        <button className="text-link" onClick={refresh}>
          Refresh ↻
        </button>
      </div>
      {list && list.length === 0 && (
        <div className={card + " lobby-empty"}>
          <h2 className="font-semibold">No open challenges{activity ? " for this activity" : ""} right now</h2>
          <p className="text-sm text-slate-400">Be the first: create one and others can join whenever they like.</p>
          <a className={btn + " inline-block"} href="#">
            Create a challenge →
          </a>
        </div>
      )}
      <ul className="lobby-list">
        {list?.map((c) => {
          const a = getActivity(c.activity);
          return (
            <li key={c.id} className={card + " lobby-row"}>
              <span className="lobby-icon" aria-hidden="true">
                {a.icon}
              </span>
              <div>
                <h2>{c.name}</h2>
                <p>
                  {a.label} · {c.durationDays} {c.durationDays === 1 ? "day" : "days"} · hosted by {c.host}
                </p>
              </div>
              <span className="lobby-seats">
                {c.players}/{c.maxPlayers} players
              </span>
              <button className={btn} disabled={joining !== null} onClick={() => join(c)}>
                {joining === c.id ? "Joining…" : me ? "Join" : "Log in to join"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Product picture: a real photo when the catalogue has one, otherwise a built-in illustration.
function ProductImage({
  id,
  name,
  imageUrl,
  className = "",
}: {
  id?: string;
  name: string;
  imageUrl?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const key = `${id ?? ""} ${name}`.toLowerCase();
  if (imageUrl && !broken)
    return (
      <img
        className={`product-img ${className}`}
        src={imageUrl}
        alt={name}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  const shorts = key.includes("shorts");
  const drink = key.includes("coconut") || key.includes("water");
  return (
    <span className={`product-img product-art ${className}`} role="img" aria-label={name}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {shorts ? (
          <>
            <path d="M28 24h64l-4 20 13 56-40 5-5-38-5 38-40-5 13-56z" fill="#25324d" />
            <path d="M28 24h64v10H28z" fill="#182238" />
            <path d="M60 34v32M33 46l-7 44M87 46l10 44" stroke="#5b6b8c" strokeWidth="1.6" />
            <path d="M57 32l-3 20m9-20 5 20" stroke="#e8e6d0" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M22 100l16 2M82 102l16-2" stroke="#3a4a6e" strokeWidth="1.6" />
          </>
        ) : drink ? (
          <>
            <path d="M40 22l8-10h24l8 10v8H40z" fill="#c9a77c" />
            <path d="M38 30h44v78a4 4 0 0 1-4 4H42a4 4 0 0 1-4-4z" fill="#6b4630" />
            <path d="M38 30h44v10H38z" fill="#8a5d40" />
            <circle cx="60" cy="68" r="17" fill="#f3e9d6" />
            <path d="M52 62q8-9 16 0M50 70q10 9 20 0" fill="none" stroke="#6b4630" strokeWidth="2" strokeLinecap="round" />
            <rect x="46" y="92" width="28" height="4" rx="2" fill="#f3e9d6" opacity="0.8" />
          </>
        ) : (
          <>
            <rect x="26" y="50" width="68" height="52" rx="6" fill="#7d9a55" />
            <rect x="22" y="38" width="76" height="16" rx="5" fill="#9bb870" />
            <path d="M60 38v64" stroke="#e8f0d2" strokeWidth="6" />
            <path d="M60 38c-12-18-26-8-18 0M60 38c12-18 26-8 18 0" fill="none" stroke="#e8f0d2" strokeWidth="4" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  );
}

// Passwordless sign-in: we email a 6-digit code. New people also give a name and accept the Terms.
function AuthCard({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [terms, setTerms] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.requestCode(email.trim());
      setDevCode(r.devCode ?? null);
      setStep("code");
      setCode("");
      setWait(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.verify({
        email: email.trim(),
        code,
        ...(mode === "signup" ? { name: name.trim(), acceptedTerms: terms } : {}),
      });
      onAuthed(r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify the code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
      <p className="auth-sub">
        {step === "email"
          ? "No password needed. We’ll email you a 6-digit code."
          : <>We sent a code to <b>{email.trim()}</b>. It expires in 10 minutes.</>}
      </p>
      {step === "email" ? (
        <>
          <div className="tabs" role="tablist" aria-label="Log in or sign up">
            <button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Log in</button>
            <button role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")}>Sign up</button>
          </div>
          <form
            className="start-form"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            {mode === "signup" && (
              <label>
                Your name
                <input className={input} value={name} maxLength={60} autoComplete="name" required placeholder="What should we call you?" onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            <label>
              Email address
              <input className={input} type="email" value={email} autoComplete="email" required placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode === "signup" && (
              <label className="agree">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>
                  I agree to the{" "}
                  <a href="#terms" target="_blank" rel="noopener noreferrer">Terms</a> and{" "}
                  <a href="#privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. I consent to{" "}
                  {LEGAL.operator} collecting and using my name and email to run my account and challenges.
                </span>
              </label>
            )}
            {error && <p role="alert" className="error-banner">{error}</p>}
            <button className={btn + " submit-action"} disabled={busy || !emailOk || (mode === "signup" && (!name.trim() || !terms))}>
              {busy ? "Sending…" : "Email me a code"}
              <span>→</span>
            </button>
          </form>
        </>
      ) : (
        <form className="start-form" onSubmit={verify}>
          {devCode && (
            <p className="setup-note" role="status">
              Demo mode: email sending isn’t set up, so your code is shown here:{" "}
              <button type="button" className="code-fill" onClick={() => setCode(devCode)}>
                <b>{devCode}</b> (tap to fill)
              </button>
            </p>
          )}
          <label>
            6-digit code
            <input
              className={input + " code-input"}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              placeholder="123456"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          {error && <p role="alert" className="error-banner">{error}</p>}
          <button className={btn + " submit-action"} disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : mode === "signup" ? "Create my account" : "Log in"}
            <span>→</span>
          </button>
          <div className="auth-links">
            <button type="button" className="text-link" disabled={wait > 0 || busy} onClick={send}>
              {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            </button>
            <button type="button" className="text-link" onClick={() => { setStep("email"); setError(""); setDevCode(null); }}>
              Use a different email
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Everything you've created or joined, so you can pick up where you left off on any device.
function MyChallenges({ onOpen }: { onOpen: (s: { challengeId: string }) => void }) {
  const [list, setList] = useState<MyChallenge[] | null>(null);
  useEffect(() => {
    api.mine().then(setList).catch(() => setList([]));
  }, []);
  if (!list || list.length === 0) return null;
  const statusLabel: Record<MyChallenge["status"], string> = {
    draft: "Setting up",
    active: "In progress",
    settled: "Finished",
    cancelled: "Cancelled",
  };
  return (
    <section className="my-challenges" aria-labelledby="mine-title">
      <h2 id="mine-title">Your challenges</h2>
      <ul>
        {list.map((c) => {
          const a = getActivity(c.activity);
          return (
            <li key={c.id} className={card + " mine-row"}>
              <span className="lobby-icon" aria-hidden="true">{a.icon}</span>
              <div>
                <h3>{c.name}</h3>
                <p>
                  {a.label} · {c.durationDays} {c.durationDays === 1 ? "day" : "days"} · {c.players}/2 players
                </p>
              </div>
              <span className={"status-chip status-" + c.status}>{statusLabel[c.status]}</span>
              <button className={btn} onClick={() => onOpen({ challengeId: c.id })}>Open</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function InviteCard({ code, isPublic }: { code: string; isPublic: boolean }) {
  const [copied, setCopied] = useState("");
  const link = `${window.location.origin}/?join=${code}`;
  const copy = async (what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "code" ? code : link);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this:", what === "code" ? code : link);
    }
  };
  return (
    <div className={card + " invite-card"}>
      <p className="eyebrow">STEP 1 · INVITE YOUR FRIEND</p>
      <h2 className="font-semibold">Send your friend this invite</h2>
      <p className="text-sm text-slate-400">
        {isPublic
          ? "Your challenge is listed in the Challenges lobby, so anyone can join it. You can also invite someone directly:"
          : "This challenge is invite-only. Share the link or code with the friend you want:"}
      </p>
      <p className="invite-code" aria-label={`Invite code ${code}`}>
        {code}
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={btn} onClick={() => copy("link")}>
          {copied === "link" ? "Link copied ✓" : "Copy invite link"}
        </button>
        <button className={btn} onClick={() => copy("code")}>
          {copied === "code" ? "Code copied ✓" : "Copy code"}
        </button>
        {typeof navigator.share === "function" && (
          <button
            className={btn}
            onClick={() =>
              navigator
                .share({
                  title: "Join my FitStake challenge",
                  text: `Join my FitStake challenge with code ${code}`,
                  url: link,
                })
                .catch(() => {})
            }
          >
            Share…
          </button>
        )}
      </div>
      <ol className="invite-steps">
        <li>Your friend opens the link (or goes to FitStake and taps “Join a friend”).</li>
        <li>They enter their name and email, plus the code above if asked.</li>
        <li>This page updates by itself when they join. Meanwhile, set up your own rewards and card below.</li>
      </ol>
    </div>
  );
}

function Setup({
  waitingForFriend,
  me,
  challengeId,
  userId,
  apply,
  busy,
}: {
  waitingForFriend: boolean;
  me: State["participants"][number];
  challengeId: string;
  userId: string;
  apply: (p: Promise<State>) => void;
  busy: boolean;
}) {
  const [prefs, setPrefs] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [pickLow, setPickLow] = useState<Product | null>(null);
  const [pickBest, setPickBest] = useState<Product | null>(null);
  const [cap, setCap] = useState(100); // S$ spending cap, also the AI's budget
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    api
      .config()
      .then((c) => setSimulated(c.payments === "simulated"))
      .catch(() => {});
  }, []);
  // Show the saved cap once one exists.
  useEffect(() => {
    if (me.ceilingCents) setCap(me.ceilingCents / 100);
  }, [me.ceilingCents]);

  const locked = me.rewards.length === 2;
  const capCents = Math.round(cap * 100);
  const capValid = Number.isFinite(cap) && capCents >= 100 && capCents <= 100_000;
  const myBest = me.rewards.find((r) => r.tier === "best")?.priceCents ?? null;
  const required = me.requiredCeilingCents ?? null; // the friend's best reward: the most you may be asked to buy
  const needAtLeast = Math.max(myBest ?? 0, required ?? 0);
  const staleRec = rec !== null && rec.budgetCents !== capCents;
  const pickTooPricey = pickBest !== null && pickBest.priceCents > capCents;

  const capField = (
    <label className="cap-field">
      <span>Your spending cap (S$)</span>
      <input
        className={input + " max-w-32"}
        aria-label="Spending cap in Singapore dollars"
        type="number"
        min={1}
        max={1000}
        step={1}
        value={Number.isNaN(cap) ? "" : cap}
        onChange={(e) => setCap(e.target.valueAsNumber)}
      />
    </label>
  );

  const optionGroup = (
    title: string,
    list: Product[],
    selected: Product | null,
    onPick: (p: Product) => void,
  ) =>
    list.length > 1 && (
      <div className="option-group" role="radiogroup" aria-label={title}>
        <p className="eyebrow">{title}</p>
        <div className="option-list">
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected?.id === p.id}
              className={"option-chip" + (selected?.id === p.id ? " selected" : "")}
              onClick={() => onPick(p)}
            >
              <ProductImage id={p.id} name={p.name} imageUrl={p.imageUrl} className="chip-img" />
              <span>
                <b>{p.name}</b>
                <small>
                  {p.merchant} · {money(p.priceCents)} · {priceBand(p.priceCents)}
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <section className={card + " mb-6 space-y-5"}>
      {waitingForFriend && (
        <p className="setup-note" role="status">
          Your friend hasn’t joined yet. You can set up now; the challenge
          starts once you both have rewards locked and a card enrolled.
        </p>
      )}
      <div>
        <p className="eyebrow">DAY 1 · YOUR MOTIVATION, LOCKED IN</p>
        <h2 className="setup-title">2. AI recommends rewards</h2>
        {locked ? (
          <p className="text-sm text-slate-400">Locked in.</p>
        ) : (
          <>
            <div className="cap-box">
              {capField}
              <p>
                This is the most you can be charged, and it sets the AI’s
                budget. A <b>higher cap</b> lets it suggest more items and
                premium ones ($$$$); a <b>lower cap</b> keeps suggestions
                cheap. It must cover your best reward.
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className={input}
                aria-label="Reward preferences"
                placeholder="Optional: gym wear, snacks, things you like"
                value={prefs}
                onChange={(e) => setPrefs(e.target.value)}
              />
              <button
                className={btn}
                disabled={busy || !capValid}
                onClick={() => {
                  setLocalError("");
                  apply(
                    api.recommend(challengeId, prefs, capCents).then((r) => {
                      setRec(r);
                      setPickLow(r.lowest);
                      setPickBest(r.best);
                      return api.state(challengeId);
                    }),
                  );
                }}
              >
                Suggest within S${capValid ? cap : "…"}
              </button>
            </div>
            <small className="field-hint">
              Don’t include health or medical details. Your text is sent to OpenAI
              to suggest rewards.
            </small>
            {rec && pickLow && pickBest && (
              <div className="mt-3 text-sm">
                {staleRec && (
                  <p className="setup-note" role="status">
                    You changed your cap. Tap “Suggest” again to refresh the
                    options for S${cap}.
                  </p>
                )}
                <div className="recommendation-grid">
                  {[pickLow, pickBest].map((product, i) => (
                    <article key={product.id}>
                      <ProductImage
                        id={product.id}
                        name={product.name}
                        imageUrl={product.imageUrl}
                        className="rec-img"
                      />
                      <span className="eyebrow">
                        {i === 1 ? "THE BIGGER WIN" : "THE LITTLE TREAT"}
                        {product.demoOnly && " · DEMO ITEM"}
                      </span>
                      <h3>{product.merchant}</h3>
                      <p>{product.name}</p>
                      <strong>
                        {money(product.priceCents)}{" "}
                        <span className="price-band">{priceBand(product.priceCents)}</span>
                      </strong>
                    </article>
                  ))}
                </div>
                {optionGroup("Other little treats in your cap", rec.options.lowest, pickLow, setPickLow)}
                {optionGroup("Other bigger wins in your cap", rec.options.best, pickBest, setPickBest)}
                <p className="catalog-note">
                  {rec.source === "openai"
                    ? "AI-assisted suggestions"
                    : "Catalogue picks within your cap"}{" "}
                  · final quotes may include shipping and tax, so leave some room
                </p>
                <p className="mt-1 text-slate-400">{rec.reasoning}</p>
                {pickTooPricey && (
                  <p className="error-banner" role="alert">
                    Your cap (S${cap}) must be at least {money(pickBest.priceCents)} to cover this reward.
                  </p>
                )}
                {localError && (
                  <p className="error-banner" role="alert">
                    {localError}
                  </p>
                )}
                <button
                  className={btn + " mt-3"}
                  disabled={busy || pickTooPricey || staleRec || pickLow.priceCents >= pickBest.priceCents}
                  onClick={() =>
                    apply(api.lock(challengeId, pickLow.id, pickBest.id, capCents))
                  }
                >
                  Lock in rewards
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div>
        <h2 className="setup-title">3. Pre-authorise payment</h2>
        {!locked ? (
          <p className="text-sm text-slate-400">Lock in your rewards first. Your spending cap then covers them.</p>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            {!me.authorised && (
              <>
                <p className="text-slate-400">
                  {simulated
                    ? "Local demo: simulate enrolment without entering a card. Your cap limits the final quote, including shipping and tax. No payment provider is contacted."
                    : "Enrol on Reap’s hosted sandbox page. Your cap limits the final quote, including shipping and tax. Each final-day charge needs your approval; no funds are held."}
                </p>
                <p className="field-hint">
                  To set this up, your name and email are shared with Reap. Card
                  details are entered only on Reap’s page. See the{" "}
                  <a href="#privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                  .
                </p>
              </>
            )}
            <div className="cap-box">
              {capField}
              <p>
                At least <b>{money(myBest ?? 0)}</b> to cover your best reward
                {required ? (
                  <>
                    , and <b>{money(required)}</b> to cover your friend’s best
                    reward, which you may be asked to buy
                  </>
                ) : (
                  " (and your friend’s best reward once they choose it)"
                )}
                .
              </p>
            </div>
            {required !== null && capCents < required && (
              <p className="setup-note" role="status">
                Your friend’s best reward costs {money(required)}. Raise your cap to at least{" "}
                {money(required)} so the challenge can start.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {!me.authorised && (
                <button
                  className={btn}
                  disabled={busy || !capValid || capCents < (myBest ?? 0)}
                  onClick={() => {
                    apply(
                      api
                        .authorize(challengeId, capCents)
                        .then((r) => {
                          setApprovalUrl(r.approvalUrl);
                          return r.state;
                        }),
                    );
                  }}
                >
                  {simulated ? "Simulate enrolment" : "Prepare secure enrolment"}
                </button>
              )}
              {(me.authorised || me.enrolmentPending) &&
                capValid &&
                capCents !== me.ceilingCents &&
                capCents >= needAtLeast && (
                  <button
                    className={btn}
                    disabled={busy}
                    onClick={() => apply(api.updateCeiling(challengeId, capCents))}
                  >
                    Update my cap to S${cap}
                  </button>
                )}
              {approvalUrl && (
                <a
                  className={btn}
                  href={approvalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Reap enrolment ↗
                </a>
              )}
              {me.enrolmentPending && (
                <button
                  className={btn}
                  disabled={busy}
                  onClick={() =>
                    apply(api.enrollmentStatus(challengeId))
                  }
                >
                  I've finished — check status
                </button>
              )}
            </div>
            {me.authorised && <p className="text-slate-400">Sandbox enrolment ready.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
