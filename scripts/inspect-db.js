/**
 * Quick script to inspect database contents
 */
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database location
const dbPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "artemis-v2",
  "artemis.db"
);

console.log(`\n📊 ARTEMIS Database Inspection`);
console.log(`Location: ${dbPath}\n`);

try {
  const db = new Database(dbPath, { readonly: true });

  // Get all tables
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  console.log(`📋 Tables Found: ${tables.map((t) => t.name).join(", ")}\n`);

  // Check each table
  for (const table of tables) {
    const tableName = table.name;
    const count = db
      .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
      .get();
    console.log(`\n🔹 ${tableName.toUpperCase()}`);
    console.log(`   Records: ${count.count}`);

    if (count.count > 0) {
      // Show schema
      const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
      console.log(`   Columns: ${schema.map((c) => c.name).join(", ")}`);

      // Show sample data (first 3 rows)
      const sample = db.prepare(`SELECT * FROM ${tableName} LIMIT 3`).all();
      console.log(`   Sample Data:`);
      sample.forEach((row, i) => {
        console.log(
          `   ${i + 1}. ${JSON.stringify(row, null, 2).split("\n").join("\n      ")}`
        );
      });
    }
  }

  db.close();
  console.log(`\n✅ Database inspection complete\n`);
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  if (error.message.includes("ENOENT")) {
    console.log(
      "\n💡 Database file does not exist yet. It will be created on first use."
    );
  }
}
