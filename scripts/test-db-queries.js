/**
 * Test entropia.db queries directly
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "entropia.db");
const db = new Database(dbPath, { readonly: true });

console.log("\n🔮 Testing Entropia Database Queries\n");

// Test 1: Find Atrox by health
console.log(
  "Test 1: Find mobs with HP between 600-700 (should include Atrox Young)"
);
const healthQuery = db.prepare(`
  SELECT name, maturity, hp, species, planet 
  FROM mobs 
  WHERE hp BETWEEN 600 AND 700 
  AND planet = 'Calypso'
  ORDER BY ABS(hp - 650) ASC
  LIMIT 5
`);
const healthResults = healthQuery.all();
console.log(`Found ${healthResults.length} mobs:`);
healthResults.forEach((mob) => {
  console.log(
    `  - ${mob.name} (${mob.maturity}): ${mob.hp} HP [${mob.species}]`
  );
});

// Test 2: Find spawn locations near your hunting spot
console.log("\n\nTest 2: Find spawn locations near (78872, 67998)");
const spawnQuery = db.prepare(`
  SELECT mob_name, latitude, longitude, density
  FROM mob_spawns
  WHERE planet = 'Calypso'
  AND latitude BETWEEN 75000 AND 82000
  AND longitude BETWEEN 65000 AND 71000
  ORDER BY latitude DESC, longitude DESC
  LIMIT 10
`);
const spawnResults = spawnQuery.all();
console.log(`Found ${spawnResults.length} spawn locations:`);
spawnResults.forEach((spawn) => {
  const distance = Math.sqrt(
    Math.pow(spawn.longitude - 67998, 2) + Math.pow(spawn.latitude - 78872, 2)
  );
  console.log(
    `  - ${spawn.mob_name} at (${spawn.latitude}, ${spawn.longitude}) - ${distance.toFixed(0)}m away`
  );
});

// Test 3: Cross-reference - mobs with matching health AND spawn near location
console.log(
  "\n\nTest 3: Cross-reference - 650 HP + spawns near (78872, 67998)"
);

// Get spawn mobs in area
const nearbyMobs = spawnResults.map((s) => s.mob_name);
const uniqueMobs = [...new Set(nearbyMobs)];

if (uniqueMobs.length > 0) {
  const placeholders = uniqueMobs.map(() => "?").join(",");
  const crossQuery = db.prepare(`
    SELECT name, maturity, hp, species 
    FROM mobs 
    WHERE name IN (${placeholders})
    AND hp BETWEEN 600 AND 700
    ORDER BY ABS(hp - 650) ASC
  `);
  const crossResults = crossQuery.all(...uniqueMobs);

  console.log(
    `Found ${crossResults.length} mobs that match BOTH health AND location:`
  );
  crossResults.forEach((mob) => {
    console.log(
      `  ✅ ${mob.name} ${mob.maturity}: ${mob.hp} HP [${mob.species}]`
    );
  });
}

// Test 4: Get loot table for identified mob
console.log("\n\nTest 4: Get loot table for Atrox");
const lootQuery = db.prepare(`
  SELECT name, maturity, loot_table 
  FROM mobs 
  WHERE species = 'Atrox' 
  AND maturity = 'Young'
  LIMIT 1
`);
const lootResult = lootQuery.get();
if (lootResult) {
  console.log(`${lootResult.name} ${lootResult.maturity} drops:`);
  try {
    const lootTable = JSON.parse(lootResult.loot_table);
    lootTable.slice(0, 10).forEach((item) => {
      console.log(`  - ${item.name} (${item.frequency || "Unknown"})`);
    });
    if (lootTable.length > 10) {
      console.log(`  ... and ${lootTable.length - 10} more items`);
    }
  } catch (e) {
    console.log("  (No loot data)");
  }
}

db.close();
console.log("\n✅ Database query tests complete!\n");
