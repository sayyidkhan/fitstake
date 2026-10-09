import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client.js";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied");
