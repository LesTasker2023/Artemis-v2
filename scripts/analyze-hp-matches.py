#!/usr/bin/env python3
"""Check what mobs should match the HP values we're seeing"""

import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / 'data' / 'entropia.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check what mobs could match the HP values we saw
test_hp_values = [58, 228, 135, 75, 161, 162, 200, 107, 155, 137, 453, 46, 121, 198, 56, 129, 122, 142]

print('=== HP Match Analysis ===\n')

for hp in sorted(set(test_hp_values)):
    print(f'HP: {hp}')
    
    # Find mobs within ±20% HP range
    min_hp = hp * 0.8
    max_hp = hp * 1.2
    
    cursor.execute("""
        SELECT name, hp, maturity, planet
        FROM mobs
        WHERE hp BETWEEN ? AND ?
          AND planet = 'Calypso'
        ORDER BY ABS(hp - ?) ASC
        LIMIT 5
    """, (min_hp, max_hp, hp))
    
    matches = cursor.fetchall()
    if matches:
        print(f'  Possible matches (±20% = {min_hp:.0f}-{max_hp:.0f} HP):')
        for name, mob_hp, maturity, planet in matches:
            print(f'    - {name} ({mob_hp} HP)')
    else:
        print(f'  No matches found!')
    print()

conn.close()
