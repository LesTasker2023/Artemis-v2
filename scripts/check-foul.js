/**
 * Check Foul spawn locations vs your hunting spot
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "entropia.db");
const db = new Database(dbPath, { readonly: true });

const huntingLat = 78872;
const huntingLon = 67998;

console.log(
  `\n🔍 Checking Foul spawn locations vs your position (${huntingLat}, ${huntingLon})\n`
);

// Find Foul spawns
const foulSpawnsQuery = db.prepare(`
  SELECT mob_name, latitude, longitude, planet, density
  FROM mob_spawns
  WHERE mob_name LIKE '%Foul%'
  AND planet = 'Calypso'
`);

const foulSpawns = foulSpawnsQuery.all();
console.log(`Found ${foulSpawns.length} Foul spawn locations on Calypso:\n`);

const spawnsWithDistance = foulSpawns
  .map((spawn) => ({
    ...spawn,
    distance: Math.sqrt(
      Math.pow(spawn.longitude - huntingLon, 2) +
        Math.pow(spawn.latitude - huntingLat, 2)
    ),
  }))
  .sort((a, b) => a.distance - b.distance);

console.log("Foul spawns sorted by distance from you:");
spawnsWithDistance.slice(0, 10).forEach((spawn) => {
  console.log(
    `  ${spawn.distance.toFixed(0)}m - ${spawn.mob_name} at (${spawn.latitude}, ${spawn.longitude})`
  );
});

// Get Foul HP data
console.log("\n\nFoul HP ranges:");
const foulDataQuery = db.prepare(`
  SELECT name, maturity, hp, level, species
  FROM mobs
  WHERE species = 'Foul'
  ORDER BY hp ASC
`);

const foulData = foulDataQuery.all();
foulData.forEach((mob) => {
  console.log(
    `  ${mob.maturity.padEnd(15)} ${mob.hp.toString().padStart(5)} HP (Level ${mob.level})`
  );
});

// Check if Feffoid might be misidentified
console.log("\n\nFeffoid HP ranges:");
const feffoidDataQuery = db.prepare(`
  SELECT name, maturity, hp, level, species
  FROM mobs
  WHERE species = 'Feffoid'
  ORDER BY hp ASC
`);

const feffoidData = feffoidDataQuery.all();
feffoidData.forEach((mob) => {
  console.log(
    `  ${mob.maturity.padEnd(15)} ${mob.hp.toString().padStart(5)} HP (Level ${mob.level})`
  );
});

console.log("\n\n🤔 Analysis:");
console.log("Your kills averaged ~650 HP.");
console.log("Foul Young: 230-310 HP");
console.log("Foul Mature: 340-420 HP");
console.log("Feffoid Bandit: 630 HP ← Matches your 650 HP kills!");
console.log("\nEither:");
console.log(
  "1. Spawn data is inaccurate (Foul spawns not in database for your area)"
);
console.log("2. You were actually hunting Feffoids, not Foul");
console.log(
  "3. Your damage calculation is off (maybe you were killing multiple Fouls?)"
);

db.close();
console.log("\n");
