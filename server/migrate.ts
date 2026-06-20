import fs from "fs";
import path from "path";
import { saveAll, loadAll } from "./database";

// Define bundle path mappings for db.json similar to server.ts
const BUNDLED_DB_PATHS = [
  path.join(process.cwd(), "db.json"),
  path.join(process.cwd(), "api", "db.json"),
  path.join(process.cwd(), "api/db.json"),
  "/var/task/db.json",
  "/var/task/api/db.json"
];

export function getDbJsonPath(): string {
  for (const p of BUNDLED_DB_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(process.cwd(), "db.json");
}

export interface MigrationReport {
  success: boolean;
  message: string;
  sourcePath: string;
  migratedCounts: {
    products: number;
    customers: number;
    orders: number;
    conversations: number;
    callLogs: number;
    payments: number;
    webhookLogs: number;
    quickReplies: number;
  };
}

export function migrateJsonToSqlite(): MigrationReport {
  const jsonPath = getDbJsonPath();

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Migration source file not found on disk at: ${jsonPath}`);
  }

  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const parsedData = JSON.parse(rawData);

  if (!parsedData) {
    throw new Error("Failed to parse db.json file contents - JSON structure is empty or invalid.");
  }

  // Calculate stats
  const counts = {
    products: Array.isArray(parsedData.products) ? parsedData.products.length : 0,
    customers: Array.isArray(parsedData.customers) ? parsedData.customers.length : 0,
    orders: Array.isArray(parsedData.orders) ? parsedData.orders.length : 0,
    conversations: Array.isArray(parsedData.conversations) ? parsedData.conversations.length : 0,
    callLogs: Array.isArray(parsedData.callLogs) ? parsedData.callLogs.length : 0,
    payments: Array.isArray(parsedData.payments) ? parsedData.payments.length : 0,
    webhookLogs: Array.isArray(parsedData.webhookLogs) ? parsedData.webhookLogs.length : 0,
    quickReplies: Array.isArray(parsedData.quickReplies) ? parsedData.quickReplies.length : 0,
  };

  // Run the bulk transaction to write everything into SQLite database
  saveAll(parsedData);

  return {
    success: true,
    message: "One-time database migration from db.json to SQLite completed successfully!",
    sourcePath: jsonPath,
    migratedCounts: counts
  };
}

// Support command-line execution (e.g. npx tsx server/migrate.ts)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("migrate.ts")) {
  try {
    console.log("[Migration Engine] Triggering offline migration from db.json -> SQLite...");
    const report = migrateJsonToSqlite();
    console.log(JSON.stringify(report, null, 2));
  } catch (err: any) {
    console.error("[Migration Engine] Script execution failed:", err.message);
    process.exit(1);
  }
}
