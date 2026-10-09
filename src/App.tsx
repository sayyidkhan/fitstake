import { useCallback, useEffect, useState } from "react";
import { api, money, type LobbyEntry, type Recommendation, type State } from "./api";
import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  DEFAULT_ACTIVITY,
  getActivity,
} from "../shared/activities";
import { LEGAL, LegalPage, type LegalPageId } from "./legal";

type Session = { challengeId: string; userId: string };
const KEY = "fitstake.session";
const load = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};

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

type Page = "home" | "how" | "lobby" | LegalPageId;
const PAGE_BY_HASH: Record<string, Page> = {
  "#how-it-works": "how",
  "#challenges": "lobby",
  "#privacy": "privacy",
  "#terms": "terms",
  "#data-policy": "data-policy",
};
const pageFromHash = (): Page => PAGE_BY_HASH[window.location.hash] ?? "home";

const card = "panel rounded-2xl p-5";
const btn = "action px-4 py-2 font-semibold disabled:opacity-40";
const input = "field w-full px-3 py-2";

export default function App() {
  const [session, setSession] = useState<Session | null>(load);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
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
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, []);

  const start = (s: Session) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
  };

  useEffect(() => {
    if (!session) return;
    run(() => api.state(session.challengeId)).then((s) => s && setState(s));
  }, [session, run]);

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
  if (page === "lobby")
    return (
      <Shell page={page}>
        <Lobby
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
  if (!session)
    return (
      <Shell page={page}>
        <Start onStart={start} run={run} busy={busy} error={error} />
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
              localStorage.removeItem(KEY);
              setSession(null);
              setState(null);
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
                localStorage.removeItem(KEY);
                setSession(null);
                setState(null);
              }}
            >
              Start a new challenge
            </button>
            <button
              className={btn}
              onClick={() => {
                localStorage.removeItem(KEY);
                setSession(null);
                setState(null);
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
                    apply(api.cancel(challenge.id, session.userId));
                }}
              >
                Cancel challenge
              </button>
            )}
          <button
            className="text-sm text-slate-400 underline"
            onClick={() => {
              localStorage.removeItem(KEY);
              setSession(null);
              setState(null);
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
        <span className="sandbox-pill">
          <i /> {mode}
        </span>
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
  onStart,
  run,
  busy,
  error,
}: {
  onStart: (s: Session) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  busy: boolean;
  error: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
  const ok = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      mode === "create"
        ? api.create(title.trim(), { name, email }, days, activity, isPublic)
        : api.join(code.trim(), { name, email }),
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
          <div className="card-heading">
            <span className="eyebrow">LET’S MAKE IT HAPPEN</span>
            <span className="step-dot">STEP 1 · DAY 1</span>
          </div>
          <h2>
            Your next chapter
            <br />
            starts together.
          </h2>
          <p>Choose how many days, invite a friend, and agree on the scoring rules.</p>
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
            <label>
              Your name
              <input
                className={input}
                placeholder="What should we call you?"
                autoComplete="name"
                maxLength={60}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email address
              <input
                className={input}
                placeholder="you@example.com"
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
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
                I agree to the{" "}
                <a href="#terms" target="_blank" rel="noopener noreferrer">
                  Terms
                </a>{" "}
                and{" "}
                <a href="#privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                , including the scoring rules: active minutes (capped at 90 a
                day) plus a bonus for each active day. Ties use active days,
                then steps. I consent to {LEGAL.operator} collecting and using my
                name and email to run this challenge.
              </span>
            </label>
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            {!busy && (
              <p className="field-hint" role="status">
                {!name.trim() || !email.trim()
                  ? "Add your name and email to continue."
                  : !ok
                    ? "Enter a valid email address."
                    : mode === "create" && !daysOk
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
                !ok ||
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
        </section>
      </div>
    </>
  );
}

function Lobby({ onJoined }: { onJoined: (s: Session) => void }) {
  const [list, setList] = useState<LobbyEntry[] | null>(null);
  const [activity, setActivity] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const ok = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && agreed;

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
    setJoining(c.id);
    try {
      onJoined(await api.joinLobby(c.id, { name, email }));
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
        <label>
          Your name
          <input className={input} value={name} maxLength={60} autoComplete="name" placeholder="What should we call you?" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email address
          <input className={input} type="email" value={email} autoComplete="email" placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
        </label>
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
        <label className="agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the{" "}
            <a href="#terms" target="_blank" rel="noopener noreferrer">
              Terms
            </a>{" "}
            and{" "}
            <a href="#privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            . I consent to {LEGAL.operator} collecting and using my name and email to join.
          </span>
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
              <button className={btn} disabled={!ok || joining !== null} onClick={() => join(c)} title={ok ? undefined : "Enter your name and email first"}>
                {joining === c.id ? "Joining…" : "Join"}
              </button>
            </li>
          );
        })}
      </ul>
      {!ok && list && list.length > 0 && <p className="field-hint">Add your name and email, and accept the terms above, to join.</p>}
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
  const [ceiling, setCeiling] = useState(100);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  useEffect(() => {
    api
      .config()
      .then((c) => setSimulated(c.payments === "simulated"))
      .catch(() => {});
  }, []);
  const locked = me.rewards.length === 2;

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
            <div className="mt-2 flex gap-2">
              <input
                className={input}
                aria-label="Reward preferences"
                placeholder="Optional: gym wear, snacks, things you like"
                value={prefs}
                onChange={(e) => setPrefs(e.target.value)}
              />
              <button
                className={btn}
                disabled={busy}
                onClick={() =>
                  apply(
                    api.recommend(challengeId, prefs).then((r) => {
                      setRec(r);
                      return api.state(challengeId);
                    }),
                  )
                }
              >
                Suggest
              </button>
            </div>
            <small className="field-hint">
              Don’t include health or medical details. Your text is sent to OpenAI
              to suggest rewards.
            </small>
            {rec && (
              <div className="mt-3 text-sm">
                <div className="recommendation-grid">
                  {[rec.lowest, rec.best].map((product) => (
                    <article key={product.id}>
                      <ProductImage
                        id={product.id}
                        name={product.name}
                        imageUrl={product.imageUrl}
                        className="rec-img"
                      />
                      <span className="eyebrow">
                        {product.tier === "best"
                          ? "THE BIGGER WIN"
                          : "THE LITTLE TREAT"}
                      </span>
                      <h3>{product.merchant}</h3>
                      <p>{product.name}</p>
                      <strong>{money(product.priceCents)}</strong>
                    </article>
                  ))}
                </div>
                <p className="catalog-note">
                  {rec.source === "openai"
                    ? "AI-assisted suggestions"
                    : "Supported catalogue picks"}{" "}
                  · final quotes may include shipping and tax
                </p>
                <p className="mt-1 text-slate-400">{rec.reasoning}</p>
                <button
                  className={btn + " mt-3"}
                  disabled={busy}
                  onClick={() =>
                    apply(
                      api.lock(challengeId, userId, rec.lowest.id, rec.best.id),
                    )
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
        {me.authorised ? (
          <p className="text-sm text-slate-400">Sandbox enrolment ready.</p>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-slate-400">
              {simulated
                ? "Local demo: simulate enrolment without entering a card. Your ceiling caps the final quote, including shipping and tax. No payment provider is contacted."
                : "Enrol on Reap’s hosted sandbox page. Your ceiling caps the final quote, including shipping and tax. Each final-day charge needs your approval; no funds are held."}
            </p>
            <p className="field-hint">
              To set this up, your name and email are shared with Reap. Card
              details are entered only on Reap’s page. See the{" "}
              <a href="#privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </p>
            <label className="flex items-center gap-2">
              S${" "}
              <input
                className={input + " max-w-28"}
                aria-label="Spending ceiling in Singapore dollars"
                type="number"
                min={1}
                max={1000}
                value={ceiling}
                onChange={(e) => setCeiling(Number(e.target.value))}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className={btn}
                disabled={
                  busy ||
                  !Number.isFinite(ceiling) ||
                  ceiling < 1 ||
                  ceiling > 1000
                }
                onClick={async () => {
                  apply(
                    api
                      .authorize(challengeId, userId, Math.round(ceiling * 100))
                      .then((r) => {
                        setApprovalUrl(r.approvalUrl);
                        return r.state;
                      }),
                  );
                }}
              >
                {simulated ? "Simulate enrolment" : "Prepare secure enrolment"}
              </button>
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
                    apply(api.enrollmentStatus(challengeId, userId))
                  }
                >
                  I've finished — check status
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
