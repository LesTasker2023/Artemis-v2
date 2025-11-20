import Database from "better-sqlite3";
const db = new Database("./data/entropia.db", { readonly: true });

const lon = 79085;
const lat = 67537;

console.log(`\n🔍 Checking spawns near your location: (${lon}, ${lat})\n`);

// Find closest spawns
const spawns = db
  .prepare(
    `
  SELECT 
    mob_name, 
    latitude, 
    longitude,
    density,
    SQRT(POWER(longitude - ?, 2) + POWER(latitude - ?, 2)) as distance
  FROM mob_spawns 
  WHERE planet = 'Calypso'
  ORDER BY distance 
  LIMIT 20
`
  )
  .all(lon, lat);

console.log("📍 Closest 20 spawns:\n");
spawns.forEach((s) => {
  console.log(
    `  ${s.mob_name.padEnd(35)} ${Math.round(s.distance).toString().padStart(5)}m  (${s.longitude}, ${s.latitude})  [${s.density}]`
  );
});

// Check specifically for Foul
console.log('\n\n🦊 Looking for "Foul" spawns on Calypso:\n');
const foulSpawns = db
  .prepare(
    `
  SELECT mob_name, latitude, longitude, density
  FROM mob_spawns 
  WHERE planet = 'Calypso' AND mob_name LIKE '%Foul%'
`
  )
  .all();

if (foulSpawns.length === 0) {
  console.log("  ❌ NO FOUL SPAWNS FOUND IN DATABASE\n");
} else {
  foulSpawns.forEach((s) => {
    const dist = Math.sqrt(
      Math.pow(s.longitude - lon, 2) + Math.pow(s.latitude - lat, 2)
    );
    console.log(
      `  ${s.mob_name.padEnd(35)} ${Math.round(dist).toString().padStart(5)}m from you  (${s.longitude}, ${s.latitude})`
    );
  });
}

// Check what mob data exists for Foul
console.log("\n\n📊 Foul mob data in database:\n");
const foulMobs = db
  .prepare(
    `
  SELECT name, maturity, hp, level, planet, species
  FROM mobs
  WHERE name LIKE '%Foul%'
  ORDER BY hp
`
  )
  .all();

if (foulMobs.length === 0) {
  console.log("  ❌ NO FOUL MOBS FOUND IN DATABASE\n");
} else {
  foulMobs.forEach((m) => {
    console.log(
      `  ${m.name.padEnd(30)} ${m.maturity.padEnd(15)} ${m.hp.toString().padStart(5)} HP  [${m.planet}]`
    );
  });
}

db.close();
