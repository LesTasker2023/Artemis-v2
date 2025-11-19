# ARTEMIS v2 Development Rules

## UI/UX Rules

### Icons & Visual Elements

- **NEVER use emojis** - Use Lucide React icons only
- Import from `lucide-react`: `import { TrendingUp, MapPin, Target } from 'lucide-react'`
- Consistent icon sizing: Default 20px, large 24px, small 16px
- Always use icon + text label for clarity

### Component Reusability

- **ALWAYS check existing components before creating new ones**
- Search `src/ui/components/` for similar patterns
- If component exists, extend it - don't duplicate
- Build atomic → molecules → organisms pattern
- Keep components under 200 lines (split if larger)

### Design System

- **Color Palette:**
  - Primary: Blue (`#3b82f6`)
  - Success/Profit: Green (`#22c55e`)
  - Danger/Loss: Red (`#ef4444`)
  - Warning: Yellow (`#f59e0b`)
  - Neutral: Gray scale
- **Typography:**

  - Headings: Inter/System font
  - Body: 14px base, 16px for readability sections
  - Code/numbers: Monospace

- **Spacing:**
  - Base unit: 4px (use multiples: 8, 12, 16, 24, 32)
  - Consistent padding/margin across all components

### Component Libraries

**Core UI:**

- `shadcn/ui` - Headless, accessible components built on Radix
- `lucide-react` - Icons only
- `recharts` - Charts/graphs
- `mapbox-gl` - GPS maps

**NO emojis, NO Font Awesome, NO Material Icons**

---

## Code Quality Rules

### TypeScript Standards

- **Strict mode always** - No `any` types
- Export types alongside implementations
- Use Zod schemas for validation
- Discriminated unions for event types

### Functional Patterns

- Pure functions preferred
- No mutations - use Immer for updates
- Return new objects, never modify parameters
- Side effects isolated to services/repositories

### Testing Requirements

- Unit tests for all services
- Integration tests for repositories
- Component tests for complex UI
- Aim for >80% coverage

### Performance

- Lazy load routes/heavy components
- Virtual scroll for large lists (>100 items)
- Debounce inputs (300ms standard)
- Memoize expensive calculations

---

## Project Structure

```
src/
├── ui/
│   ├── components/
│   │   ├── atoms/          # Buttons, inputs, icons
│   │   ├── molecules/      # Cards, forms, stats
│   │   ├── organisms/      # Session list, maps, dashboards
│   │   └── layouts/        # Page layouts, navigation
│   ├── pages/              # Route pages
│   ├── stores/             # Solid stores (global state)
│   └── styles/             # Tailwind config, global CSS
│
├── core/
│   ├── types/              # Zod schemas + TypeScript types
│   ├── services/           # Business logic (pure)
│   └── utils/              # Helper functions
│
└── infra/
    ├── db/                 # SQLite + Kysely
    ├── storage/            # File system
    └── ipc/                # Electron IPC
```

---

## Component Checklist

Before creating a new component:

- [ ] Search for similar component in `src/ui/components/`
- [ ] Check if shadcn/ui has a base component
- [ ] Define props with TypeScript interface
- [ ] Use Lucide icons (not emojis)
- [ ] Add JSDoc comment explaining purpose
- [ ] Export from component folder index
- [ ] Add to component library (if reusable)

---

## Import Order

```typescript
// 1. External libraries
import { createSignal } from "solid-js";
import { TrendingUp } from "lucide-react";

// 2. Internal absolute imports (aliases)
import { Session } from "@core/types/Session";
import { SessionService } from "@core/services/SessionService";

// 3. Relative imports
import { Button } from "../atoms/Button";
import "./styles.css";
```

---

## Naming Conventions

- **Components:** PascalCase - `SessionCard.tsx`
- **Services:** PascalCase - `SessionService.ts`
- **Utils:** camelCase - `calculateProfitPerHour.ts`
- **Types:** PascalCase - `Session.ts`
- **Constants:** UPPER_SNAKE_CASE - `MAX_SESSIONS`
- **CSS classes:** kebab-case - `session-card-header`

---

## Git Commit Rules

- Use conventional commits format
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`
- Examples:
  - `feat(session): add profit per hour calculation`
  - `fix(gps): resolve zone clustering edge case`
  - `refactor(ui): extract session card to component`

---

## Documentation

- JSDoc for all public APIs
- Inline comments for complex logic only
- README in each major folder
- Type signatures are self-documenting

Example:

```typescript
/**
 * Calculates profit per hour for a session
 * @param session - Session object with stats and duration
 * @returns Profit per hour in PED, or 0 if duration is 0
 */
export function calculateProfitPerHour(session: Session): number {
  if (session.duration === 0) return 0;
  return (session.stats.profit / session.duration) * 3600;
}
```

---

## Common Patterns

### Loading States

```typescript
const [data, setData] = createSignal<Session[]>();
const [loading, setLoading] = createSignal(true);
const [error, setError] = createSignal<string>();

// Show loading UI
<Show when={!loading()} fallback={<Spinner />}>
  <SessionList sessions={data()} />
</Show>;
```

### Error Handling

```typescript
import * as E from "fp-ts/Either";

const result = SessionService.validate(data);
if (E.isLeft(result)) {
  console.error("Validation failed:", result.left);
  return;
}
const session = result.right;
```

### Icon Usage

```typescript
import { TrendingUp, TrendingDown } from "lucide-react";

<div class="stat-card">
  {profit > 0 ? (
    <TrendingUp class="text-green-500" size={20} />
  ) : (
    <TrendingDown class="text-red-500" size={20} />
  )}
  <span>{profit} PED</span>
</div>;
```

---

## Performance Budgets

- Initial load: <2 seconds
- Route transitions: <200ms
- List rendering: <100ms for 100 items
- Chart rendering: <150ms
- Bundle size: <500KB (gzipped)

---

## Accessibility

- All interactive elements keyboard accessible
- ARIA labels on icons
- Focus indicators visible
- Color contrast WCAG AA minimum
- Screen reader tested for critical flows

---

## Questions to Ask Before Building

1. Does this component already exist?
2. Can I extend an existing component?
3. Should this be in atoms/molecules/organisms?
4. Is this reusable or page-specific?
5. Have I checked shadcn/ui first?

---

**Last Updated:** 2024-11-17
