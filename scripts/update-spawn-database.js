/**
 * Updates the spawns database with comprehensive data from Entropia Nexus /areas API
 * This replaces the old /spawns endpoint data which was incomplete
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "..", "data", "entropia.db");

async function fetchSpawnAreas() {
  console.log("Fetching spawn areas from Entropia Nexus API...");
  const response = await fetch(
    "https://api.entropianexus.com/areas?Planet=Calypso"
  );

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const areas = await response.json();
  console.log(`✓ Fetched ${areas.length} spawn areas`);
  return areas;
}

function updateDatabase(areas) {
  console.log("\nOpening database...");
  const db = new Database(DB_PATH);

  try {
    // Start transaction
    db.exec("BEGIN TRANSACTION");

    // Clear old spawns data
    console.log("Clearing old nexus_spawns table...");
    db.exec("DELETE FROM nexus_spawns");

    // Prepare insert statement
    const insertStmt = db.prepare(`
      INSERT INTO nexus_spawns (
        id,
        name,
        planet,
        type,
        shape,
        center_lon,
        center_lat,
        data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;

    console.log("Inserting new spawn data...");

    for (const area of areas) {
      // Only process mob areas
      if (area.Properties?.Type !== "MobArea") {
        skipped++;
        continue;
      }

      const mobName = area.Name;
      const coords = area.Properties.Coordinates;
      const lon = coords?.Longitude;
      const lat = coords?.Latitude;

      if (!mobName || lon === undefined || lat === undefined) {
        skipped++;
        continue;
      }

      // Store full area data as JSON for polygon containment and other features
      const dataJson = JSON.stringify({
        vertices: area.Properties.Data?.vertices || [],
        shape: area.Properties.Shape || "Polygon",
        altitude: coords?.Altitude || 150,
      });

      insertStmt.run(
        area.Id,
        mobName,
        "Calypso",
        area.Properties.Type || "MobArea",
        area.Properties.Shape || "Polygon",
        lon,
        lat,
        dataJson
      );

      inserted++;

      if (inserted % 100 === 0) {
        process.stdout.write(`\r  Inserted ${inserted} spawns...`);
      }
    }

    process.stdout.write(`\r  Inserted ${inserted} spawns...`);
    console.log("\n");

    // Commit transaction
    db.exec("COMMIT");

    console.log("✓ Database updated successfully!");
    console.log(`  - Inserted: ${inserted} spawns`);
    console.log(`  - Skipped: ${skipped} non-mob areas`);

    // Show sample of Proteron spawns
    console.log("\nSample - Proteron spawns:");
    const proteron = db
      .prepare(
        `
      SELECT name, center_lon, center_lat 
      FROM nexus_spawns 
      WHERE name LIKE '%Proteron%'
      ORDER BY name
    `
      )
      .all();

    proteron.forEach((spawn) => {
      console.log(
        `  - ${spawn.name} at (${spawn.center_lon}, ${spawn.center_lat})`
      );
    });
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

async function main() {
  try {
    console.log("=== Entropia Spawn Database Update ===\n");

    const areas = await fetchSpawnAreas();
    updateDatabase(areas);

    console.log("\n✓ Update complete!");
    console.log("Restart ARTEMIS to use the new spawn data.");
  } catch (error) {
    console.error("\n✗ Error:", error.message);
    process.exit(1);
  }
}

main();
