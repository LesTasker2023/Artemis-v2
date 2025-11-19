// Quick script to read session data from SQLite database
import Database from "better-sqlite3";
import path from "path";
import os from "os";

// Get database path
const dbPath = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "artemis-v2",
  "artemis.db"
);
console.log(`📂 Database path: ${dbPath}`);

try {
  const db = new Database(dbPath, { readonly: true });

  // Get all sessions
  const sessions = db
    .prepare(
      `
    SELECT id, name, user_id, start_time, end_time, duration, 
           loadout_id, stats, version, created_at
    FROM sessions 
    ORDER BY start_time DESC 
    LIMIT 5
  `
    )
    .all();

  console.log(`\n📊 Found ${sessions.length} sessions:\n`);

  sessions.forEach((session, i) => {
    console.log(`\n════════ Session ${i + 1} ════════`);
    console.log(`Name: ${session.name}`);
    console.log(`ID: ${session.id}`);
    console.log(`User: ${session.user_id}`);
    console.log(`Loadout ID: ${session.loadout_id || "NONE ⚠️"}`);
    console.log(
      `Duration: ${Math.floor(session.duration / 60)}m ${session.duration % 60}s`
    );
    console.log(`Version: ${session.version}`);

    // Parse stats JSON
    if (session.stats) {
      const stats = JSON.parse(session.stats);
      console.log("\n📈 Stats:");
      console.log(`  Total Shots: ${stats.totalShots || 0}`);
      console.log(`  Total Hits: ${stats.totalHits || 0}`);
      console.log(`  Accuracy: ${((stats.accuracy || 0) * 100).toFixed(1)}%`);
      console.log(`  Total Kills: ${stats.totalKills || 0}`);
      console.log(
        `  Total Damage: ${(stats.totalDamageDealt || 0).toFixed(0)} HP`
      );
      console.log(
        `  Total Loot Value: ${(stats.totalLootTTValue || 0).toFixed(2)} PED`
      );
      console.log(
        `  Total Ammo Cost: ${(stats.totalAmmoCost || 0).toFixed(2)} PED`
      );
      console.log(`  Profit: ${(stats.profit || 0).toFixed(2)} PED`);
      console.log(
        `  Return Rate: ${((stats.returnRate || 0) * 100).toFixed(1)}%`
      );
    }

    // Get event count
    const eventCount = db
      .prepare("SELECT COUNT(*) as count FROM events WHERE session_id = ?")
      .get(session.id);
    console.log(`\n📝 Events: ${eventCount.count}`);

    // Get event types breakdown
    const eventTypes = db
      .prepare(
        `
      SELECT type, COUNT(*) as count 
      FROM events 
      WHERE session_id = ? 
      GROUP BY type
    `
      )
      .all(session.id);

    if (eventTypes.length > 0) {
      console.log("Event breakdown:");
      eventTypes.forEach((et) => {
        console.log(`  ${et.type}: ${et.count}`);
      });
    }

    // Check for LOOT_RECEIVED events
    const lootEvents = db
      .prepare(
        `
      SELECT payload 
      FROM events 
      WHERE session_id = ? AND type = 'LOOT_RECEIVED'
      LIMIT 3
    `
      )
      .all(session.id);

    if (lootEvents.length > 0) {
      console.log(`\n💰 Sample Loot Events (${lootEvents.length} total):`);
      lootEvents.forEach((le, i) => {
        const payload = JSON.parse(le.payload);
        console.log(`  Loot ${i + 1}: ${payload.totalTTValue} PED`);
      });
    }
  });

  db.close();
  console.log("\n✅ Done!\n");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
