// Just dump the SQL to run manually
const queries = [
  "-- Spawns near (78648, 67939):",
  "SELECT mob_name, center_lon, center_lat, ROUND(SQRT((center_lon - 78648) * (center_lon - 78648) + (center_lat - 67939) * (center_lat - 67939))) as distance FROM spawns WHERE ROUND(SQRT((center_lon - 78648) * (center_lon - 78648) + (center_lat - 67939) * (center_lat - 67939))) < 1000 ORDER BY distance LIMIT 20;",
  "",
  "-- All Proteron spawns:",
  "SELECT mob_name, center_lon, center_lat FROM spawns WHERE mob_name LIKE '%Proteron%' LIMIT 50;",
  "",
  "-- Count all spawns:",
  "SELECT COUNT(*) as total_spawns FROM spawns;",
  "",
  "-- Sample spawns:",
  "SELECT mob_name FROM spawns LIMIT 10;",
];

console.log("\n" + queries.join("\n"));
console.log("\n\nTo check spawns in Artemis, open DevTools console and run:");
console.log(
  "window.electron.entropiaDB.findSpawnsNear({ lon: 78648, lat: 67939 }, 1000).then(r => console.log(r.data));"
);
