/\*\*

- README: artemis-v2
- TypeScript rewrite of ARTEMIS with immutable architecture
- Auto-update test: v2.0.0-alpha.10
  \*/

# ARTEMIS v2 - TypeScript Edition

Immutable, type-safe hunting analytics for Entropia Universe.

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Architecture

### Event Sourcing

All data is stored as immutable events. State is derived by reducing over events.

**Benefits:**

- Time travel debugging
- Undo/redo for free
- Audit log built-in
- Easy to add new features (just add new event types)

### Type Safety

- Zod schemas validate at runtime
- TypeScript provides compile-time safety
- Zero `any` types allowed (strict mode)

### Immutability

- All data structures are immutable
- Immer for ergonomic updates
- Structural sharing for performance

## Project Structure

```
src/
├── core/              # Pure business logic (no IO)
│   ├── types/         # Zod schemas + TypeScript types
│   ├── services/      # Pure functions
│   └── utils/         # Helpers
│
├── infra/             # IO layer
│   ├── db/            # SQLite + Kysely
│   ├── storage/       # File system
│   └── ipc/           # Electron IPC
│
└── ui/                # Solid.js components
    ├── components/    # Reusable UI
    ├── pages/         # Main views
    └── stores/        # Global state
```

## Development

### Adding New Event Type

1. Define Zod schema in `src/core/types/Events.ts`
2. Add to discriminated union
3. Update `SessionService.calculateStats()` to handle new event
4. Write tests

### Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Code Style

- ESLint + Prettier enforced
- Run `npm run lint:fix` before committing
- Commit messages: conventional commits format

## Migration from v1

See `TYPESCRIPT_PLAN.md` for migration strategy.

v1 (legacy) sessions can be imported via `LegacyMigrator`.

## Status

🚧 **In Development** - Not ready for production use.

See `ROADMAP.md` for development timeline.


##  Auto-Update Testing

This version tests the automatic update system. GitHub Actions automatically:
- Increments version on every push to main
- Builds Windows installer
- Creates GitHub release
- Distributes to all users within 1 hour

**Test timestamp:** 2025-11-20 14:30:01
