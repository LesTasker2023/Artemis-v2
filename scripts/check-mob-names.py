#!/usr/bin/env python3
"""Check mob names in both tables to understand the naming format"""

import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / 'data' / 'entropia.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('=== MOBS TABLE (Original Data) ===')
cursor.execute("SELECT DISTINCT name FROM mobs WHERE name LIKE '%Foul%' ORDER BY name LIMIT 10")
for row in cursor.fetchall():
    print(f'  - {row[0]}')

print('\n=== NEXUS_SPAWNS TABLE (API Data) ===')
cursor.execute("SELECT DISTINCT name FROM nexus_spawns WHERE name LIKE '%Foul%' ORDER BY name LIMIT 10")
for row in cursor.fetchall():
    print(f'  - {row[0]}')

print('\n=== Sample from each table ===')
print('\nMobs table sample:')
cursor.execute("SELECT name FROM mobs LIMIT 5")
for row in cursor.fetchall():
    print(f'  - {row[0]}')

print('\nNexus spawns sample:')
cursor.execute("SELECT name FROM nexus_spawns LIMIT 5")
for row in cursor.fetchall():
    print(f'  - {row[0]}')

conn.close()
