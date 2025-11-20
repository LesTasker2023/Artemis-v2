#!/usr/bin/env python3
"""Test the mob name parsing logic"""

import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / 'data' / 'entropia.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('=== Testing Spawn Name Parsing ===\n')

# Get the Foul spawn near user's location (269m away)
cursor.execute("""
    SELECT name, center_lon, center_lat,
           ROUND(SQRT(
               (center_lon - 79085) * (center_lon - 79085) + 
               (center_lat - 67537) * (center_lat - 67537)
           )) as distance
    FROM nexus_spawns
    WHERE planet = 'Calypso'
      AND name LIKE '%Foul%'
    ORDER BY distance
    LIMIT 5
""")

print('Closest Foul spawns:')
for row in cursor.fetchall():
    name, lon, lat, dist = row
    print(f'  {dist}m: {name}')
    print(f'       at ({lon}, {lat})')
    print()

# Check what mob names exist in mobs table
print('\n=== Mob Names in Database ===')
cursor.execute("SELECT DISTINCT name FROM mobs WHERE name LIKE '%Foul%' AND planet = 'Calypso' ORDER BY name")
mob_names = [r[0] for r in cursor.fetchall()]
print('Available Foul mob names:')
for name in mob_names:
    print(f'  - {name}')

conn.close()
