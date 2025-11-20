// Import mob spawn data from Entropia Nexus API into entropia.db
// This will replace old Foul spawn data with complete spawn database

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "data", "entropia.db");
const db = new Database(dbPath);

// Mob spawn data from API
const apiUrl = "https://api.entropianexus.com/mobspawns";

console.log("[Import] Fetching spawn data from Entropia Nexus API...");

// Fetch data
const response = await fetch(apiUrl);
if (!response.ok) {
  console.error(
    `[Import] Failed to fetch: ${response.status} ${response.statusText}`
  );
  process.exit(1);
}

const spawns = await response.json();
console.log(`[Import] Received ${spawns.length} spawn records`);

// Create table if doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS nexus_spawns (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    planet TEXT NOT NULL,
    type TEXT,
    shape TEXT,
    center_lon REAL,
    center_lat REAL,
    density TEXT,
    is_shared INTEGER,
    is_event INTEGER,
    notes TEXT,
    data_json TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

console.log("[Import] Created/verified nexus_spawns table");

// Begin transaction
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO nexus_spawns (
    id, name, planet, type, shape, center_lon, center_lat,
    density, is_shared, is_event, notes, data_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((spawns) => {
  let inserted = 0;
  let skipped = 0;

  for (const spawn of spawns) {
    try {
      const props = spawn.Properties || {};
      const planet = spawn.Planet?.Name || "Unknown";
      const coords = props.Coordinates || {};

      insertStmt.run(
        spawn.Id,
        spawn.Name || "Unknown Spawn",
        planet,
        props.Type || null,
        props.Shape || null,
        coords.Longitude || null,
        coords.Latitude || null,
        props.Density || null,
        props.IsShared ? 1 : 0,
        props.IsEvent ? 1 : 0,
        props.Notes || null,
        JSON.stringify(spawn)
      );
      inserted++;

      if (inserted % 100 === 0) {
        console.log(`[Import] Progress: ${inserted} records inserted...`);
      }
    } catch (err) {
      console.warn(
        `[Import] Failed to insert spawn ${spawn.Id}: ${err.message}`
      );
      skipped++;
    }
  }

  return { inserted, skipped };
});

console.log("[Import] Starting bulk insert...");
const result = insertMany(spawns);

console.log(`\n[Import] ✅ Complete!`);
console.log(`  - Inserted: ${result.inserted} spawn records`);
console.log(`  - Skipped: ${result.skipped} records (errors)`);

// Query for Foul spawns on Calypso
console.log("\n[Import] Checking for Foul spawn locations on Calypso...");
const foulSpawns = db
  .prepare(
    `
  SELECT id, name, planet, center_lon, center_lat, density, notes
  FROM nexus_spawns
  WHERE planet = 'Calypso' 
    AND name LIKE '%Foul%'
  ORDER BY name
`
  )
  .all();

if (foulSpawns.length > 0) {
  console.log(`\n[Import] Found ${foulSpawns.length} Foul spawn locations:`);
  foulSpawns.forEach((spawn) => {
    console.log(
      `  - ${spawn.name} at (${spawn.center_lon}, ${spawn.center_lat}) [${spawn.density || "unknown"} density]`
    );
  });
} else {
  console.log("[Import] ⚠️  No Foul spawns found in Nexus data");
}

// Query near user's hunting location (79085, 67537)
console.log(
  "\n[Import] Checking spawns near your hunting area (79085, 67537)..."
);
const nearbySpawns = db
  .prepare(
    `
  SELECT 
    id, name, planet, center_lon, center_lat,
    ROUND(SQRT(
      (center_lon - 79085) * (center_lon - 79085) + 
      (center_lat - 67537) * (center_lat - 67537)
    )) as distance
  FROM nexus_spawns
  WHERE planet = 'Calypso'
    AND center_lon IS NOT NULL
    AND center_lat IS NOT NULL
  ORDER BY distance
  LIMIT 10
`
  )
  .all();

console.log("\n[Import] Top 10 closest spawns to (79085, 67537):");
nearbySpawns.forEach((spawn) => {
  console.log(
    `  - ${spawn.name} at (${spawn.center_lon}, ${spawn.center_lat}) - ${spawn.distance}m away`
  );
});

db.close();
console.log("\n[Import] Database connection closed");
