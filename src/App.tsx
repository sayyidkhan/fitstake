import { useCallback, useEffect, useState } from "react";
import { api, money, type Recommendation, type State } from "./api";

type Session = { challengeId: string; userId: string };
const KEY = "fitstake.session";
const load = (): Session | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
};

const card = "rounded-2xl border border-slate-800 bg-slate-900 p-5";
const btn = "rounded-lg bg-teal-500 px-4 py-2 font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-40";
const input = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2";

export default function App() {
  const [session, setSession] = useState<Session | null>(load);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    setError("");
    try { return await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(false); }
  }, []);

  const start = (s: Session) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
  };

  useEffect(() => {
    if (!session) return;
    run(() => api.state(session.challengeId)).then((s) => s && setState(s));
  }, [session, run]);

  if (!session) return <Shell><Start onStart={start} run={run} busy={busy} error={error} /></Shell>;
  if (!state) return <Shell><p className="text-slate-400">{error || "Loading…"}</p></Shell>;

  const apply = (p: Promise<State>) => run(() => p).then((s) => s && setState(s));
  const { challenge, participants, leaderboard, transactions } = state;
  const me = participants.find((p) => p.user.id === session.userId);
  const nameOf = (id: string | null) => participants.find((p) => p.user.id === id)?.user.name ?? "?";

  return (
    <Shell>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{challenge.name}</h1>
          <p className="text-sm text-slate-400">
            Status: <b className="text-teal-400">{challenge.status}</b> · Invite code: <b>{challenge.inviteCode}</b>
          </p>
        </div>
        <button className="text-sm text-slate-400 underline" onClick={() => { localStorage.removeItem(KEY); setSession(null); setState(null); }}>
          Leave
        </button>
      </header>
      {error && <p className="mb-4 rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        {participants.map((p) => (
          <div key={p.user.id} className={card}>
            <h2 className="font-semibold">{p.user.name}{p.user.id === session.userId && " (you)"}</h2>
            <ul className="mt-2 text-sm text-slate-300">
              {p.rewards.length ? p.rewards.map((r) => (
                <li key={r.id}>{r.tier === "best" ? "Best" : "Lowest"}: {r.merchant} · {r.productName} ({money(r.priceCents)})</li>
              )) : <li className="text-slate-500">Rewards not locked</li>}
            </ul>
            <p className="mt-2 text-sm">{p.authorised ? "✅ Payment authorised" : "⏳ Not authorised"}</p>
          </div>
        ))}
        {participants.length < 2 && <div className={card + " text-slate-400"}>Waiting for your friend. Share code <b>{challenge.inviteCode}</b>.</div>}
      </section>

      {challenge.status === "draft" && me && participants.length === 2 && (
        <Setup key={me.rewards.length + String(me.authorised)} me={me} challengeId={challenge.id} userId={session.userId} apply={apply} busy={busy} />
      )}

      {challenge.status !== "draft" && (
        <section className={card + " mb-6"}>
          <h2 className="mb-3 font-semibold">Leaderboard</h2>
          {leaderboard[0] && leaderboard[0].points > 0 ? (
            <ol className="space-y-1">
              {leaderboard.map((s, i) => (
                <li key={s.userId}>{i + 1}. {nameOf(s.userId)}: {s.points} pts · {s.adherentDays} active days · {s.totalSteps.toLocaleString()} steps</li>
              ))}
            </ol>
          ) : <p className="text-slate-400">No activity yet.</p>}
          <p className="mt-3 text-xs text-slate-500">Rules: up to 90 active min/day count, +10 for each day with 30+ minutes. Ties: more active days, then more steps, then a fixed hash.</p>
          {challenge.status === "active" && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button className={btn} disabled={busy} onClick={() => apply(api.simulate(challenge.id))}>Simulate 30 days of activity</button>
              <button className={btn} disabled={busy || !leaderboard[0]?.points} onClick={() => apply(api.settle(challenge.id))}>Simulate Day 30 — settle</button>
            </div>
          )}
        </section>
      )}

      {challenge.status === "settled" && (
        <section className={card}>
          <h2 className="font-semibold">Result: {nameOf(challenge.winnerUserId)} wins</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {transactions.map((t) => (
              <li key={t.id}>
                {nameOf(t.payerUserId)} buys for {nameOf(t.recipientUserId)}: {t.amountCents ? money(t.amountCents) : "—"} ·{" "}
                <b className={t.status === "checkout_opened" ? "text-teal-400" : "text-amber-400"}>{t.status}</b>
                {t.failureReason && <span className="text-red-300"> ({t.failureReason})</span>}
              </li>
            ))}
          </ul>
          {transactions.some((t) => t.status === "failed") && (
            <button className={btn + " mt-3"} disabled={busy} onClick={() => apply(api.settle(challenge.id))}>Retry failed checkouts</button>
          )}
          <p className="mt-3 text-xs text-slate-500">Sandbox only: no money moves and nothing ships.</p>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <p className="text-xs font-semibold tracking-widest text-teal-400">FITSTAKE</p>
      {children}
    </main>
  );
}

function Start({ onStart, run, busy, error }: { onStart: (s: Session) => void; run: <T>(fn: () => Promise<T>) => Promise<T | undefined>; busy: boolean; error: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("30-day showdown");
  const [code, setCode] = useState("");
  const who = { name, email };
  const ok = name && email;
  return (
    <>
      <h1 className="mb-1 text-3xl font-bold">Stake Together. Sweat Together. Win Together.</h1>
      <p className="mb-6 text-slate-400">Day 1: Commit. Day 30: Settle.</p>
      {error && <p className="mb-4 rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}
      <div className={card + " mb-4 space-y-3"}>
        <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={card + " space-y-3"}>
          <h2 className="font-semibold">Start a challenge</h2>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className={btn} disabled={busy || !ok || !title} onClick={() => run(() => api.create(title, who)).then((r) => r && onStart(r))}>Create</button>
        </div>
        <div className={card + " space-y-3"}>
          <h2 className="font-semibold">Join with invite code</h2>
          <input className={input} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className={btn} disabled={busy || !ok || code.length < 4} onClick={() => run(() => api.join(code, who)).then((r) => r && onStart(r))}>Join</button>
        </div>
      </div>
    </>
  );
}

function Setup({ me, challengeId, userId, apply, busy }: { me: State["participants"][number]; challengeId: string; userId: string; apply: (p: Promise<State>) => void; busy: boolean }) {
  const [prefs, setPrefs] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [ceiling, setCeiling] = useState(100);
  const locked = me.rewards.length === 2;

  return (
    <section className={card + " mb-6 space-y-5"}>
      <div>
        <h2 className="font-semibold">1. Choose rewards</h2>
        {locked ? <p className="text-sm text-slate-400">Locked in.</p> : (
          <>
            <div className="mt-2 flex gap-2">
              <input className={input} placeholder="Optional: things you like (e.g. gym wear, snacks)" value={prefs} onChange={(e) => setPrefs(e.target.value)} />
              <button className={btn} disabled={busy} onClick={() => api.recommend(challengeId, prefs).then(setRec)}>Suggest</button>
            </div>
            {rec && (
              <div className="mt-3 text-sm">
                <p>Lowest: {rec.lowest.merchant} · {rec.lowest.name} ({money(rec.lowest.priceCents)})</p>
                <p>Best: {rec.best.merchant} · {rec.best.name} ({money(rec.best.priceCents)})</p>
                <p className="mt-1 text-slate-400">{rec.reasoning}</p>
                <button className={btn + " mt-3"} disabled={busy} onClick={() => apply(api.lock(challengeId, userId, rec.lowest.id, rec.best.id))}>Lock in rewards</button>
              </div>
            )}
          </>
        )}
      </div>
      <div>
        <h2 className="font-semibold">2. Authorise spending</h2>
        {me.authorised ? <p className="text-sm text-slate-400">Authorised.</p> : (
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-slate-400">Set a ceiling for what you may be charged if you lose. Card details stay with the payment provider (sandbox here).</p>
            <label className="flex items-center gap-2">S$ <input className={input + " max-w-28"} type="number" min={1} value={ceiling} onChange={(e) => setCeiling(Number(e.target.value))} /></label>
            <button className={btn} disabled={busy || ceiling < 1} onClick={() => apply(api.authorize(challengeId, userId, Math.round(ceiling * 100)))}>Authorise</button>
          </div>
        )}
      </div>
    </section>
  );
}
