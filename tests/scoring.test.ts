import { describe, expect, it } from "vitest";
import { decide, scoreUser } from "../server/scoring";

describe("scoring", () => {
  it("caps daily minutes and adds adherence bonus", () => {
    const s = scoreUser("a", [
      { day: 1, steps: 1000, activeMinutes: 200 }, // 90 + 10
      { day: 2, steps: 500, activeMinutes: 10 }, // 10, not adherent
    ]);
    expect(s).toEqual({ userId: "a", points: 110, adherentDays: 1, totalSteps: 1500 });
  });

  it("breaks ties deterministically", () => {
    const a = { userId: "a", points: 10, adherentDays: 1, totalSteps: 5 };
    const b = { userId: "b", points: 10, adherentDays: 1, totalSteps: 5 };
    const r1 = decide("c1", [a, b]);
    const r2 = decide("c1", [b, a]);
    expect(r1.winner.userId).toBe(r2.winner.userId);
  });

  it("prefers more adherent days on equal points", () => {
    const a = { userId: "a", points: 10, adherentDays: 2, totalSteps: 1 };
    const b = { userId: "b", points: 10, adherentDays: 1, totalSteps: 99 };
    expect(decide("c", [a, b]).winner.userId).toBe("a");
  });
});
