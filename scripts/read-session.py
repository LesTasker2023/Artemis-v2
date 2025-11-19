import sqlite3
import json
import os
from pathlib import Path

# Get database path
db_path = Path(os.environ['APPDATA']) / 'artemis-v2' / 'artemis.db'
print(f'📂 Database: {db_path}\n')

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# Get most recent session
cursor.execute('''
    SELECT id, name, loadout_id, duration, stats
    FROM sessions 
    ORDER BY start_time DESC 
    LIMIT 1
''')

session = cursor.fetchone()
if not session:
    print('No sessions found')
    conn.close()
    exit()

sid, name, loadout_id, duration, stats_json = session
print(f'📊 Most Recent Session: {name}')
print(f'  ID: {sid}')
print(f'  Loadout: {loadout_id or "❌ NONE"}')
print(f'  Duration: {duration}s')

# Parse stats if available
if stats_json:
    stats = json.loads(stats_json)
    print(f'\n📈 Stats (from DB):')
    print(f'  Kills: {stats.get("totalKills", 0)}')
    print(f'  Loot Value: {stats.get("totalLootTTValue", 0):.2f} PED')
    print(f'  Ammo Cost: {stats.get("totalAmmoCost", 0):.2f} PED')
    print(f'  Profit: {stats.get("profit", 0):.2f} PED')
else:
    print('\n⚠️ No stats in database!')

# Count events by type
cursor.execute('''
    SELECT type, COUNT(*) 
    FROM events 
    WHERE session_id = ? 
    GROUP BY type
    ORDER BY COUNT(*) DESC
''', (sid,))

print(f'\n📝 Event Breakdown:')
total_events = 0
gps_count = 0
for etype, count in cursor.fetchall():
    print(f'  {etype}: {count}')
    total_events += count
    if etype == 'GPS_UPDATE':
        gps_count = count

print(f'\n📍 Total Events: {total_events}')
print(f'📍 GPS Events: {gps_count}')

# Show sample GPS events
if gps_count > 0:
    cursor.execute('''
        SELECT payload 
        FROM events 
        WHERE session_id = ? AND type = "GPS_UPDATE"
        LIMIT 3
    ''', (sid,))
    
    print(f'\n🗺️ Sample GPS Events:')
    for i, row in enumerate(cursor.fetchall(), 1):
        payload = json.loads(row[0])
        loc = payload.get('location', {})
        print(f'  GPS {i}: lon={loc.get("lon", 0)}, lat={loc.get("lat", 0)}')

conn.close()
print('\n✅ Done!')

# First, check the schema
cursor.execute("PRAGMA table_info(sessions)")
columns = cursor.fetchall()
print("📋 Sessions table columns:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")
print()

# Check events table
cursor.execute("PRAGMA table_info(events)")
event_cols = cursor.fetchall()
print("📋 Events table columns:")
for col in event_cols:
    print(f"  {col[1]} ({col[2]})")
print()

# Get recent sessions
cursor.execute("""
    SELECT id, name, loadout_id, duration
    FROM sessions 
    ORDER BY start_time DESC 
    LIMIT 3
""")

sessions = cursor.fetchall()
print(f'📊 Found {len(sessions)} sessions\n')

for session in sessions:
    sid, name, loadout_id, duration = session
    print(f'Session: {name}')
    print(f'  ID: {sid}')
    print(f'  Loadout: {loadout_id or "❌ NONE"}')
    print(f'  Duration: {duration}s')
    
    # Count events
    cursor.execute('SELECT COUNT(*) FROM events WHERE session_id = ?', (sid,))
    event_count = cursor.fetchone()[0]
    print(f'  Events: {event_count}')
    
    # Event breakdown
    cursor.execute('''
        SELECT type, COUNT(*) 
        FROM events 
        WHERE session_id = ? 
        GROUP BY type
    ''', (sid,))
    
    for etype, count in cursor.fetchall():
        print(f'    {etype}: {count}')
    
    # Check for loot
    cursor.execute('''
        SELECT payload 
        FROM events 
        WHERE session_id = ? AND type = "LOOT_RECEIVED"
        LIMIT 1
    ''', (sid,))
    
    loot = cursor.fetchone()
    if loot:
        payload = json.loads(loot[0])
        print(f'  💰 Sample loot: {payload.get("totalTTValue", 0)} PED')
    
    print()

# Check the loadout that's being used
cursor.execute('''
    SELECT id, name, costs, use_manual_cost, manual_cost_override
    FROM loadouts
    LIMIT 1
''')

loadout = cursor.fetchone()
if loadout:
    lid, lname, costs_json, use_manual, manual_override = loadout
    print(f'📦 Loadout: {lname}')
    print(f'  ID: {lid}')
    print(f'  Use manual cost: {use_manual}')
    print(f'  Manual override: {manual_override}')
    if costs_json:
        costs = json.loads(costs_json)
        print(f'  Total per shot: {costs.get("totalPerShot", 0)} PED')
        print(f'  Manual override in JSON: {costs.get("manualCostOverride")} PED')

conn.close()
print('\n✅ Done!')
