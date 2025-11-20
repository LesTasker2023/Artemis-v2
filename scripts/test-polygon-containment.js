/**
 * Test polygon containment logic
 * Checks if user location (78648, 67939) is inside Proteron spawn polygon
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "data", "entropia.db");
const db = new Database(dbPath, { readonly: true });

// User's location
const userLocation = { lon: 78648, lat: 67939 };

/**
 * Ray-casting algorithm for point-in-polygon
 */
function isPointInPolygon(point, vertices) {
  if (!vertices || vertices.length < 6) {
    return false;
  }

  let inside = false;
  const x = point.lon;
  const y = point.lat;

  for (let i = 0, j = vertices.length - 2; i < vertices.length; j = i, i += 2) {
    const xi = vertices[i];
    const yi = vertices[i + 1];
    const xj = vertices[j];
    const yj = vertices[j + 1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate Euclidean distance
 */
function calculateDistance(p1, p2) {
  const dx = p1.lon - p2.lon;
  const dy = p1.lat - p2.lat;
  return Math.sqrt(dx * dx + dy * dy);
}

console.log("=== Polygon Containment Test ===\n");
console.log(`User location: (${userLocation.lon}, ${userLocation.lat})`);
console.log("");

// Query all spawns with polygon data
const stmt = db.prepare(`
  SELECT 
    name,
    center_lon,
    center_lat,
    data_json
  FROM nexus_spawns
  WHERE data_json IS NOT NULL
    AND center_lon IS NOT NULL
    AND center_lat IS NOT NULL
`);

const spawns = stmt.all();

// Find spawns containing the user's location
const containingSpawns = [];
const nearbySpawns = [];

for (const spawn of spawns) {
  const distance = calculateDistance(userLocation, {
    lon: spawn.center_lon,
    lat: spawn.center_lat,
  });

  let vertices;
  try {
    const data = JSON.parse(spawn.data_json);
    vertices = data.vertices;
  } catch (err) {
    continue;
  }

  const inside = isPointInPolygon(userLocation, vertices);

  if (inside) {
    containingSpawns.push({ ...spawn, distance, inside: true });
  } else if (distance < 2000) {
    nearbySpawns.push({ ...spawn, distance, inside: false });
  }
}

// Display results
if (containingSpawns.length > 0) {
  console.log(
    `✓ User is INSIDE ${containingSpawns.length} spawn polygon(s):\n`
  );

  for (const spawn of containingSpawns) {
    console.log(`  - ${spawn.name}`);
    console.log(`    Center: (${spawn.center_lon}, ${spawn.center_lat})`);
    console.log(`    Distance to center: ${spawn.distance.toFixed(0)}m`);

    const data = JSON.parse(spawn.data_json);
    console.log(
      `    Polygon vertices: ${data.vertices?.length / 2 || 0} points`
    );
    console.log(`    Status: INSIDE BOUNDARY ✓`);
    console.log("");
  }
} else {
  console.log("✗ User is NOT inside any spawn polygon\n");
}

// Show nearby spawns
if (nearbySpawns.length > 0) {
  console.log(`Nearby spawns (within 2km, but outside boundaries):\n`);

  nearbySpawns.sort((a, b) => a.distance - b.distance);

  for (const spawn of nearbySpawns.slice(0, 5)) {
    console.log(`  - ${spawn.name}`);
    console.log(`    Center: (${spawn.center_lon}, ${spawn.center_lat})`);
    console.log(`    Distance to center: ${spawn.distance.toFixed(0)}m`);
    console.log("");
  }
}

// Test specific Proteron spawn
console.log("=== Proteron Spawn Check ===\n");

const proteronStmt = db.prepare(`
  SELECT 
    name,
    center_lon,
    center_lat,
    data_json
  FROM nexus_spawns
  WHERE name LIKE '%Proteron%'
    AND center_lon IS NOT NULL
    AND center_lat IS NOT NULL
`);

const proteronSpawns = proteronStmt.all();

console.log(`Found ${proteronSpawns.length} Proteron spawns:\n`);

for (const spawn of proteronSpawns) {
  const distance = calculateDistance(userLocation, {
    lon: spawn.center_lon,
    lat: spawn.center_lat,
  });

  let inside = false;
  let vertexCount = 0;

  try {
    const data = JSON.parse(spawn.data_json);
    if (data.vertices) {
      vertexCount = data.vertices.length / 2;
      inside = isPointInPolygon(userLocation, data.vertices);
    }
  } catch (err) {
    // Skip
  }

  console.log(`  - ${spawn.name}`);
  console.log(`    Center: (${spawn.center_lon}, ${spawn.center_lat})`);
  console.log(`    Distance: ${distance.toFixed(0)}m`);
  console.log(`    Polygon: ${vertexCount} vertices`);
  console.log(`    Inside: ${inside ? "✓ YES" : "✗ NO"}`);
  console.log("");
}

db.close();

console.log("=== Test Complete ===");
