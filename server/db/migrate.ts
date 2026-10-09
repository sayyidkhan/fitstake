import { migrate } from "drizzle-orm/libsql/migrator";

// Check deployment configuration before importing the client, which otherwise
// falls back to an invalid hostname when the Vercel database URL is missing.
if (process.env.VERCEL) {
  const missing = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length) {
    throw new Error(
      `Missing Vercel environment variables: ${missing.join(", ")}. ` +
        "Set them in Project Settings > Environment Variables for this deployment's " +
        "environment (Production or Preview), then redeploy. See .env.example for the variable names.",
    );
  }
}

const { db } = await import("./client.js");

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied");
