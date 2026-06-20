import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Initialize environment variables from .env
dotenv.config();

const BUNDLED_DB_PATHS = [
  path.join(process.cwd(), "db.json"),
  path.join(process.cwd(), "api", "db.json"),
  path.join(process.cwd(), "api/db.json"),
];

function getDbJsonPath(): string {
  for (const p of BUNDLED_DB_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(process.cwd(), "db.json");
}

export async function migrateJsonToMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("\n[Migration Error] MONGODB_URI is not defined in your environment/ .env file!");
    console.log("Please define MONGODB_URI in your .env or AI Studio Settings menu to proceed.");
    return { success: false, error: "MONGODB_URI is missing" };
  }

  const jsonPath = getDbJsonPath();
  if (!fs.existsSync(jsonPath)) {
    console.error(`\n[Migration Error] Current JSON-based local state file not found at: ${jsonPath}`);
    return { success: false, error: "Source db.json file not found" };
  }

  console.log(`[Migration Engine] Found local JSON-based state at: ${jsonPath}`);
  let rawData: string;
  try {
    rawData = fs.readFileSync(jsonPath, "utf-8");
  } catch (err: any) {
    console.error("[Migration Error] Failed to read db.json file:", err.message);
    return { success: false, error: err.message };
  }

  let dbData: any;
  try {
    dbData = JSON.parse(rawData);
  } catch (err: any) {
    console.error("[Migration Error] Failed to parse db.json file:", err.message);
    return { success: false, error: err.message };
  }

  console.log("[Migration Engine] Successfully parsed db.json data.");
  console.log("[Migration Engine] Connecting to MongoDB Atlas cluster...");

  const client = new MongoClient(uri);

  try {
    await client.connect();
    // Defaulting to "vedic_ghee_db" database name, or parsing from URI if preferred
    const mongoDb = client.db("vedic_ghee_db");
    console.log("[Migration Engine] Connected to MongoDB database: vedic_ghee_db");

    // Define migration mappings
    // format: { sourceJSONKey: databaseCollectionName }
    const migrations = [
      { key: "products", coll: "products", label: "Products" },
      { key: "customers", coll: "customers", label: "Customers" },
      { key: "orders", coll: "orders", label: "Orders" },
      { key: "conversations", coll: "conversations", label: "Conversations" },
      { key: "callLogs", coll: "call_logs", label: "Call Logs" },
      { key: "payments", coll: "payments", label: "Payments" },
      { key: "webhookLogs", coll: "webhook_logs", label: "Webhook Logs" },
      { key: "quickReplies", coll: "quick_replies", label: "Quick Replies" },
    ];

    const stats: Record<string, number> = {};

    for (const item of migrations) {
      const records = dbData[item.key];
      const collection = mongoDb.collection(item.coll);

      if (Array.isArray(records) && records.length > 0) {
        console.log(`[Migration] Migrating ${records.length} records to collection: "${item.coll}" (${item.label})...`);
        
        // Drop collection to perform a fresh seeded load
        try {
          await collection.deleteMany({});
        } catch (e) {
          // If the collection doesn't exist yet, ignore
        }

        // Insert fresh records
        const result = await collection.insertMany(records);
        stats[item.label] = result.insertedCount;
        console.log(`[Migration] Successfully wrote ${result.insertedCount} documents for ${item.label}.`);
      } else {
        stats[item.label] = 0;
        console.log(`[Migration] No records found or parsed for ${item.label} (source key: "${item.key}").`);
      }
    }

    // Migrate prompts object if present
    const prompts = dbData.prompts;
    if (prompts && typeof prompts === "object") {
      const collection = mongoDb.collection("prompts");
      console.log(`[Migration] Migrating Prompts configuration settings...`);
      await collection.deleteMany({});
      await collection.replaceOne({ id: 1 }, { ...prompts, id: 1 }, { upsert: true });
      stats["Prompts Configuration"] = 1;
      console.log("[Migration] Successfully upserted Prompts settings.");
    } else {
      stats["Prompts Configuration"] = 0;
    }

    console.log("\n=======================================================");
    console.log("   MONGODB ATLAS MIGRATION FINISHED SUCCESSFULLY!      ");
    console.log("=======================================================");
    console.log("Migrated collection detail stats:");
    console.log(JSON.stringify(stats, null, 2));
    console.log("=======================================================\n");

    return {
      success: true,
      message: "Data migrated successfully from db.json to MongoDB Atlas cluster!",
      stats,
    };
  } catch (err: any) {
    console.error("\n[Migration Error] Failed to complete MongoDB migration:", err.message);
    return { success: false, error: err.message };
  } finally {
    try {
      await client.close();
    } catch (e) {}
  }
}

// Runnable CLI support
const isCLI = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("db-migration.ts");
if (isCLI) {
  console.log("[Migration CLI] Bootstrapping MongoDB Atlas migration engine...");
  migrateJsonToMongo()
    .then((res) => {
      if (res.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("[Migration CLI] Unexpected failure:", err);
      process.exit(1);
    });
}
