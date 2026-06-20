import { migrateJsonToSqlite } from "./server/migrate.ts";

try {
  console.log("[Migration Tool] Triggering static database migration from db.json to SQLite...");
  const report = migrateJsonToSqlite();
  console.log("[Migration Tool] Success! Report:");
  console.log(JSON.stringify(report, null, 2));
} catch (err: any) {
  console.error("[Migration Tool] Executing migration failed:", err.message);
  process.exit(1);
}
