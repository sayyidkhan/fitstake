import { useCallback, useEffect, useState } from "react";
import { api, money, type Recommendation, type State } from "./api";
import {
  ACTIVITIES,
  ACTIVITY_CATEGORIES,
  DEFAULT_ACTIVITY,
  getActivity,
} from "../shared/activities";

type Session = { challengeId: string; userId: string };
const KEY = "fitstake.session";
const load = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};

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
    app: "Stores only your enrolment reference and your ceiling. Card details stay with Reap.",
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
          <p>With the payment provider, Reap. FitStake keeps only your enrolment reference and the spending ceiling you set.</p>
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

const card = "panel";
const btn = "action";
const btnQuiet = "action action-quiet";
const input = "field";

const STATUS_LABEL = {
  draft: "Setting up",
  active: "In progress",
  settled: "Finished",
} as const;

export default function App() {
  const [session, setSession] = useState<Session | null>(load);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState<"home" | "how">(
    window.location.hash === "#how-it-works" ? "how" : "home",
  );
  useEffect(() => {
    const onHash = () => {
      setPage(window.location.hash === "#how-it-works" ? "how" : "home");
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
  const leave = () => {
    localStorage.removeItem(KEY);
    setSession(null);
    setState(null);
  };

  useEffect(() => {
    if (!session) return;
    run(() => api.state(session.challengeId)).then((s) => s && setState(s));
  }, [session, run]);

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
            {stepIndex >= 6 ? "All done" : `${stepIndex + 1}. ${WORKFLOW[stepIndex]!.title}`}
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
          <div className="panel waiting">
            <h2>Waiting for your friend</h2>
            <p>
              Send them the invite code <code>{challenge.inviteCode}</code>. They
              choose “Join a friend” on the home page and enter it.
            </p>
            <button type="button" className={btnQuiet} onClick={copyCode}>
              <Icon name={copied ? "check" : "copy"} />
              {copied ? "Copied" : "Copy invite code"}
            </button>
          </div>
        )}
      </section>

      {challenge.status === "draft" && me && participants.length === 2 && (
        <Setup
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

function Shell({ children, page }: { children: React.ReactNode; page: "home" | "how" }) {
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
            href="#how-it-works"
            aria-current={page === "how" ? "page" : undefined}
          >
            How it works
          </a>
        </nav>
        <span className={`sandbox-pill tone-${mode.tone}`} title="Payment mode">
          <i aria-hidden="true" /> {mode.label}
        </span>
      </header>
      <main id="main" className="workspace">
        {children}
      </main>
      <footer>
        <span>FitStake · made for your next personal best</span>
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
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [rules, setRules] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [days, setDays] = useState(30);
  const [activity, setActivity] = useState(DEFAULT_ACTIVITY);
  const daysOk = Number.isInteger(days) && days >= 1 && days <= 365;
  const ok = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      mode === "create"
        ? api.create(title.trim(), { name, email }, days, activity)
        : api.join(code.trim(), { name, email }),
    ).then((r) => r && onStart(r));
  };
  return (
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
        <p className="meta">Step 1 · Day 1</p>
        <h2 id="onboarding-title">Your next chapter starts together.</h2>
        <p className="onboarding-lede">
          Choose how many days, invite a friend, and agree on the scoring rules.
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
              I agree to the scoring rules: active minutes (capped at
              90 a day) plus a bonus for each active day. Ties use active
              days, then steps.
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
            <Icon name="arrow" />
          </button>
          {!busy && (
            <p className="field-hint form-status" role="status">
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
      </section>
    </div>
  );
}

function Setup({
  me,
  challengeId,
  userId,
  apply,
  busy,
}: {
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
  const ceilingOk = Number.isFinite(ceiling) && ceiling >= 1 && ceiling <= 1000;

  return (
    <section className={card + " section setup"}>
      <div className="setup-step">
        <p className="meta">Day 1 · your motivation, locked in</p>
        <h2 className="section-title">2. AI recommends rewards</h2>
        {locked ? (
          <p className="card-state ok">
            <Icon name="check" /> Rewards locked in
          </p>
        ) : (
          <>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                apply(
                  api.recommend(challengeId, prefs).then((r) => {
                    setRec(r);
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
              <button className={rec ? btnQuiet : btn} disabled={busy} aria-busy={busy}>
                {rec ? "Suggest again" : "Suggest rewards"}
              </button>
            </form>
            {rec && (
              <>
                <div className="recommendation-grid">
                  {[rec.lowest, rec.best].map((product) => (
                    <article key={product.id}>
                      <span className="meta">
                        {product.tier === "best" ? "The bigger win" : "The little treat"}
                      </span>
                      <h3>{product.name}</h3>
                      <p>{product.merchant}</p>
                      <strong className="num">{money(product.priceCents)}</strong>
                    </article>
                  ))}
                </div>
                <p className="rec-reason">{rec.reasoning}</p>
                <p className="catalog-note">
                  {rec.source === "openai"
                    ? "AI-assisted suggestions"
                    : "Supported catalogue picks"}{" "}
                  · final quotes may include shipping and tax
                </p>
                <button
                  className={btn}
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() =>
                    apply(
                      api.lock(challengeId, userId, rec.lowest.id, rec.best.id),
                    )
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
        {me.authorised ? (
          <p className="card-state ok">
            <Icon name="check" /> Sandbox enrolment ready
          </p>
        ) : (
          <>
            <p className="setup-copy">
              {simulated
                ? "Local demo: simulate enrolment without entering a card. Your ceiling caps the final quote, including shipping and tax. No payment provider is contacted."
                : "Enrol on Reap’s hosted sandbox page. Your ceiling caps the final quote, including shipping and tax. Each final-day charge needs your approval; no funds are held."}
            </p>
            <label className="ceiling">
              Spending ceiling
              <span className="prefix-field">
                <span aria-hidden="true">S$</span>
                <input
                  className={input}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={1000}
                  aria-invalid={!ceilingOk}
                  aria-describedby="ceiling-hint"
                  value={ceiling}
                  onChange={(e) => setCeiling(Number(e.target.value))}
                />
              </span>
              <small className="field-hint" id="ceiling-hint">
                Between S$1 and S$1,000.
              </small>
            </label>
            <div className="button-row">
              <button
                className={btn}
                disabled={busy || !ceilingOk}
                aria-busy={busy}
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
                    apply(api.enrollmentStatus(challengeId, userId))
                  }
                >
                  I’ve finished: check status
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
