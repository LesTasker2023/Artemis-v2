# ARTEMIS TypeScript Rewrite Plan

## Philosophy: Immutability & Type Safety

### Core Principles

1. **Immutable Data Structures** - Never mutate, always return new instances
2. **Strong Types** - TypeScript strict mode, zero `any` types
3. **Functional Core, Imperative Shell** - Pure business logic, IO at edges
4. **Event Sourcing** - Store events, derive state (enables time travel, undo)
5. **Zod for Runtime Validation** - Types that validate at runtime

---

## Tech Stack

### Core

- **TypeScript 5.x** (strict mode)
- **Immer** (immutable updates with mutable syntax)
- **Zod** (runtime schema validation)
- **fp-ts** (functional programming utilities)
- **Effect-TS** (effect system for error handling)

### Frontend

- **Solid.js** (reactive, TypeScript-first, no VDOM overhead)
- **TailwindCSS** (utility-first styling)
- **Recharts** (TypeScript charts)
- **Mapbox GL** (better than canvas for GPS maps)

### Backend

- **Electron** (keep existing)
- **Better-SQLite3** (fast, type-safe queries via Kysely)
- **Zod-to-TS** (generate types from Zod schemas)

### Tooling

- **Vite** (fast dev server, HMR)
- **Vitest** (fast tests, TypeScript native)
- **ESLint + Prettier** (strict rules)
- **ts-pattern** (exhaustive pattern matching)

---

## Project Structure

```
artemis-v2/
├── src/
│   ├── core/              # Pure business logic (no IO)
│   │   ├── types/         # Core domain types
│   │   │   ├── Session.ts
│   │   │   ├── Loadout.ts
│   │   │   ├── Loot.ts
│   │   │   ├── GPS.ts
│   │   │   └── Events.ts
│   │   ├── models/        # Immutable data models
│   │   │   ├── SessionModel.ts
│   │   │   ├── LoadoutModel.ts
│   │   │   └── AnalyticsModel.ts
│   │   ├── services/      # Pure business logic
│   │   │   ├── SessionService.ts
│   │   │   ├── AnalyticsService.ts
│   │   │   └── GPSService.ts
│   │   └── utils/         # Pure utilities
│   │       ├── calculations.ts
│   │       └── validators.ts
│   │
│   ├── infra/             # IO layer (file, DB, IPC)
│   │   ├── db/            # SQLite database
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   └── repositories/
│   │   ├── storage/       # File system
│   │   │   ├── SessionRepository.ts
│   │   │   └── LoadoutRepository.ts
│   │   └── ipc/           # Electron IPC + Discord
│   │       ├── main.ts
│   │       └── renderer.ts
│   │
│   ├── ui/                # Solid.js components
│   │   ├── components/    # Reusable UI
│   │   ├── pages/         # Main views
│   │   ├── stores/        # Global state (Solid stores)
│   │   └── App.tsx
│   │
│   └── main.ts            # Electron main process
│       renderer.ts        # Electron renderer entry
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## Core Type System

### Event Sourcing Architecture

Instead of storing state, store **events** and derive state from them:

```typescript
// src/core/types/Events.ts
import { z } from "zod";

// Base event
const BaseEvent = z.object({
  id: z.string().uuid(),
  timestamp: z.number(),
  sessionId: z.string().uuid(),
  userId: z.string(),
});

// Specific events
export const ShotFiredEvent = BaseEvent.extend({
  type: z.literal("SHOT_FIRED"),
  payload: z.object({
    weaponId: z.string(),
    ammoUsed: z.number(),
  }),
});

export const HitRegisteredEvent = BaseEvent.extend({
  type: z.literal("HIT_REGISTERED"),
  payload: z.object({
    damage: z.number(),
    mobId: z.string().optional(),
    critical: z.boolean(),
  }),
});

export const MobKilledEvent = BaseEvent.extend({
  type: z.literal("MOB_KILLED"),
  payload: z.object({
    mobName: z.string(),
    mobId: z.string(),
    location: z.object({ lon: z.number(), lat: z.number() }),
  }),
});

export const LootReceivedEvent = BaseEvent.extend({
  type: z.literal("LOOT_RECEIVED"),
  payload: z.object({
    items: z.array(
      z.object({
        name: z.string(),
        quantity: z.number(),
        value: z.number(),
      })
    ),
    totalValue: z.number(),
  }),
});

export const GPSUpdateEvent = BaseEvent.extend({
  type: z.literal("GPS_UPDATE"),
  payload: z.object({
    location: z.object({ lon: z.number(), lat: z.number() }),
  }),
});

// Union of all events
export const SessionEvent = z.discriminatedUnion("type", [
  ShotFiredEvent,
  HitRegisteredEvent,
  MobKilledEvent,
  LootReceivedEvent,
  GPSUpdateEvent,
]);

export type SessionEvent = z.infer<typeof SessionEvent>;
```

### Session Model (Derived State)

```typescript
// src/core/types/Session.ts
import { z } from "zod";

export const SessionStats = z.object({
  totalShots: z.number(),
  totalHits: z.number(),
  totalMisses: z.number(),
  accuracy: z.number().min(0).max(1),
  totalKills: z.number(),
  totalDeaths: z.number(),
  totalDamage: z.number(),
  totalLootValue: z.number(),
  totalAmmoCost: z.number(),
  profit: z.number(),
  profitPerHour: z.number(),
  returnRate: z.number(),
});

export const Session = z.object({
  id: z.string().uuid(),
  name: z.string(),
  userId: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  duration: z.number(), // seconds

  // Derived from events
  stats: SessionStats,
  events: z.array(SessionEvent),

  // Metadata
  loadoutId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),

  // Version for migrations
  version: z.literal("2.0"),
});

export type Session = z.infer<typeof Session>;
export type SessionStats = z.infer<typeof SessionStats>;
```

### GPS Analytics Types

```typescript
// src/core/types/GPS.ts
import { z } from "zod";

export const Coordinate = z.object({
  lon: z.number(),
  lat: z.number(),
});

export const HuntingZone = z.object({
  id: z.string().uuid(),
  center: Coordinate,
  radius: z.number(),

  // Stats
  sessionCount: z.number(),
  totalProfit: z.number(),
  avgProfitPerHour: z.number(),

  // Mob composition
  mobEncounters: z.record(
    z.string(),
    z.object({
      count: z.number(),
      kills: z.number(),
      profit: z.number(),
    })
  ),

  // Danger metrics
  deathCount: z.number(),
  dangerLevel: z.number().min(0).max(1),
});

export const GPSHeatmap = z.object({
  zones: z.array(HuntingZone),
  deathLocations: z.array(
    z.object({
      location: Coordinate,
      timestamp: z.number(),
      sessionId: z.string().uuid(),
    })
  ),
  generatedAt: z.number(),
});

export type Coordinate = z.infer<typeof Coordinate>;
export type HuntingZone = z.infer<typeof HuntingZone>;
export type GPSHeatmap = z.infer<typeof GPSHeatmap>;
```

### Immutable Session Service

```typescript
// src/core/services/SessionService.ts
import { produce } from "immer";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { Session, SessionEvent } from "../types";

export class SessionService {
  // Pure function: Create new session
  static create(userId: string, name: string): Session {
    return {
      id: crypto.randomUUID(),
      name,
      userId,
      startTime: Date.now(),
      duration: 0,
      stats: SessionService.emptyStats(),
      events: [],
      tags: [],
      version: "2.0",
    };
  }

  // Pure function: Add event to session (returns NEW session)
  static addEvent(session: Session, event: SessionEvent): Session {
    return produce(session, (draft) => {
      draft.events.push(event);
      draft.stats = SessionService.calculateStats(draft.events);
      draft.duration = this.calculateDuration(draft);
    });
  }

  // Pure function: Calculate stats from events (no mutation)
  static calculateStats(events: SessionEvent[]): SessionStats {
    const shots = events.filter((e) => e.type === "SHOT_FIRED").length;
    const hits = events.filter((e) => e.type === "HIT_REGISTERED").length;
    const kills = events.filter((e) => e.type === "MOB_KILLED").length;

    const totalDamage = events
      .filter((e) => e.type === "HIT_REGISTERED")
      .reduce((sum, e) => sum + e.payload.damage, 0);

    const totalLootValue = events
      .filter((e) => e.type === "LOOT_RECEIVED")
      .reduce((sum, e) => sum + e.payload.totalValue, 0);

    const totalAmmoCost = events
      .filter((e) => e.type === "SHOT_FIRED")
      .reduce((sum, e) => sum + e.payload.ammoUsed, 0);

    const profit = totalLootValue - totalAmmoCost;
    const accuracy = shots > 0 ? hits / shots : 0;

    return {
      totalShots: shots,
      totalHits: hits,
      totalMisses: shots - hits,
      accuracy,
      totalKills: kills,
      totalDeaths: 0, // TODO: Track death events
      totalDamage,
      totalLootValue,
      totalAmmoCost,
      profit,
      profitPerHour: 0, // Calculated separately with duration
      returnRate: totalAmmoCost > 0 ? totalLootValue / totalAmmoCost : 0,
    };
  }

  // Pure function: End session (returns NEW session)
  static end(session: Session): Session {
    return produce(session, (draft) => {
      draft.endTime = Date.now();
      draft.duration = this.calculateDuration(draft);
      draft.stats.profitPerHour = this.calculateProfitPerHour(draft);
    });
  }

  private static calculateDuration(session: Session): number {
    const end = session.endTime ?? Date.now();
    return Math.floor((end - session.startTime) / 1000);
  }

  private static calculateProfitPerHour(session: Session): number {
    if (session.duration === 0) return 0;
    return (session.stats.profit / session.duration) * 3600;
  }

  private static emptyStats(): SessionStats {
    return {
      totalShots: 0,
      totalHits: 0,
      totalMisses: 0,
      accuracy: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalDamage: 0,
      totalLootValue: 0,
      totalAmmoCost: 0,
      profit: 0,
      profitPerHour: 0,
      returnRate: 0,
    };
  }
}
```

---

## Database Schema (SQLite)

```typescript
// src/infra/db/schema.ts
import { Kysely, Generated } from "kysely";

export interface Database {
  sessions: SessionTable;
  events: EventTable;
  loadouts: LoadoutTable;
  zones: ZoneTable;
  mob_encounters: MobEncounterTable;
}

export interface SessionTable {
  id: Generated<string>;
  name: string;
  user_id: string;
  start_time: number;
  end_time: number | null;
  duration: number;
  loadout_id: string | null;
  tags: string; // JSON array
  notes: string | null;
  version: string;
  created_at: Generated<number>;
}

export interface EventTable {
  id: Generated<string>;
  session_id: string;
  type: string;
  timestamp: number;
  payload: string; // JSON
  created_at: Generated<number>;
}

export interface ZoneTable {
  id: Generated<string>;
  center_lon: number;
  center_lat: number;
  radius: number;
  session_count: number;
  total_profit: number;
  avg_profit_per_hour: number;
  death_count: number;
  danger_level: number;
  updated_at: Generated<number>;
}

// Type-safe queries
export type DB = Kysely<Database>;
```

---

## Migration from Legacy System

```typescript
// src/infra/migration/LegacyMigrator.ts
import { z } from "zod";
import { Session, SessionEvent } from "../../core/types";

// Legacy session format
const LegacySession = z.object({
  name: z.string(),
  timestamp: z.number(),
  startTime: z.number(),
  endTime: z.number().optional(),
  duration: z.number(),
  stats: z.object({
    totalShots: z.number(),
    totalHits: z.number(),
    totalKills: z.number(),
    totalDamageDealt: z.number(),
    // ... other legacy fields
  }),
  mobKills: z.array(z.any()).optional(),
  lootHistory: z.array(z.any()).optional(),
});

export class LegacyMigrator {
  // Convert legacy session to event-sourced format
  static migrate(legacyData: unknown): Session {
    const parsed = LegacySession.parse(legacyData);
    const events: SessionEvent[] = [];

    // Reconstruct events from aggregated stats
    // (This is lossy, but necessary for migration)

    // Generate shot events
    for (let i = 0; i < parsed.stats.totalShots; i++) {
      events.push({
        id: crypto.randomUUID(),
        timestamp: parsed.startTime + i * 1000, // Estimate timing
        sessionId: crypto.randomUUID(),
        userId: "migrated",
        type: "SHOT_FIRED",
        payload: { weaponId: "unknown", ammoUsed: 0.1 },
      });
    }

    // Convert mob kills to events
    if (parsed.mobKills) {
      for (const kill of parsed.mobKills) {
        events.push({
          id: crypto.randomUUID(),
          timestamp: kill.timestamp || parsed.startTime,
          sessionId: crypto.randomUUID(),
          userId: "migrated",
          type: "MOB_KILLED",
          payload: {
            mobName: kill.name || "Unknown",
            mobId: kill.id || "unknown",
            location: { lon: 0, lat: 0 }, // No GPS data in legacy
          },
        });
      }
    }

    // Create new session from events
    return {
      id: crypto.randomUUID(),
      name: parsed.name,
      userId: "migrated",
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      duration: parsed.duration,
      stats: SessionService.calculateStats(events),
      events,
      tags: ["migrated"],
      version: "2.0",
    };
  }
}
```

---

## Development Phases

### Phase 0: Setup (Week 1)

- [ ] Initialize TypeScript project with Vite
- [ ] Configure strict TypeScript rules
- [ ] Set up Solid.js with TailwindCSS
- [ ] Configure SQLite with Kysely
- [ ] Set up testing (Vitest)
- [ ] Create CI/CD pipeline

### Phase 1: Core Types & Services (Week 2)

- [ ] Define all Zod schemas (Session, Loadout, GPS, Events)
- [ ] Implement SessionService (pure, immutable)
- [ ] Implement AnalyticsService
- [ ] Implement GPSService
- [ ] Write unit tests (100% coverage)

### Phase 2: Database Layer (Week 3)

- [ ] Create SQLite schema
- [ ] Implement repositories (type-safe queries)
- [ ] Add migration system
- [ ] Implement LegacyMigrator
- [ ] Test migration with real legacy data

### Phase 3: UI Components (Week 4-5)

- [ ] Build component library (buttons, cards, charts)
- [ ] Create session management UI
- [ ] Create loadout management UI
- [ ] Create GPS map with Mapbox
- [ ] Add dark mode support

### Phase 4: Integration (Week 6)

- [ ] Wire up Electron IPC
- [ ] Integrate Discord GPS broadcasting
- [ ] Connect UI to database
- [ ] Add auto-save (debounced writes)
- [ ] Add crash recovery

### Phase 5: Analytics Features (Week 7-8)

- [ ] Profit-per-hour calculations
- [ ] GPS heatmap generation
- [ ] Mob intelligence system
- [ ] Loadout performance tracking
- [ ] Comparison tools

### Phase 6: Polish & Testing (Week 9-10)

- [ ] E2E tests with Playwright
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] User testing with beta group
- [ ] Bug fixes

### Phase 7: Migration Path (Week 11)

- [ ] Build migration wizard UI
- [ ] Test with 50+ legacy sessions
- [ ] Add rollback mechanism
- [ ] Create migration guide
- [ ] Support dual-boot (v1 and v2)

### Phase 8: Release (Week 12)

- [ ] Documentation
- [ ] Build installers
- [ ] Set up auto-updater
- [ ] Launch v2.0

---

## Key Benefits of TypeScript Rewrite

### Developer Experience

- **Auto-completion everywhere** - IDE knows all types
- **Refactoring confidence** - Rename safely, compiler catches errors
- **Self-documenting code** - Types explain what data looks like
- **Catch bugs at compile-time** - Not at runtime

### Performance

- **Event sourcing** - Time travel debugging, undo/redo for free
- **Immutability** - Easier to optimize (structural sharing)
- **SQLite** - 10x faster than JSON file reads
- **Solid.js** - Fine-grained reactivity, no VDOM overhead

### Maintainability

- **Pure functions** - Easy to test, no side effects
- **Type safety** - Breaking changes fail at compile-time
- **Separation of concerns** - Core logic isolated from IO
- **Pattern matching** - Exhaustive case handling with ts-pattern

### User Experience

- **Faster app** - Solid.js + SQLite = instant UI
- **More reliable** - Event sourcing prevents data loss
- **Better analytics** - Rich queries on SQLite
- **Undo/Redo** - Free from event sourcing

---

## Package.json Setup

```json
{
  "name": "artemis-v2",
  "version": "2.0.0",
  "type": "module",
  "author": "Les Tasker",
  "repository": {
    "type": "git",
    "url": "https://github.com/LesTasker2023/ARTEMIS.git"
  },
  "scripts": {
    "dev": "vite",
    "dev:electron": "concurrently -k \"vite\" \"npm run electron:dev\"",
    "build": "tsc && vite build",
    "build:electron": "npm run build && electron-builder",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint . --ext ts,tsx",
    "format": "prettier --write ."
  },
  "dependencies": {
    "solid-js": "^1.8.0",
    "immer": "^10.0.0",
    "zod": "^3.22.0",
    "fp-ts": "^2.16.0",
    "effect": "^2.0.0",
    "kysely": "^0.27.0",
    "better-sqlite3": "^9.2.0",
    "recharts": "^2.10.0",
    "ts-pattern": "^5.0.0",
    "electron-updater": "^6.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-solid": "^2.8.0",
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "tailwindcss": "^3.4.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0"
  }
}
```

---

## Release & Auto-Update System

ARTEMIS v2 uses GitHub Releases with `electron-updater` for automatic updates.

### Setup (Already Configured)

**Files:**

- `electron-builder.yml` - Build and publish configuration
- `electron/main.ts` - Auto-update logic
- `AUTO_UPDATE_GUIDE.md` - Complete documentation

**Features:**

- ✅ Auto-checks for updates every hour + on startup
- ✅ Downloads updates in background
- ✅ Shows "Update Ready" dialog to users
- ✅ One-click install with restart
- ✅ Disabled in development mode

### Publishing a New Release

**Quick Steps:**

```bash
# 1. Bump version in package.json
"version": "2.0.1"

# 2. Build release
npm run build:electron

# 3. Upload to GitHub Releases
# Go to: https://github.com/LesTasker2023/ARTEMIS/releases/new
# Tag: v2.0.1 (must match package.json with 'v' prefix)
# Upload ALL files from dist-build/ (including latest*.yml)

# 4. Publish - users auto-update!
```

**Critical:** Always upload `latest.yml`, `latest-mac.yml`, and `latest-linux.yml` files - these contain update metadata.

**Version Numbering (Semantic Versioning):**

- Patch: `2.0.1` - Bug fixes
- Minor: `2.1.0` - New features (backwards compatible)
- Major: `3.0.0` - Breaking changes

**Release Checklist:**

- [ ] Version bumped in package.json
- [ ] Tests passing: `npm test`
- [ ] Built: `npm run build:electron`
- [ ] Tested locally
- [ ] GitHub release created with tag `v{version}`
- [ ] ALL installers uploaded (Windows/macOS/Linux)
- [ ] `latest*.yml` files uploaded
- [ ] Release notes written
- [ ] Published (not draft)

See `AUTO_UPDATE_GUIDE.md` for complete documentation.

---

**Next Step:** Create TypeScript project structure?
