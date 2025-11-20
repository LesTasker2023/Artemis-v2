/**
 * Find what mobs spawn EXACTLY at your hunting location
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "entropia.db");
const db = new Database(dbPath, { readonly: true });

const huntingLat = 78872;
const huntingLon = 67998;
const searchRadius = 5000; // 5km

console.log(
  `\n🎯 Finding mobs that spawn near (${huntingLat}, ${huntingLon})\n`
);

// Get ALL spawns and calculate distance
const allSpawnsQuery = db.prepare(`
  SELECT mob_name, latitude, longitude, planet, density
  FROM mob_spawns
  WHERE planet = 'Calypso'
`);

const allSpawns = allSpawnsQuery.all();

// Calculate distances
const spawnsWithDistance = allSpawns
  .map((spawn) => ({
    ...spawn,
    distance: Math.sqrt(
      Math.pow(spawn.longitude - huntingLon, 2) +
        Math.pow(spawn.latitude - huntingLat, 2)
    ),
  }))
  .filter((spawn) => spawn.distance <= searchRadius)
  .sort((a, b) => a.distance - b.distance);

console.log(
  `Found ${spawnsWithDistance.length} spawn points within ${searchRadius}m:\n`
);

const uniqueMobs = {};
spawnsWithDistance.forEach((spawn) => {
  if (!uniqueMobs[spawn.mob_name]) {
    uniqueMobs[spawn.mob_name] = [];
  }
  uniqueMobs[spawn.mob_name].push(spawn);
});

console.log("Mob species in your hunting area:");
Object.entries(uniqueMobs).forEach(([mobName, spawns]) => {
  const closest = spawns[0];
  console.log(
    `  - ${mobName}: ${spawns.length} spawn points, closest ${closest.distance.toFixed(0)}m away`
  );
});

// Now check HP ranges for these mobs
console.log(`\n\nHP ranges for mobs in this area:\n`);
const mobNames = Object.keys(uniqueMobs);
const placeholders = mobNames.map(() => "?").join(",");
const mobDataQuery = db.prepare(`
  SELECT name, maturity, hp, species, level
  FROM mobs
  WHERE name IN (${placeholders})
  ORDER BY species, hp ASC
`);

const mobData = mobDataQuery.all(...mobNames);
const bySpecies = {};
mobData.forEach((mob) => {
  if (!bySpecies[mob.species]) {
    bySpecies[mob.species] = [];
  }
  bySpecies[mob.species].push(mob);
});

Object.entries(bySpecies).forEach(([species, mobs]) => {
  console.log(`\n${species}:`);
  mobs.forEach((mob) => {
    console.log(
      `  ${mob.maturity.padEnd(15)} ${mob.hp.toString().padStart(5)} HP (Level ${mob.level})`
    );
  });
});

db.close();
console.log("\n✅ Analysis complete!\n");
