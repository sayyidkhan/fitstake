import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});

export const challenges = sqliteTable("challenges", {
  id: id(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  durationDays: integer("duration_days").notNull().default(30),
  // Activity id from shared/activities.ts
  activity: text("activity").notNull().default("any"),
  // Public challenges appear in the lobby while they have an open seat.
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  // draft -> active (both rewards locked + authorised) -> settled
  status: text("status", { enum: ["draft", "active", "settled"] }).notNull().default("draft"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  settledAt: integer("settled_at", { mode: "timestamp" }),
  winnerUserId: text("winner_user_id"),
  loserUserId: text("loser_user_id"),
  createdAt: createdAt(),
});

export const participants = sqliteTable(
  "participants",
  {
    id: id(),
    challengeId: text("challenge_id").notNull().references(() => challenges.id),
    userId: text("user_id").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("participants_challenge_user").on(t.challengeId, t.userId)],
);

// Simulated fitness data for the POC (one row per participant per day).
export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: id(),
    challengeId: text("challenge_id").notNull().references(() => challenges.id),
    userId: text("user_id").notNull().references(() => users.id),
    day: integer("day").notNull(),
    steps: integer("steps").notNull(),
    activeMinutes: integer("active_minutes").notNull(),
  },
  (t) => [uniqueIndex("activity_challenge_user_day").on(t.challengeId, t.userId, t.day)],
);

// Each participant locks one lowest-value and one best-value reward.
export const rewardChoices = sqliteTable(
  "reward_choices",
  {
    id: id(),
    challengeId: text("challenge_id").notNull().references(() => challenges.id),
    userId: text("user_id").notNull().references(() => users.id),
    tier: text("tier", { enum: ["lowest", "best"] }).notNull(),
    productId: text("product_id").notNull(),
    merchant: text("merchant").notNull(),
    productName: text("product_name").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("SGD"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reward_choices_unique_tier").on(t.challengeId, t.userId, t.tier)],
);

// Mandate terms only. Card data stays with the payment provider.
export const paymentAuthorizations = sqliteTable(
  "payment_authorizations",
  {
    id: id(),
    challengeId: text("challenge_id").notNull().references(() => challenges.id),
    userId: text("user_id").notNull().references(() => users.id),
    providerRef: text("provider_ref").notNull(),
    spendingCeilingCents: integer("spending_ceiling_cents").notNull(),
    currency: text("currency").notNull().default("SGD"),
    validUntil: integer("valid_until", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["pending", "active", "expired", "revoked"] }).notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payment_auth_challenge_user").on(t.challengeId, t.userId)],
);

// One row per reward purchase. idempotencyKey makes duplicate settlement a no-op.
export const transactions = sqliteTable("transactions", {
  id: id(),
  challengeId: text("challenge_id").notNull().references(() => challenges.id),
  payerUserId: text("payer_user_id").notNull().references(() => users.id),
  recipientUserId: text("recipient_user_id").notNull().references(() => users.id),
  rewardChoiceId: text("reward_choice_id").notNull().references(() => rewardChoices.id),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  attempts: integer("attempts").notNull().default(0),
  amountCents: integer("amount_cents"),
  currency: text("currency").notNull().default("SGD"),
  status: text("status", {
    enum: ["pending", "processing", "checkout_opened", "requires_approval", "completed", "failed"],
  }).notNull().default("pending"),
  providerRef: text("provider_ref"),
  checkoutUrl: text("checkout_url"),
  failureReason: text("failure_reason"),
  createdAt: createdAt(),
});
