# GPS & Session Flow - Refactored Architecture

## Overview

GPS tracking and Discord broadcasting have been decoupled. GPS now serves primarily as a **map viewer**, while Discord broadcasts are **kill-triggered** and session-dependent.

---

## Flow Diagrams

### 1. GPS Map Only (No Session)

```
GPS Toggle ON
    ↓
LiveGPS Service initialized
    ↓
Reads Discord channel messages
    ↓
Displays hunters on map
    ✅ NO broadcasting to Discord
```

### 2. Active Session (GPS OFF)

```
Start Session
    ↓
Log watcher detects MOB_KILLED
    ↓
Trigger in-game keypress (comma)
    ↓
Game posts location to chat
    ↓
Log watcher detects GPS_UPDATE
    ↓
GPS coordinates attached to mob kill data
    ✅ NO Discord broadcast
```

### 3. Active Session + GPS ON (Full Flow)

```
Start Session + GPS ON
    ↓
Log watcher detects MOB_KILLED
    ↓
┌─────────────────┬─────────────────┐
│   Action 1      │   Action 2      │
│                 │                 │
│ Trigger keypress│ Broadcast kill  │
│ (comma key)     │ to Discord with:│
│      ↓          │ - Mob name      │
│ Game posts loc  │ - Location      │
│      ↓          │ - Stats         │
│ GPS_UPDATE      │ - Profit        │
│      ↓          │                 │
│ Attach coords   │                 │
│ to kill data    │                 │
└─────────────────┴─────────────────┘
    ↓
Map shows your kill location
Discord shows your kill + stats
```

---

## Key Changes

### What GPS Does Now

- ✅ **Reads** Discord channel for other hunters
- ✅ **Displays** map with all active hunters
- ✅ **Shows** your kill locations on map
- ❌ **Does NOT** broadcast GPS_UPDATE events to Discord

### What Sessions Do Now

- ✅ **Tracks** all hunting data (kills, loot, damage, etc.)
- ✅ **Triggers** in-game location pings on kills
- ✅ **Attaches** GPS coordinates to mob kill data
- ✅ **Broadcasts** to Discord ONLY when GPS is enabled

### Discord Broadcasts

**Only happens when:**

1. Session is active AND
2. GPS is enabled AND
3. MOB_KILLED event detected

**Broadcast includes:**

- Mob name (lastKill)
- Your location (from last GPS_UPDATE)
- Session stats (profit, kill count)
- Loadout name
- Timestamp

---

## Code Structure

### sessionStore.ts

```typescript
// Event handler flow:
onEvents((events) => {
  // 1. Handle kills
  const kills = events.filter((e) => e.type === "MOB_KILLED");
  for (const kill of kills) {
    // Always trigger in-game ping (for GPS_UPDATE)
    keyboard.sendKeys(",");

    // If GPS enabled, broadcast to Discord
    if (settings.liveGPS.enabled) {
      broadcastKillToDiscord(kill);
    }
  }

  // 2. Handle GPS updates (just track, no broadcast)
  const gpsEvents = events.filter((e) => e.type === "GPS_UPDATE");
  // These are added to session data automatically

  // 3. Update session with all events
  setActiveSession(SessionService.addEvents(prev, events, loadout));
});
```

### broadcastKillToDiscord()

```typescript
async function broadcastKillToDiscord(killEvent: SessionEvent) {
  // Get last known location from session
  const lastGPS = session.events.reverse().find((e) => e.type === "GPS_UPDATE");

  // Create LiveGPSUpdate with kill info
  const update: LiveGPSUpdate = {
    location: lastGPS.payload.location,
    lastKill: killEvent.payload.mobName, // ← Mob name included
    currentProfit: session.stats.profit,
    killCount: session.stats.totalKills,
    // ... other stats
  };

  // Broadcast to Discord
  await liveGPS.broadcastLocation(update);
}
```

---

## User Experience

### Scenario 1: Solo Hunting (No GPS sharing)

1. Start session
2. Kill mobs
3. GPS coordinates saved with each kill
4. No Discord broadcasts
5. View your hunting zones on map later

### Scenario 2: Team Hunting (GPS sharing)

1. Start session + Enable GPS
2. Kill mob
3. Your teammates see in Discord:
   - "John killed Atrox Young"
   - Location: 35000, 25000
   - Profit: +5.50 PED
   - Kills: 12
4. They can click the link to see you on the map
5. Coordinate hunting zones together

### Scenario 3: Just Viewing Others

1. Enable GPS (no session)
2. See other hunters on map
3. No broadcasting from you
4. Read-only mode

---

## Benefits

1. **Decoupled GPS & Broadcasting**
   - GPS map works independently
   - Broadcasting is opt-in (GPS toggle)
   - Clear separation of concerns

2. **Kill-Triggered Broadcasts**
   - Only broadcast on actual kills
   - Includes relevant mob data
   - No spam from manual GPS pings

3. **Session-First Architecture**
   - GPS data always saved with kills
   - Works offline (no Discord required)
   - Discord is enhancement, not requirement

4. **Clean Code**
   - Single broadcast function
   - No rate limiting needed (kills are naturally throttled)
   - Easy to test and debug

---

## Migration Notes

### Removed Functions

- ❌ `broadcastGPS()` - Old auto-broadcast on GPS_UPDATE
- ❌ `broadcastGPSImmediate()` - Deprecated instant broadcast
- ❌ Rate limiting logic (not needed for kill-based broadcasts)

### New Functions

- ✅ `broadcastKillToDiscord()` - Kill-triggered broadcast only

### Settings Impact

- `liveGPS.enabled` now controls:
  - Map visibility ✅
  - Discord broadcasts on kills ✅
  - Does NOT auto-broadcast every GPS ping ❌

---

## Testing Checklist

- [ ] GPS ON, no session → Map shows others, no broadcasts
- [ ] Session active, GPS OFF → Kills tracked, no broadcasts
- [ ] Session + GPS ON → Kills broadcast to Discord with mob name
- [ ] Manual location ping → GPS_UPDATE event, no Discord broadcast
- [ ] Kill → In-game ping triggered, GPS_UPDATE created, coords attached
- [ ] Discord message shows: mob name, location, stats
- [ ] Map displays your kill locations
- [ ] Multiple rapid kills don't spam Discord

---

**Last Updated:** 2024-11-19
**Author:** Refactored for cleaner kill-triggered broadcasting
