import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// On Vercel the filesystem is read-only, so a missing URL must fail loudly instead of falling back to a local file.
if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
  throw new Error("TURSO_DATABASE_URL is not set for this Vercel environment");
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
