/**
 * Inspect entropia.db contents
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "entropia.db");

console.log(`\n🔮 ENTROPIA DATABASE INSPECTION`);
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

      // Show sample data (first 5 rows)
      const sample = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all();
      console.log(`   Sample Data (first 5):`);
      sample.forEach((row, i) => {
        console.log(`   ${i + 1}. ${JSON.stringify(row)}`);
      });

      // Show stats for key columns
      if (tableName === "mobs") {
        const planets = db.prepare(`SELECT DISTINCT planet FROM mobs`).all();
        console.log(`   Planets: ${planets.map((p) => p.planet).join(", ")}`);

        const maturities = db
          .prepare(`SELECT DISTINCT maturity FROM mobs LIMIT 10`)
          .all();
        console.log(
          `   Maturities: ${maturities.map((m) => m.maturity).join(", ")}`
        );
      }

      if (tableName === "items") {
        const categories = db
          .prepare(
            `SELECT category, COUNT(*) as count FROM items GROUP BY category ORDER BY count DESC LIMIT 10`
          )
          .all();
        console.log(`   Top Categories:`);
        categories.forEach((c) => {
          console.log(`      ${c.category}: ${c.count} items`);
        });
      }

      if (tableName === "mob_spawns") {
        const planets = db
          .prepare(
            `SELECT planet, COUNT(*) as count FROM mob_spawns GROUP BY planet`
          )
          .all();
        console.log(`   Spawn Locations by Planet:`);
        planets.forEach((p) => {
          console.log(`      ${p.planet}: ${p.count} spawn points`);
        });
      }
    }
  }

  db.close();
  console.log(`\n✅ Database inspection complete\n`);
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  console.error(error.stack);
}
