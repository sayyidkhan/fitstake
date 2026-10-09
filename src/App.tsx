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
const rememberReturn = (hash: string) => {
  try {
    sessionStorage.setItem(RETURN_KEY, hash);
  } catch {
    /* ignore */
  }
};

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

// The six-step product workflow, shown on the How it works page and tracked on the dashboard.
// Day label for each workflow step. Pass the challenge length for exact days; omit it for generic labels.
function stepDay(i: number, days?: number): string {
  if (i === 0) return "Day 1";
  if (i === 3) {
    if (days === undefined) return "The days in between";
    if (days <= 1) return "Day 1";
    if (days === 2) return "Days 1–2";
    return days === 3 ? "Day 2" : `Days 2–${days - 1}`;
  }
  if (i === 4) return days === undefined ? "Final day" : `Day ${days}`;
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

type IconName = "shield" | "card" | "check" | "clock" | "arrow" | "copy";

// One drawn icon set (24px grid, 1.75 stroke) instead of emoji and unicode glyphs.
function Icon({ name, className = "icon" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "shield" && (
        <>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </>
      )}
      {name === "card" && (
        <>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <path d="M3 10h18M16 14h2" />
        </>
      )}
      {name === "check" && <path d="M5 12.5l4.5 4.5L19 7.5" />}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      )}
      {name === "arrow" && <path d="M5 12h14M13 6l6 6-6 6" />}
      {name === "copy" && (
        <>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
          <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
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
            {"icon" in step && <Icon name={step.icon} className="wf-icon" />}
            <h3>
              {i + 1}. {step.title}
            </h3>
            <p>{step.copy}</p>
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
        <h1>Day 1: Commit. Final day: Settle.</h1>
        <p className="hero-copy">
          Two friends compete for as many days as they choose (from a single day) on healthy, consistency-first goals.
          The loser buys the winner’s best reward; the winner buys the loser’s
          lowest. Everyone gets something, and better progress unlocks the
          better prize.
        </p>
        <button className={btn} onClick={onStart}>
          Start a challenge <Icon name="arrow" />
        </button>
      </section>
      <Workflow />
      <section className="hiw-steps" aria-labelledby="hiw-steps-title">
        <h2 id="hiw-steps-title">Step by step</h2>
        {WORKFLOW.map((step, i) => (
          <article key={step.title} className="hiw-step">
            <div className="hiw-badge" aria-hidden="true">{i + 1}</div>
            <div>
              {stepDay(i, undefined) && (
                <span className="hiw-day">{stepDay(i, undefined)}</span>
              )}
              <h3>
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
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
          <p>With the payment provider, Reap. FitStake keeps your name, email, enrolment reference and the spending ceiling you set. See the <a className="text-link" href="#privacy">Privacy Policy</a> and <a className="text-link" href="#data-policy">Data Policy</a>.</p>
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

const card = "panel";
const btn = "action";
const btnQuiet = "action action-quiet";
const input = "field";

const STATUS_LABEL = {
  draft: "Setting up",
  active: "In progress",
  settled: "Finished",
  cancelled: "Cancelled",
} as const;

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
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // While the challenge is still being set up, poll so a friend joining shows up by itself.
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
        <div className="auth-page panel">
          <AuthCard onAuthed={finishLogin} />
        </div>
      </Shell>
    );
  if (page === "lobby")
    return (
      <Shell page={page}>
        <Lobby
          me={account}
          onJoined={(r) => {
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
        <div className="loading-panel" aria-busy="true">
          <p role="status" className="sr-only">Loading…</p>
          <span className="skeleton" style={{ width: "40%" }} />
          <span className="skeleton" style={{ width: "70%" }} />
        </div>
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
        <div className="panel loading-panel" aria-busy={!error}>
          {error ? (
            <p role="alert" className="error-banner">
              We couldn’t load your challenge. {error}
            </p>
          ) : (
            <>
              <p role="status" className="sr-only">Loading your challenge…</p>
              <span className="skeleton" style={{ width: "40%" }} />
              <span className="skeleton" style={{ width: "70%" }} />
              <span className="skeleton" style={{ width: "55%" }} />
            </>
          )}
          <button className={btnQuiet} onClick={leave}>
            Back to start
          </button>
        </div>
      </Shell>
    );

  if (state.challenge.status === "cancelled")
    return (
      <Shell page={page}>
        <div className="panel cancelled-panel" role="status">
          <span className="status status-cancelled">Cancelled</span>
          <h1 className="dashboard-title">{state.challenge.name}</h1>
          <p className="setup-copy">
            This challenge was cancelled before it started, so nothing was
            charged. You can start a new one or join another from the lobby.
          </p>
          <div className="button-row">
            <button className={btn} onClick={leave}>
              Start a new challenge
            </button>
            <button
              className={btnQuiet}
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
  const activity = getActivity(challenge.activity);
  const maxPoints = challenge.durationDays * 100; // 90 capped minutes + 10 bonus per day
  const lockedCount = participants.filter((p) => p.rewards.length === 2).length;
  const readyCount = participants.filter((p) => p.authorised).length;
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
  const copyCode = () => {
    navigator.clipboard
      ?.writeText(challenge.inviteCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  };

  return (
    <Shell page={page}>
      <header className="dash-header">
        <div>
          <h1 className="dashboard-title">{challenge.name}</h1>
          <p className="dash-meta">
            <span className="activity-chip">{activity.label}</span>
            <span className={`status status-${challenge.status}`}>
              {STATUS_LABEL[challenge.status]}
            </span>
            <span className="invite">
              Invite code <code>{challenge.inviteCode}</code>
              <button
                type="button"
                className="icon-button"
                onClick={copyCode}
                aria-label="Copy invite code"
              >
                <Icon name={copied ? "check" : "copy"} />
              </button>
              <span role="status" className="sr-only">
                {copied ? "Invite code copied" : ""}
              </span>
            </span>
          </p>
        </div>
        <div className="dash-actions">
          <button
            className={btnQuiet}
            disabled={busy}
            aria-busy={busy}
            onClick={() => apply(api.state(challenge.id))}
          >
            Refresh
          </button>
          {challenge.status === "draft" &&
            state.hostUserId === session.userId && (
              <button
                className="text-button danger"
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
          <button className="text-button" onClick={leave}>
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
            <span className="journey-mark">
              {i < stepIndex ? <Icon name="check" /> : i + 1}
            </span>
            {step.short}
          </li>
        ))}
      </ol>
      <dl className="summary">
        <div>
          <dt>Length</dt>
          <dd>
            {challenge.durationDays} {challenge.durationDays === 1 ? "day" : "days"}
          </dd>
        </div>
        <div>
          <dt>Players</dt>
          <dd>{participants.length} of 2</dd>
        </div>
        <div>
          <dt>Rewards locked</dt>
          <dd>{lockedCount} of 2</dd>
        </div>
        <div>
          <dt>Cards ready</dt>
          <dd>{readyCount} of 2</dd>
        </div>
        <div className="summary-next">
          <dt>Next step</dt>
          <dd>
            {stepIndex >= 6
              ? "All done"
              : stepIndex === 0
                ? "Invite your friend"
                : stepIndex === 1
                  ? "Lock in your rewards"
                  : stepIndex === 2
                    ? "Enrol your card"
                    : `${stepIndex + 1}. ${WORKFLOW[stepIndex]!.title}`}
          </dd>
        </div>
      </dl>
      <section className="players">
        {participants.map((p) => (
          <div key={p.user.id} className={card}>
            <div className="participant-heading">
              <span className="avatar" aria-hidden="true">
                {p.user.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h2>
                  {p.user.name}
                  {p.user.id === session.userId && <span className="you"> (you)</span>}
                </h2>
                <p className="meta">
                  {p.user.id === session.userId ? "Your commitment" : "Your challenge partner"}
                </p>
              </div>
            </div>
            <ul className="reward-list">
              {p.rewards.length ? (
                p.rewards.map((r) => (
                  <li key={r.id} className="reward-row">
                    <ProductImage
                      id={r.productId}
                      name={r.productName}
                      className="row-img"
                    />
                    <div>
                      <span className="meta">
                        {r.tier === "best" ? "Best reward" : "Little treat"} · {r.merchant}
                      </span>
                      <p>{r.productName}</p>
                    </div>
                    <strong className="num">{money(r.priceCents)}</strong>
                  </li>
                ))
              ) : (
                <li className="reward-empty">Rewards not locked yet</li>
              )}
            </ul>
            <p className={`card-state ${p.authorised ? "ok" : ""}`}>
              <Icon name={p.authorised ? "check" : "clock"} />
              {p.authorised
                ? "Sandbox enrolment ready"
                : p.enrolmentPending
                  ? "Awaiting card enrolment"
                  : "No card yet"}
            </p>
          </div>
        ))}
        {participants.length < 2 && (
          <InviteCard code={challenge.inviteCode} isPublic={challenge.isPublic} />
        )}
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
        <section className={card + " section"}>
          <p className="meta">{stepDay(3, challenge.durationDays)}</p>
          <h2 className="section-title">4. Compete and improve</h2>
          {leaderboard[0] && leaderboard[0].points > 0 ? (
            <ol className="ranking">
              {leaderboard.map((s, i) => (
                <li key={s.userId} className={`ranking-row ${i === 0 ? "leader" : ""}`}>
                  <div>
                    <span className="rank">{i + 1}</span>
                    <strong>{nameOf(s.userId)}</strong>
                    <span className="points num">
                      {s.points.toLocaleString()} pts
                    </span>
                  </div>
                  <div
                    className="score-track"
                    role="img"
                    aria-label={`${Math.round((s.points / maxPoints) * 100)}% of maximum score`}
                  >
                    <span
                      style={{
                        transform: `scaleX(${Math.min(1, s.points / maxPoints)})`,
                      }}
                    />
                  </div>
                  <p className="num">
                    {s.adherentDays} active days ·{" "}
                    {activity.stepsPerMinute > 0 &&
                      `${s.totalSteps.toLocaleString()} steps · `}
                    {Math.round((s.points / maxPoints) * 100)}% of maximum score
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-note">
              No activity logged yet. In this demo, use “Simulate activity” to
              fill in {challenge.durationDays === 1 ? "the day" : `all ${challenge.durationDays} days`} for both players.
            </p>
          )}
          <p className="fine-print">
            Rules: up to 90 active minutes a day count, plus 10 for each day with
            30+ minutes. Ties: more active days, then more steps, then a fixed hash.
          </p>
          {challenge.status === "active" && (
            <div className="button-row">
              <button
                className={leaderboard[0]?.points ? btnQuiet : btn}
                disabled={busy}
                aria-busy={busy}
                onClick={() => apply(api.simulate(challenge.id))}
              >
                Simulate activity
              </button>
              <button
                className={leaderboard[0]?.points ? btn : btnQuiet}
                disabled={busy || !leaderboard[0]?.points}
                aria-busy={busy}
                onClick={() => apply(api.settle(challenge.id))}
              >
                Settle on Day {challenge.durationDays}
              </button>
            </div>
          )}
        </section>
      )}

      {challenge.status === "settled" && (
        <section className={card + " section"}>
          <p className="meta">Day {challenge.durationDays}</p>
          <h2 className="section-title">
            5. Results: {nameOf(challenge.winnerUserId)} wins
          </h2>
          <p className="fine-print">
            Fixed scoring rules pick the winner; AI only explains the result.
          </p>
          <h2 className="section-title sub">6. Agentic payment</h2>
          <ul className="tx-list">
            {transactions.map((t) => (
              <li key={t.id}>
                <div>
                  <p>
                    {nameOf(t.payerUserId)} buys for {nameOf(t.recipientUserId)}
                  </p>
                  {t.failureReason && (
                    <p className="tx-reason">{t.failureReason}</p>
                  )}
                </div>
                <strong className="num">
                  {t.amountCents ? money(t.amountCents) : "—"}
                </strong>
                <span className={`tx-status tx-${t.status}`}>
                  {t.status.replace("_", " ")}
                </span>
                {t.status === "requires_approval" &&
                  t.checkoutUrl &&
                  t.payerUserId === session.userId && (
                    <a
                      className={btn}
                      href={t.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Approve payment
                    </a>
                  )}
              </li>
            ))}
          </ul>
          <div className="button-row">
            {transactions.some(
              (t) =>
                t.status === "requires_approval" ||
                t.status === "checkout_opened",
            ) && (
              <button
                className={btnQuiet}
                disabled={busy}
                aria-busy={busy}
                onClick={() => apply(api.refreshTransactions(challenge.id))}
              >
                Refresh payment status
              </button>
            )}
            {transactions.some((t) => t.status === "failed") && (
              <button
                className={btn}
                disabled={busy}
                aria-busy={busy}
                onClick={() => apply(api.settle(challenge.id))}
              >
                Retry failed checkouts
              </button>
            )}
          </div>
          <p className="fine-print">
            Sandbox only: no money moves and nothing ships.
          </p>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children, page }: { children: React.ReactNode; page: Page }) {
  const { me, logout } = useAuth();
  const [mode, setMode] = useState<{ label: string; tone: "ok" | "warn" | "off" }>({
    label: "Checking…",
    tone: "off",
  });
  useEffect(() => {
    api
      .config()
      .then((c) =>
        setMode(
          c.payments === "reap_sandbox"
            ? { label: "Reap sandbox", tone: "ok" }
            : c.payments === "simulated"
              ? { label: "Local simulator", tone: "ok" }
              : { label: "Payment setup required", tone: "warn" },
        ),
      )
      .catch(() => setMode({ label: "Connection unavailable", tone: "warn" }));
  }, []);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
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
          <span className={`sandbox-pill tone-${mode.tone}`} title="Payment mode">
            <i aria-hidden="true" /> {mode.label}
          </span>
          {me ? (
            <details className="account-menu">
              <summary aria-label={`Account: ${me.name}`}>
                <span className="avatar-sm" aria-hidden="true">{me.name.slice(0, 1).toUpperCase()}</span>
                <span className="account-name">{me.name.split(" ")[0]}</span>
              </summary>
              <div className="account-pop">
                <p>
                  <b>{me.name}</b>
                  <small>{me.email}</small>
                </p>
                <a href="#">My challenges</a>
                <button type="button" onClick={() => logout()}>Log out</button>
                <button type="button" onClick={() => logout(true)}>Log out of all devices</button>
              </div>
            </details>
          ) : me === null ? (
            <a className="login-link" href="#login">Log in</a>
          ) : null}
        </div>
      </header>
      <main id="main" className="workspace">
        {children}
      </main>
      <footer>
        <span>FitStake · made for your next personal best</span>
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
        <p className="hero-tags">
          <span>One friend, one activity, any length from 1 to 365 days.</span>
          <a className="text-link" href="#challenges">
            Browse open challenges
          </a>
          <a className="text-link" href="#how-it-works">
            See how it works
          </a>
        </p>
        <figure className="reward-preview">
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
          <figcaption>
            <h3>Your next win looks good.</h3>
            <p>KYDRA Axis Linerless Shorts</p>
            <span className="reward-price num">
              S$58.00 <small>· Best reward</small>
            </span>
          </figcaption>
        </figure>
        <p className="catalog-note">
          Illustrative reward. Final availability and price are checked at
          checkout.
        </p>
      </section>
      <section className="onboarding panel" aria-labelledby="onboarding-title">
        {!me ? (
          <AuthCard onAuthed={onAuthed} />
        ) : (
          <>
        <p className="meta">Step 1 · Day 1</p>
        <h2 id="onboarding-title">Your next chapter starts together.</h2>
        <p className="onboarding-lede">
          Welcome back, {me.name.split(" ")[0]}. Choose how many days, invite a
          friend, and agree on the scoring rules.
        </p>
        <div className="segmented" role="group" aria-label="Challenge action">
          <button
            type="button"
            aria-pressed={mode === "create"}
            onClick={() => setMode("create")}
          >
            Start a challenge
          </button>
          <button
            type="button"
            aria-pressed={mode === "join"}
            onClick={() => setMode("join")}
          >
            Join a friend
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
              <div className="field-pair">
                <label>
                  Activity
                  <select
                    className={input}
                    value={activity}
                    aria-describedby="activity-hint"
                    onChange={(e) => setActivity(e.target.value)}
                  >
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {ACTIVITIES.filter((a) => a.category === cat).map(
                          (a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ),
                        )}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label>
                  Length (days)
                  <input
                    className={input}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    step={1}
                    required
                    aria-describedby="days-hint"
                    aria-invalid={!daysOk}
                    value={Number.isNaN(days) ? "" : days}
                    onChange={(e) => setDays(e.target.valueAsNumber)}
                  />
                </label>
              </div>
              <p className="field-hint" id="activity-hint">
                Both players do this activity. Scoring counts active minutes, so
                any activity is fair.{" "}
                <span id="days-hint">
                  Pick 1 to 365 days; settlement happens on the final day.
                </span>
              </p>
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
            </>
          ) : (
            <label>
              Invite code
              <input
                className={input + " code-input"}
                placeholder="Enter your friend’s code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
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
              I agree to the scoring rules: active minutes (capped at 90 a
              day) plus a bonus for each active day. Ties use active days,
              then steps.
            </span>
          </label>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <button
            className={btn + " submit-action"}
            aria-busy={busy}
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
            <Icon name="arrow" />
          </button>
          {!busy && (
            <p className="field-hint form-status" role="status">
              {mode === "create" && !daysOk
                    ? "Choose a length from 1 to 365 days."
                    : mode === "join" && code.trim().length < 4
                      ? "Enter your friend’s invite code."
                      : !agreed
                        ? "Tick the box to agree to the scoring rules."
                        : "Ready when you are."}
            </p>
          )}
        </form>
        <div className="onboarding-foot">
          <p>Two friends. One commitment. Everyone gets a reward.</p>
          <button
            type="button"
            className="text-link"
            onClick={() => setRules(!rules)}
            aria-expanded={rules}
            aria-controls="rules-note"
          >
            {rules ? "Hide scoring rules" : "How does scoring work?"}
          </button>
          {rules && (
            <div className="rules-note" id="rules-note">
              Earn one point per active minute, capped at 90 per day, plus 10
              points on days with at least 30 active minutes. Ties use active
              days, steps, then a fixed hash. No weight-loss targets.
            </div>
          )}
        </div>
          </>
        )}
      </section>
    </div>
    {me && <MyChallenges onOpen={onStart} />}
    </>
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

  const capField = (id: string) => (
    <label className="cap-field" htmlFor={id}>
      Your spending cap
      <span className="prefix-field">
        <span aria-hidden="true">S$</span>
        <input
          id={id}
          className={input}
          type="number"
          inputMode="decimal"
          min={1}
          max={1000}
          step={1}
          aria-invalid={!capValid}
          value={Number.isNaN(cap) ? "" : cap}
          onChange={(e) => setCap(e.target.valueAsNumber)}
        />
      </span>
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
        <p className="meta">{title}</p>
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
                <small className="num">
                  {p.merchant} · {money(p.priceCents)} · {priceBand(p.priceCents)}
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <section className={card + " section setup"}>
      {waitingForFriend && (
        <p className="setup-note" role="status">
          Your friend hasn’t joined yet. You can set up now; the challenge
          starts once you both have rewards locked and a card enrolled.
        </p>
      )}
      <div className="setup-step">
        <p className="meta">Day 1 · your motivation, locked in</p>
        <h2 className="section-title">2. AI recommends rewards</h2>
        {locked ? (
          <p className="card-state ok">
            <Icon name="check" /> Rewards locked in
          </p>
        ) : (
          <>
            <div className="cap-box">
              {capField("cap-rewards")}
              <p>
                This is the most you can be charged, and it sets the AI’s
                budget. A <b>higher cap</b> lets it suggest more items and
                premium ones ($$$$); a <b>lower cap</b> keeps suggestions
                cheap. It must cover your best reward.
              </p>
            </div>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
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
              <label className="sr-only" htmlFor="prefs">
                Reward preferences
              </label>
              <input
                id="prefs"
                className={input}
                placeholder="Optional: gym wear, snacks, things you like"
                value={prefs}
                onChange={(e) => setPrefs(e.target.value)}
              />
              <button
                className={rec && !staleRec ? btnQuiet : btn}
                disabled={busy || !capValid}
                aria-busy={busy}
              >
                Suggest within S${capValid ? cap : "…"}
              </button>
            </form>
            <p className="field-hint prefs-hint">
              Don’t include health or medical details. Your text is sent to
              OpenAI to suggest rewards.
            </p>
            {rec && pickLow && pickBest && (
              <>
                {staleRec && (
                  <p className="setup-note stale-note" role="status">
                    You changed your cap. Suggest again to refresh the options
                    for S${cap}.
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
                      <span className="meta">
                        {i === 1 ? "The bigger win" : "The little treat"}
                        {product.demoOnly && " · demo item"}
                      </span>
                      <h3>{product.name}</h3>
                      <p>{product.merchant}</p>
                      <strong className="num">
                        {money(product.priceCents)}
                        <span className="price-band">{priceBand(product.priceCents)}</span>
                      </strong>
                    </article>
                  ))}
                </div>
                {optionGroup("Other little treats in your cap", rec.options.lowest, pickLow, setPickLow)}
                {optionGroup("Other bigger wins in your cap", rec.options.best, pickBest, setPickBest)}
                <p className="rec-reason">{rec.reasoning}</p>
                <p className="catalog-note">
                  {rec.source === "openai"
                    ? "AI-assisted suggestions"
                    : "Catalogue picks within your cap"}{" "}
                  · final quotes may include shipping and tax, so leave some room
                </p>
                {pickTooPricey && (
                  <p className="error-banner" role="alert">
                    Your cap (S${cap}) must be at least {money(pickBest.priceCents)} to cover this reward.
                  </p>
                )}
                <button
                  className={btn}
                  disabled={busy || pickTooPricey || staleRec || pickLow.priceCents >= pickBest.priceCents}
                  aria-busy={busy}
                  onClick={() =>
                    apply(api.lock(challengeId, pickLow.id, pickBest.id, capCents))
                  }
                >
                  Lock in rewards
                </button>
              </>
            )}
          </>
        )}
      </div>
      <div className="setup-step">
        <h2 className="section-title">3. Pre-authorise payment</h2>
        {!locked ? (
          <p className="setup-copy">
            Lock in your rewards first. Your spending cap then covers them.
          </p>
        ) : (
          <>
            {!me.authorised && (
              <>
                <p className="setup-copy">
                  {simulated
                    ? "Local demo: simulate enrolment without entering a card. Your cap limits the final quote, including shipping and tax. No payment provider is contacted."
                    : "Enrol on Reap’s hosted sandbox page. Your cap limits the final quote, including shipping and tax. Each final-day charge needs your approval; no funds are held."}
                </p>
                <p className="field-hint setup-privacy">
                  To set this up, your name and email are shared with Reap. Card
                  details are entered only on Reap’s page. See the{" "}
                  <a className="text-link" href="#privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                  .
                </p>
              </>
            )}
            <div className="cap-box">
              {capField("cap-payment")}
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
              <p className="setup-note stale-note" role="status">
                Your friend’s best reward costs {money(required)}. Raise your cap to at least{" "}
                {money(required)} so the challenge can start.
              </p>
            )}
            <div className="button-row">
              {!me.authorised && (
                <button
                  className={btn}
                  disabled={busy || !capValid || capCents < (myBest ?? 0)}
                  aria-busy={busy}
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
                    aria-busy={busy}
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
                  Open Reap enrolment
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {me.enrolmentPending && (
                <button
                  className={btnQuiet}
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() =>
                    apply(api.enrollmentStatus(challengeId))
                  }
                >
                  I’ve finished: check status
                </button>
              )}
            </div>
            {me.authorised && (
              <p className="card-state ok">
                <Icon name="check" /> Sandbox enrolment ready
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Lobby({ me, onJoined }: { me: AuthUser | null | undefined; onJoined: (s: { challengeId: string }) => void }) {
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
      rememberReturn("#challenges");
      window.location.hash = "#login";
      return;
    }
    setJoining(c.id);
    try {
      onJoined(await api.joinLobby(c.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
      refresh();
    } finally {
      setJoining(null);
    }
  };

  return (
    <section className="lobby">
      <h1>Pick a challenge to join</h1>
      <p className="hero-copy">
        Challenges are created by people like you. Choose one that fits your
        sport and schedule. When both seats are taken it disappears from this
        list.
      </p>
      <div className={card + " lobby-who"}>
        <p className="lobby-as">
          {me ? (
            <>
              Joining as <b>{me.name}</b>
            </>
          ) : (
            <>
              You’ll need a free account to join.{" "}
              <a className="text-link" href="#login" onClick={() => rememberReturn("#challenges")}>
                Log in or sign up
              </a>
            </>
          )}
        </p>
        <label>
          Activity
          <select className={input} value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">All activities</option>
            {ACTIVITY_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {ACTIVITIES.filter((a) => a.category === cat).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="error-banner lobby-error">
          {error}
        </p>
      )}
      <div className="lobby-head">
        <span role="status">
          {list ? `${list.length} open ${list.length === 1 ? "challenge" : "challenges"}` : "Loading…"}
        </span>
        <button type="button" className="text-link" onClick={refresh}>
          Refresh
        </button>
      </div>
      {list && list.length === 0 && (
        <div className="panel lobby-empty">
          <h2>No open challenges{activity ? " for this activity" : ""} right now</h2>
          <p>Be the first: create one and others can join whenever they like.</p>
          <a className={btn} href="#">
            Create a challenge <Icon name="arrow" />
          </a>
        </div>
      )}
      <ul className="lobby-list">
        {list?.map((c) => {
          const a = getActivity(c.activity);
          return (
            <li key={c.id} className="lobby-row">
              <div>
                <h2>{c.name}</h2>
                <p>
                  {a.label} · {c.durationDays} {c.durationDays === 1 ? "day" : "days"} · hosted by {c.host}
                </p>
              </div>
              <span className="lobby-seats num">
                {c.players}/{c.maxPlayers} players
              </span>
              <button className={btn} disabled={joining !== null} aria-busy={joining === c.id} onClick={() => join(c)}>
                {joining === c.id ? "Joining…" : me ? "Join" : "Log in to join"}
                <span className="sr-only"> {c.name}</span>
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
    <div className="panel invite-card">
      <p className="meta">Step 1 · invite your friend</p>
      <h2>Send your friend this invite</h2>
      <p className="setup-copy">
        {isPublic
          ? "Your challenge is listed in the Challenges lobby, so anyone can join it. You can also invite someone directly:"
          : "This challenge is invite-only. Share the link or code with the friend you want:"}
      </p>
      <p className="invite-code" aria-label={`Invite code ${code}`}>
        {code}
      </p>
      <div className="button-row">
        <button type="button" className={btn} onClick={() => copy("link")}>
          <Icon name={copied === "link" ? "check" : "copy"} />
          {copied === "link" ? "Link copied" : "Copy invite link"}
        </button>
        <button type="button" className={btnQuiet} onClick={() => copy("code")}>
          <Icon name={copied === "code" ? "check" : "copy"} />
          {copied === "code" ? "Code copied" : "Copy code"}
        </button>
        {typeof navigator.share === "function" && (
          <button
            type="button"
            className={btnQuiet}
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
            Share
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
      <p className="meta">Your account</p>
      <h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
      <p className="onboarding-lede">
        {step === "email" ? (
          "No password needed. We’ll email you a 6-digit code."
        ) : (
          <>
            We sent a code to <b>{email.trim()}</b>. It expires in 10 minutes.
          </>
        )}
      </p>
      {step === "email" ? (
        <>
          <div className="segmented" role="group" aria-label="Log in or sign up">
            <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>
              Log in
            </button>
            <button type="button" aria-pressed={mode === "signup"} onClick={() => setMode("signup")}>
              Sign up
            </button>
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
                  <a href="#terms" target="_blank" rel="noopener noreferrer">
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="#privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                  . I consent to {LEGAL.operator} collecting and using my name and email to run my account and challenges.
                </span>
              </label>
            )}
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            <button className={btn + " submit-action"} aria-busy={busy} disabled={busy || !emailOk || (mode === "signup" && (!name.trim() || !terms))}>
              {busy ? "Sending…" : "Email me a code"}
              <Icon name="arrow" />
            </button>
          </form>
        </>
      ) : (
        <form className="start-form auth-code-form" onSubmit={verify}>
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
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <button className={btn + " submit-action"} aria-busy={busy} disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : mode === "signup" ? "Create my account" : "Log in"}
            <Icon name="arrow" />
          </button>
          <div className="auth-links">
            <button type="button" className="text-link" disabled={wait > 0 || busy} onClick={send}>
              {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setStep("email");
                setError("");
                setDevCode(null);
              }}
            >
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
  return (
    <section className="my-challenges" aria-labelledby="mine-title">
      <h2 id="mine-title">Your challenges</h2>
      <ul className="lobby-list">
        {list.map((c) => {
          const a = getActivity(c.activity);
          return (
            <li key={c.id} className="lobby-row">
              <div>
                <h3>{c.name}</h3>
                <p>
                  {a.label} · {c.durationDays} {c.durationDays === 1 ? "day" : "days"} · {c.players}/2 players
                </p>
              </div>
              <span className={`status status-${c.status}`}>{STATUS_LABEL[c.status]}</span>
              <button className={btnQuiet} onClick={() => onOpen({ challengeId: c.id })}>
                Open<span className="sr-only"> {c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
