import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied");
