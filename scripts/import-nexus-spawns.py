#!/usr/bin/env python3
"""
Import mob spawn data from Entropia Nexus API into entropia.db
This replaces old spawn data with complete spawn database from community API
"""

import sqlite3
import json
import urllib.request
import math
from pathlib import Path

# Database path
db_path = Path(__file__).parent.parent / 'data' / 'entropia.db'
api_url = 'https://api.entropianexus.com/mobspawns'

print('[Import] Fetching spawn data from Entropia Nexus API...')

# Fetch data from API
try:
    with urllib.request.urlopen(api_url) as response:
        data = response.read().decode('utf-8')
        spawns = json.loads(data)
    print(f'[Import] Received {len(spawns)} spawn records')
except Exception as e:
    print(f'[Import] ❌ Failed to fetch data: {e}')
    exit(1)

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create table for Nexus spawn data
cursor.execute('''
    CREATE TABLE IF NOT EXISTS nexus_spawns (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        planet TEXT NOT NULL,
        type TEXT,
        shape TEXT,
        center_lon REAL,
        center_lat REAL,
        density TEXT,
        is_shared INTEGER,
        is_event INTEGER,
        notes TEXT,
        data_json TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
''')

print('[Import] Created/verified nexus_spawns table')

# Begin transaction
inserted = 0
skipped = 0

for spawn in spawns:
    try:
        props = spawn.get('Properties', {})
        planet_data = spawn.get('Planet', {})
        planet = planet_data.get('Name', 'Unknown')
        coords = props.get('Coordinates', {})
        
        cursor.execute('''
            INSERT OR REPLACE INTO nexus_spawns (
                id, name, planet, type, shape, center_lon, center_lat,
                density, is_shared, is_event, notes, data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            spawn.get('Id'),
            spawn.get('Name', 'Unknown Spawn'),
            planet,
            props.get('Type'),
            props.get('Shape'),
            coords.get('Longitude'),
            coords.get('Latitude'),
            props.get('Density'),
            1 if props.get('IsShared') else 0,
            1 if props.get('IsEvent') else 0,
            props.get('Notes'),
            json.dumps(spawn)
        ))
        
        inserted += 1
        if inserted % 100 == 0:
            print(f'[Import] Progress: {inserted} records inserted...')
            
    except Exception as e:
        print(f'[Import] Failed to insert spawn {spawn.get("Id")}: {e}')
        skipped += 1

conn.commit()

print(f'\n[Import] ✅ Complete!')
print(f'  - Inserted: {inserted} spawn records')
print(f'  - Skipped: {skipped} records (errors)')

# Query for Foul spawns on Calypso
print('\n[Import] Checking for Foul spawn locations on Calypso...')
cursor.execute('''
    SELECT id, name, planet, center_lon, center_lat, density, notes
    FROM nexus_spawns
    WHERE planet = 'Calypso' 
      AND name LIKE '%Foul%'
    ORDER BY name
''')

foul_spawns = cursor.fetchall()
if foul_spawns:
    print(f'\n[Import] Found {len(foul_spawns)} Foul spawn locations:')
    for spawn in foul_spawns:
        spawn_id, name, planet, lon, lat, density, notes = spawn
        print(f'  - {name} at ({lon}, {lat}) [{density or "unknown"} density]')
else:
    print('[Import] ⚠️  No Foul spawns found in Nexus data')

# Query near user's hunting location (79085, 67537)
print('\n[Import] Checking spawns near your hunting area (79085, 67537)...')
cursor.execute('''
    SELECT 
        id, name, planet, center_lon, center_lat,
        ROUND(SQRT(
            (center_lon - 79085) * (center_lon - 79085) + 
            (center_lat - 67537) * (center_lat - 67537)
        )) as distance
    FROM nexus_spawns
    WHERE planet = 'Calypso'
        AND center_lon IS NOT NULL
        AND center_lat IS NOT NULL
    ORDER BY distance
    LIMIT 10
''')

nearby_spawns = cursor.fetchall()
print('\n[Import] Top 10 closest spawns to (79085, 67537):')
for spawn in nearby_spawns:
    spawn_id, name, planet, lon, lat, distance = spawn
    print(f'  - {name} at ({lon}, {lat}) - {distance}m away')

conn.close()
print('\n[Import] Database connection closed')
