import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

// On Vercel the filesystem is read-only. If the URL is missing, point at an invalid host so requests
// fail with a readable error (shown by /api/health) instead of crashing the function at load time.
const url = process.env.TURSO_DATABASE_URL ?? (process.env.VERCEL ? "libsql://TURSO_DATABASE_URL-not-set.invalid" : "file:local.db");

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
