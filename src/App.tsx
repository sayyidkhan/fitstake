import { useCallback, useEffect, useState } from "react";
import { api, money, type Recommendation, type State } from "./api";

type Session = { challengeId: string; userId: string };
const KEY = "fitstake.session";
const load = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};

const card = "panel rounded-2xl p-5";
const btn = "action px-4 py-2 font-semibold disabled:opacity-40";
const input = "field w-full px-3 py-2";

export default function App() {
  const [session, setSession] = useState<Session | null>(load);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  if (!session)
    return (
      <Shell>
        <Start onStart={start} run={run} busy={busy} error={error} />
      </Shell>
    );
  if (!state)
    return (
      <Shell>
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

  const apply = (p: Promise<State>) =>
    run(() => p).then((s) => s && setState(s));
  const { challenge, participants, leaderboard, transactions } = state;
  const me = participants.find((p) => p.user.id === session.userId);
  const nameOf = (id: string | null) =>
    participants.find((p) => p.user.id === id)?.user.name ?? "?";

  return (
    <Shell>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">YOUR CHALLENGE HQ</p>
          <h1 className="dashboard-title">{challenge.name}</h1>
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

      <ol className="journey" aria-label="Challenge milestones">
        {[
          "Commit together",
          "Choose rewards",
          "Build momentum",
          "Celebrate & settle",
        ].map((label, i) => (
          <li
            key={label}
            className={
              (challenge.status === "settled"
                ? 3
                : challenge.status === "active"
                  ? 2
                  : participants.length === 2
                    ? 1
                    : 0) === i
                ? "current"
                : ""
            }
          >
            <span>0{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="dashboard-stats">
        <div>
          <span>THE COMMITMENT</span>
          <strong>
            30 <small>days</small>
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
            {challenge.status === "draft"
              ? participants.length < 2
                ? "Invite your friend"
                : "Lock in & enrol"
              : challenge.status === "active"
                ? "Build momentum"
                : "Celebrate your progress"}
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
                    <span className="reward-symbol">
                      {r.tier === "best" ? "◇" : "◉"}
                    </span>
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
        {participants.length < 2 && (
          <div className={card + " text-slate-400"}>
            Waiting for your friend. Share code <b>{challenge.inviteCode}</b>.
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
        <section className={card + " mb-6"}>
          <h2 className="mb-3 font-semibold">Leaderboard</h2>
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
                        width: `${Math.min(100, (s.points / 3000) * 100)}%`,
                      }}
                    />
                  </div>
                  <p>
                    {s.adherentDays} active days ·{" "}
                    {s.totalSteps.toLocaleString()} steps ·{" "}
                    {Math.round((s.points / 3000) * 100)}% of maximum score
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
                Simulate 30 days of activity
              </button>
              <button
                className={btn}
                disabled={busy || !leaderboard[0]?.points}
                onClick={() => apply(api.settle(challenge.id))}
              >
                Simulate Day 30 — settle
              </button>
            </div>
          )}
        </section>
      )}

      {challenge.status === "settled" && (
        <section className={card}>
          <h2 className="font-semibold">
            Result: {nameOf(challenge.winnerUserId)} wins
          </h2>
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

function Shell({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState("Sandbox experience");
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
          <span className="brand-mark">↗</span>fitstake
          <span className="brand-dot">.</span>
        </a>
        <span className="nav-caption">
          A little competition. A lot of progress.
        </span>
        <span className="sandbox-pill">
          <i /> {mode}
        </span>
      </nav>
      <main className="workspace">{children}</main>
      <footer>
        <span>FITSTAKE · MADE FOR YOUR NEXT PERSONAL BEST</span>
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
  const [title, setTitle] = useState("Our 30-day personal best");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [rules, setRules] = useState(false);
  const ok = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      mode === "create"
        ? api.create(title.trim(), { name, email })
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
            Turn “we should work out” into a 30-day commitment. Challenge a
            friend, build a healthier routine, and make every active day count.
          </p>
          <div className="hero-tags">
            <span>↗ 30 days of momentum</span>
            <span>◎ 1 friend by your side</span>
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
            <span className="step-dot">01 / 03</span>
          </div>
          <h2>
            Your next chapter
            <br />
            starts together.
          </h2>
          <p>Create a challenge or join your friend’s invitation.</p>
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
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            <button
              className={btn + " submit-action"}
              disabled={
                busy ||
                !ok ||
                (mode === "create" ? !title.trim() : code.trim().length < 4)
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
      <section className="how-section">
        <div className="section-heading">
          <h2>Small steps. Shared stakes.</h2>
          <p>From “let’s do this” to “look what we did.”</p>
        </div>
        <div className="how-grid">
          {[
            {
              n: "01",
              title: "Make a commitment",
              copy: "Invite your friend and agree to clear, consistency-first rules.",
              icon: "◎",
            },
            {
              n: "02",
              title: "Pick your motivation",
              copy: "Choose a little treat and a bigger win. Lock in rewards and a spending ceiling.",
              icon: "◇",
            },
            {
              n: "03",
              title: "Show up. Get rewarded.",
              copy: "Compare simulated activity. The loser buys the winner’s best reward; the winner buys the loser’s little treat.",
              icon: "↗",
            },
          ].map((step) => (
            <article key={step.n}>
              <div className="how-top">
                <span>{step.n}</span>
                <b>{step.icon}</b>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </>
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

  return (
    <section className={card + " mb-6 space-y-5"}>
      <div>
        <p className="eyebrow">YOUR MOTIVATION, LOCKED IN</p>
        <h2 className="setup-title">1. Choose your rewards</h2>
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
            {rec && (
              <div className="mt-3 text-sm">
                <div className="recommendation-grid">
                  {[rec.lowest, rec.best].map((product) => (
                    <article key={product.id}>
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
        <h2 className="setup-title">2. Set your spending ceiling</h2>
        {me.authorised ? (
          <p className="text-sm text-slate-400">Sandbox enrolment ready.</p>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-slate-400">
              {simulated
                ? "Local demo: simulate enrolment without entering a card. Your ceiling caps the final quote, including shipping and tax. No payment provider is contacted."
                : "Enrol on Reap’s hosted sandbox page. Your ceiling caps the final quote, including shipping and tax. Each Day 30 charge needs your approval; no funds are held."}
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
