// Deterministic, transparent scoring. Rules shown to both players on Day 1:
//   points = sum over days of min(activeMinutes, 90) + 10 per "adherent" day (>= 30 active minutes)
//   tie-breaks, in order: more adherent days, more total steps, then a stable hash of the challenge id.
export const DAILY_MINUTES_CAP = 90; // reward healthy adherence, not extremes
export const ADHERENT_MINUTES = 30;
export const ADHERENCE_BONUS = 10;

export type DayLog = { day: number; steps: number; activeMinutes: number };

export type Score = {
  userId: string;
  points: number;
  adherentDays: number;
  totalSteps: number;
};

export function scoreUser(userId: string, logs: DayLog[]): Score {
  let points = 0;
  let adherentDays = 0;
  let totalSteps = 0;
  for (const l of logs) {
    points += Math.min(Math.max(l.activeMinutes, 0), DAILY_MINUTES_CAP);
    if (l.activeMinutes >= ADHERENT_MINUTES) {
      adherentDays += 1;
      points += ADHERENCE_BONUS;
    }
    totalSteps += Math.max(l.steps, 0);
  }
  return { userId, points, adherentDays, totalSteps };
}

// FNV-1a: stable across runs, so a full tie still resolves reproducibly.
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function rank(challengeId: string, scores: Score[]): Score[] {
  return [...scores].sort(
    (a, b) =>
      b.points - a.points ||
      b.adherentDays - a.adherentDays ||
      b.totalSteps - a.totalSteps ||
      hash(challengeId + a.userId) - hash(challengeId + b.userId) ||
      a.userId.localeCompare(b.userId),
  );
}

export function decide(challengeId: string, scores: Score[]) {
  if (scores.length !== 2) throw new Error("A challenge needs exactly two participants");
  const [winner, loser] = rank(challengeId, scores);
  return { winner, loser };
}
