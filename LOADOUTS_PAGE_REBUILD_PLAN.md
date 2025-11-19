# Loadouts Page Rebuild Plan

## 📋 Overview

The Loadouts page is the equipment management interface for ARTEMIS v2. Users create, edit, and manage their hunting gear configurations (loadouts), which are then used during active sessions to calculate accurate ammo costs and profit.

---

## 🎯 Core Requirements

### What the Loadouts Page Must Do

1. **Display all loadouts** - Grid/list of saved loadouts with key stats
2. **Create new loadout** - Modal form to build a complete loadout
3. **Edit existing loadout** - Modify any loadout property
4. **Delete loadout** - Remove loadouts with confirmation
5. **Real-time cost calculation** - Show PED per shot as equipment changes
6. **Equipment selection** - Search/select from JSON data files:
   - Weapons (329K+ lines)
   - Amps
   - Absorbers
   - Armor Sets
   - Armor Plating
   - Scopes
   - Sights
   - Weapon Enhancers (10 max)
   - Armor Enhancers (10 max)
7. **Enhancer management** - 10-slot visual display with add/remove
8. **Manual cost override** - Allow users to set custom PED per shot
9. **Export loadout** - Share loadout data
10. **Loadout stats** - Show total damage, cost breakdown, efficiency

---

## 🏗️ Architecture

### Data Flow

```
Loadouts Page
    ↓ Load equipment data
Equipment JSON Files → Equipment Store (in-memory cache)
    ↓ User creates/edits
Loadout Form Modal → LoadoutService.calculateCosts()
    ↓ Save
IPC → LoadoutRepository → SQLite Database
    ↓ Load on mount
SQLite → Loadouts Page State → UI Display
```

### Key Services

- **LoadoutService** - Pure functions for cost calculations
- **LoadoutRepository** - Database CRUD operations (via IPC)
- **Equipment Data Loader** - Lazy load JSON files (5+ MB total)

---

## 🎨 UI Design (Dashboard Style)

### Color Palette

- Background: `bg-background` (dark gray)
- Primary Text: `text-primary` (white/light)
- Secondary Text: `text-primary/60`
- Borders: `border-primary/20`
- Accent: `text-blue-400` (brand blue)
- Success: `text-green-400`
- Danger: `text-red-400`

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ 📦 Loadouts                                  [+ New]     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Loadout Card │  │ Loadout Card │  │ Loadout Card │  │
│  │              │  │              │  │              │  │
│  │ Opalo + 105  │  │ Karma + A106 │  │ Budget Hunt  │  │
│  │ 0.52 PED/shot│  │ 0.78 PED/shot│  │ 0.15 PED/shot│  │
│  │ [Edit][Del]  │  │ [Edit][Del]  │  │ [Edit][Del]  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  No loadouts? Create your first hunting setup →         │
└─────────────────────────────────────────────────────────┘
```

### Loadout Card Design

```
┌────────────────────────────────────┐
│ 🎯 Opalo Hunting Build            │ ← Name
├────────────────────────────────────┤
│ Weapon: Opalo (L)                  │
│ Amp: A-105 (L)                     │
│ Armor: Gremlin + 5B               │
│ Enhancers: ⬛⬛⬛⬛⬛⬛⬜⬜⬜⬜      │ ← 10 slots visual
├────────────────────────────────────┤
│ 💰 0.52 PED per shot               │ ← Calculated cost
│ 🎲 54-108 dmg                      │ ← Damage range
├────────────────────────────────────┤
│ [Edit] [Delete]                    │
└────────────────────────────────────┘
```

### Modal Form Design

```
┌─────────────────────────────────────────────┐
│ ✖ Create New Loadout                        │
├─────────────────────────────────────────────┤
│                                              │
│ Name: [____________________]                 │
│                                              │
│ 🔫 Weapon                                    │
│ [Search weapon...            ▼]             │
│ Selected: Opalo (L) | 80 dmg | 5.0 decay    │
│                                              │
│ ⚡ Amp                                       │
│ [Search amp...               ▼]             │
│ Selected: A-105 (L) | +25 dmg | 2.1 decay   │
│                                              │
│ 🛡️ Weapon Enhancers (6/10 slots)           │
│ ⬛⬛⬛⬛⬛⬛⬜⬜⬜⬜                         │
│ [Add Enhancer ▼]                            │
│ • Damage Enhancer 8 [Remove]                │
│ • Damage Enhancer 8 [Remove]                │
│ • Accuracy Enhancer 6 [Remove]              │
│                                              │
│ 🛡️ Armor Enhancers (4/10 slots)            │
│ ⬛⬛⬛⬛⬜⬜⬜⬜⬜⬜                         │
│ [Add Enhancer ▼]                            │
│ • AP-54 Impact (L) [Remove]                 │
│ • AP-42 Cut (L) [Remove]                    │
│                                              │
│ 💰 Cost Breakdown                            │
│ ├─ Weapon:    0.35 PED                      │
│ ├─ Amp:       0.12 PED                      │
│ ├─ Enhancers: 0.05 PED                      │
│ └─ Total:     0.52 PED per shot             │
│                                              │
│ ☑ Use manual cost: [0.50] PED              │
│                                              │
│ [Cancel] [Save Loadout]                     │
└─────────────────────────────────────────────┘
```

---

## 📦 Component Structure

### Page Component

```typescript
// src/ui/pages/Loadouts.tsx
export function Loadouts() {
  const [loadouts, setLoadouts] = createSignal<Loadout[]>([]);
  const [showModal, setShowModal] = createSignal(false);
  const [editingLoadout, setEditingLoadout] = createSignal<Loadout | null>(null);

  // Load equipment data on mount
  onMount(async () => {
    await loadEquipmentData();
    await loadLoadouts();
  });

  return (
    <div class="p-6">
      <header>
        <h1>Loadouts</h1>
        <Button onClick={() => setShowModal(true)}>+ New Loadout</Button>
      </header>

      <div class="grid grid-cols-3 gap-4">
        <For each={loadouts()}>
          {(loadout) => <LoadoutCard loadout={loadout} />}
        </For>
      </div>

      <Show when={showModal()}>
        <LoadoutModal
          loadout={editingLoadout()}
          onSave={saveLoadout}
          onClose={() => setShowModal(false)}
        />
      </Show>
    </div>
  );
}
```

### Reusable Components

1. **LoadoutCard** - Display single loadout with stats
2. **LoadoutModal** - Create/edit form
3. **EquipmentSelect** - Searchable dropdown for equipment
4. **EnhancerSlots** - 10-slot visual display with add/remove
5. **CostBreakdown** - Itemized cost display

---

## 🔧 Implementation Steps

### Phase 1: Basic Structure (30 min)

- [ ] Create `Loadouts.tsx` page component
- [ ] Add routing in `App.tsx`
- [ ] Set up state management (signals)
- [ ] Load loadouts from database via IPC
- [ ] Display empty state / loading state

### Phase 2: Loadout Display (45 min)

- [ ] Create `LoadoutCard` component
- [ ] Display loadout name, equipment, cost
- [ ] Add edit/delete buttons
- [ ] Implement delete with confirmation
- [ ] Grid layout with responsive design

### Phase 3: Equipment Data Loading (1 hour)

- [ ] Create equipment data loader service
- [ ] Load JSON files via IPC (lazy load)
- [ ] Cache in memory (avoid re-parsing)
- [ ] Create `EquipmentSelect` dropdown component
- [ ] Implement fuzzy search/filter

### Phase 4: Create Loadout Modal (2 hours)

- [ ] Create `LoadoutModal` component
- [ ] Form with all equipment fields
- [ ] Wire up equipment selectors
- [ ] Display selected equipment details
- [ ] Real-time cost calculation as equipment changes
- [ ] Validation (name required, at least weapon)

### Phase 5: Enhancer Management (1 hour)

- [ ] Create `EnhancerSlots` component (10 boxes)
- [ ] Visual filled/empty slots (⬛⬜)
- [ ] Dropdown to add enhancers
- [ ] Remove button per enhancer
- [ ] Enforce 10-slot limit
- [ ] Update costs when enhancers change

### Phase 6: Cost Calculation (30 min)

- [ ] Create `CostBreakdown` component
- [ ] Display itemized costs (weapon, amp, enhancers, etc.)
- [ ] Show total PED per shot (large, prominent)
- [ ] Implement manual cost override checkbox + input
- [ ] Visual indicator when using manual override

### Phase 7: Edit Loadout (30 min)

- [ ] Load existing loadout into modal
- [ ] Pre-populate all fields
- [ ] Update instead of create on save
- [ ] Preserve loadout ID and metadata

### Phase 8: Polish & Testing (1 hour)

- [ ] Error handling (file load failures, save errors)
- [ ] Loading states for slow equipment data
- [ ] Keyboard shortcuts (Esc to close modal)
- [ ] Accessibility (ARIA labels, focus management)
- [ ] Mobile responsive design
- [ ] Test with 0 loadouts, 1 loadout, 20 loadouts
- [ ] Test enhancer limits (can't add 11th)
- [ ] Test cost calculations match V1 ARTEMIS

**Total Estimated Time: 6-7 hours**

---

## 📊 Data Schema

### Loadout Type (from Loadout.ts)

```typescript
{
  id: string (UUID)
  name: string
  userId: string

  // Equipment names (display)
  weapon?: string
  amp?: string
  absorber?: string
  armorSet?: string
  armorPlating?: string
  scope?: string
  sight?: string

  // Full equipment data (calculations)
  weaponData?: EquipmentData
  ampData?: EquipmentData
  absorberData?: EquipmentData
  armorSetData?: EquipmentData
  armorPlatingData?: EquipmentData
  scopeData?: EquipmentData
  sightData?: EquipmentData

  // Enhancers (Record<string, EnhancerData>)
  weaponEnhancers: Record<string, EnhancerData>  // Max 10
  armorEnhancers: Record<string, EnhancerData>   // Max 10

  // Calculated costs
  costs?: {
    weaponCost: number
    ampCost: number
    absorberCost: number
    scopeCost: number
    sightCost: number
    weaponEnhancersCost: number
    armorEnhancersCost: number
    totalPerShot: number
    armorDecayMultiplier: number
    manualCostOverride?: number  // If user overrides
  }

  // Manual override flag
  useManualCost: boolean

  // Metadata
  timestamp: number
  totalPEDCycled: number
  version: '2.0'
  tags: string[]
  notes?: string
}
```

### Equipment Data Structure (from weapons.json, etc.)

```typescript
{
  Id: number
  ItemId: number
  Name: string
  Properties: {
    Economy: {
      Decay: number      // PEC per shot
      AmmoBurn: number   // PEC * 100 per shot
      Efficiency?: number
      MaxTT?: number
      MinTT?: number
    }
    Damage?: {
      Stab: number
      Cut: number
      Impact: number
      Penetration: number
      Shrapnel: number
      Burn: number
      Cold: number
      Acid: number
      Electric: number
    }
    Weight?: number
    Type?: string
    Category?: string
    UsesPerMinute?: number
    Range?: number
  }
}
```

### Enhancer Data Structure (from weapon-enhancers.json)

```typescript
{
  Id: number;
  ItemId: number;
  Name: string;
  Properties: {
    Economy: {
      Decay: string | number; // "0.002" or 0.002
      AmmoBurn: string | number; // "8" or 8
    }
  }
}
```

---

## 🧮 Cost Calculation Formula

**From `LoadoutService.ts`:**

```typescript
// Per-shot cost calculation
totalCost =
  weaponDecay * 0.01 + // PEC → PED
  weaponAmmoBurn * 0.0001 + // PEC * 100 → PED
  ampDecay * 0.01 +
  ampAmmoBurn * 0.0001 +
  absorberDecay * 0.01 +
  scopeDecay * 0.01 +
  sightDecay * 0.01 +
  weaponEnhancersTotal +
  armorEnhancersTotal;

// Enhancer cost (each)
enhancerCost = enhancerDecay * 0.01 + enhancerAmmoBurn * 0.0001;
```

**Damage Calculation:**

```typescript
// Base damage (sum all types)
baseDamage =
  Stab + Cut + Impact + Penetration + Shrapnel + Burn + Cold + Acid + Electric;

// Damage range (50% - 100%)
minDamage = baseDamage * 0.5;
maxDamage = baseDamage * 1.0;

// Apply enhancers (10% per slot)
enhancerMultiplier = 1 + enhancerSlots * 0.1;
enhancedMin = minDamage * enhancerMultiplier;
enhancedMax = maxDamage * enhancerMultiplier;

// Apply amp (capped at weapon base min)
ampDamage = sum(amp.Properties.Damage);
ampCap = min(ampDamage, minDamage);
finalMin = enhancedMin + ampCap * 0.5;
finalMax = enhancedMax + ampCap * 1.0;
```

---

## 🔌 IPC Integration

### Loadout Repository (Electron Main)

```typescript
// Already exists in src/infra/storage/LoadoutRepository.ts
ipcMain.handle("loadout:create", async (_, loadout: Loadout) => {
  return await LoadoutRepository.create(loadout);
});

ipcMain.handle("loadout:findAll", async () => {
  return await LoadoutRepository.findAll();
});

ipcMain.handle("loadout:update", async (_, loadout: Loadout) => {
  return await LoadoutRepository.update(loadout);
});

ipcMain.handle("loadout:delete", async (_, id: string) => {
  return await LoadoutRepository.delete(id);
});
```

### Equipment Data Loader (Electron Main)

```typescript
// Need to add in electron/main.ts
ipcMain.handle("equipment:loadWeapons", async () => {
  const data = await fs.readFile("data/weapons.json", "utf-8");
  return JSON.parse(data);
});

ipcMain.handle("equipment:loadAmps", async () => {
  const data = await fs.readFile("data/amps.json", "utf-8");
  return JSON.parse(data);
});

// ... similar for other equipment types
```

---

## ✅ Acceptance Criteria

### Must Have

- ✅ Display all saved loadouts
- ✅ Create new loadout with all equipment fields
- ✅ Edit existing loadout
- ✅ Delete loadout with confirmation
- ✅ Search/filter equipment by name
- ✅ Real-time cost calculation
- ✅ 10-slot enhancer management (visual display)
- ✅ Manual cost override option
- ✅ Persist to database via IPC
- ✅ Dashboard-style UI (no gradients, brand colors)
- ✅ Responsive design (desktop + mobile)

### Nice to Have

- 🎯 Export loadout as JSON
- 🎯 Import loadout from JSON
- 🎯 Duplicate loadout
- 🎯 Sort loadouts by cost/name/date
- 🎯 Filter loadouts by tags
- 🎯 Show loadout usage stats (# sessions, total PED cycled)
- 🎯 Compare two loadouts side-by-side
- 🎯 Loadout templates (starter builds)

---

## 🐛 Edge Cases to Handle

1. **No equipment data loaded** - Show loading spinner, retry on failure
2. **Corrupted JSON files** - Graceful error, log to console, show error message
3. **10+ enhancers selected** - Disable "Add" button when limit reached
4. **Negative costs** - Validate all cost inputs > 0
5. **Missing required fields** - Disable "Save" until name + weapon filled
6. **Duplicate loadout names** - Allow (use UUID, not name as key)
7. **Manual cost = 0** - Allow (some users hunt free gear)
8. **Very long equipment names** - Truncate with ellipsis in cards
9. **Deleting active loadout** - Warn user "This loadout is in use by active session"
10. **Database errors** - Show toast notification, don't crash page

---

## 🎯 Success Metrics

1. **User can create a loadout in < 2 minutes** (timed test)
2. **Cost calculations match V1 ARTEMIS** (accuracy test)
3. **Page loads in < 1 second** with 50 loadouts (performance test)
4. **No console errors** during normal usage (stability test)
5. **Accessible** - keyboard navigation works (accessibility test)

---

## 📚 Reference Files

- `src/core/types/Loadout.ts` - Type definitions
- `src/core/services/LoadoutService.ts` - Business logic
- `src/infra/storage/LoadoutRepository.ts` - Database operations
- `src/ui/pages/Dashboard.tsx` - UI style reference
- `src/ui/components/molecules/LoadoutSelector.tsx` - Existing loadout dropdown
- `data/weapons.json` - Equipment data
- `data/weapon-enhancers.json` - Enhancer data
- `.github/instructions/v2-dev-rules.instructions.md` - UI/UX guidelines

---

## 🚀 Ready to Build?

**Estimated Time:** 6-7 hours  
**Complexity:** Medium-High  
**Dependencies:** None (all services exist)

**Start with:** Phase 1 (Basic Structure) - get the page rendering, then iterate through phases sequentially.

---

## 💡 Implementation Notes

### Equipment Data Loading Strategy

Since equipment JSON files are large (329K+ lines for weapons):

1. **Lazy load** - Only load when modal opens (not on page mount)
2. **Cache in memory** - Parse once, keep in signal
3. **Progressive loading** - Load weapons first, then other equipment async
4. **Virtual scroll** - If dropdown has 1000+ items, use virtual list

### Enhancer Slot Visual

Use Unicode boxes for clean, lightweight display:

- Filled: `⬛` (U+2B1B Black Large Square)
- Empty: `⬜` (U+2B1C White Large Square)

Example: `⬛⬛⬛⬛⬛⬛⬜⬜⬜⬜` = 6/10 slots filled

### Cost Display

Make cost prominent and easy to read:

```typescript
<div class="text-2xl font-bold text-green-400">
  {loadout.costs.totalPerShot.toFixed(2)} PED
  <span class="text-sm text-primary/60">per shot</span>
</div>
```

### Search/Filter Equipment

Use simple string matching (case-insensitive):

```typescript
const filtered = weapons().filter((w) =>
  w.Name.toLowerCase().includes(search().toLowerCase())
);
```

For better UX, show top 20 matches only (avoid rendering 1000+ items).

---

**Ready to rebuild? Let's start with Phase 1!** 🚀
