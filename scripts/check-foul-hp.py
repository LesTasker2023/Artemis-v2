#!/usr/bin/env python3
"""Check HP values for Foul mobs in database"""

import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / 'data' / 'entropia.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('=== Foul Mob HP Values ===\n')

cursor.execute("""
    SELECT name, hp, maturity, planet
    FROM mobs
    WHERE name LIKE '%Foul%' AND planet = 'Calypso'
    ORDER BY hp
""")

for name, hp, maturity, planet in cursor.fetchall():
    print(f'{name}: {hp} HP')

conn.close()
