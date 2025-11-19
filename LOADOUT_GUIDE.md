# ARTEMIS v2 Loadout System Guide

## Loadout Slots

### Weapon & Attachments

1. **Weapon** (Required for cost tracking)
   - Main hunting weapon (rifle, pistol, etc.)
   - Provides: Decay + AmmoBurn costs
2. **Amplifier (Amp)** (Optional)
   - Damage amplifier attached to weapon
   - Provides: Decay + AmmoBurn costs + Damage bonus
3. **Absorber** (Optional)
   - FAP (First Aid Pack) or repair tool
   - Provides: Decay cost per use
4. **Scope** (Optional)
   - Weapon attachment for range/accuracy
   - Provides: Decay cost
5. **Sight** (Optional)
   - Regular sight OR scope attachment (vision enhancement)
   - Provides: Decay cost

### Armor & Protection

6. **Armor Set** (Optional)
   - Full armor set (e.g., Ghost, Vanguard)
   - Provides: Protection stats + Decay multiplier
7. **Armor Plating** (Optional)
   - Additional armor plates
   - Provides: Extra protection + Decay cost

### Enhancers

8. **Weapon Enhancers** (Up to 10 slots)
   - Damage enhancers, accuracy enhancers, etc.
   - Each slot: 10% damage multiplier
   - Provides: Decay + AmmoBurn per enhancer
9. **Armor Enhancers** (Up to 10 slots)
   - Protection enhancers, durability enhancers, etc.
   - Provides: Decay per enhancer

## Cost Calculation

### Per Shot Cost Formula

```
totalPerShot = weaponCost + ampCost + absorberCost + scopeCost + sightCost
               + weaponEnhancersCost + armorEnhancersCost

Where:
  itemCost = (Decay in PEC / 100) + (AmmoBurn in PEC / 10000)
```

### Manual Cost Override

If you know your exact cost per shot from in-game testing, you can override the calculated cost:

1. **Edit Loadout** → Check "Use Manual Cost Override"
2. **Enter exact cost** in PED (e.g., 0.08234)
3. **Save** - Manual cost will be used instead of calculated

**When to use manual override:**

- Calculated costs don't match in-game results
- Complex setups with non-standard decay
- Using limited items with special decay rates
- Testing different cost scenarios

**Display:**

- Manual costs show **(manual)** indicator
- Calculated cost is preserved but not used
- Can toggle back to calculated cost anytime

### Example Loadout

**Weapon:** Armatrix LR-40

- Decay: 1.5 PEC = 0.015 PED
- AmmoBurn: 300 PEC = 0.03 PED
- **Total: 0.045 PED/shot**

**Amp:** Genesis Star Heat amp

- Decay: 0.8 PEC = 0.008 PED
- AmmoBurn: 150 PEC = 0.015 PED
- **Total: 0.023 PED/shot**

**10x Weapon Enhancers (Tier 8)**

- Each: 0.1 PEC Decay + 5 PEC AmmoBurn = 0.0015 PED
- **Total: 0.015 PED/shot**

**Loadout Total: 0.083 PED/shot**

## Enhancer Multiplier System

### Weapon Enhancers

- **1 enhancer:** 1.1x damage (10% increase)
- **5 enhancers:** 1.5x damage (50% increase)
- **10 enhancers:** 2.0x damage (100% increase)

Formula: `multiplier = 1 + (slots × 0.1)`

### Amp Damage Calculation

Amp damage is capped at weapon base minimum damage:

```typescript
const ampDamage = Math.min(ampTotalDamage, weaponBaseMin);
enhancedMin += ampDamage * 0.5; // 50% to min
enhancedMax += ampDamage * 1.0; // 100% to max
```

## Armor Decay Calculation

Armor decay is estimated based on damage taken:

```
armorDecay = damageTaken × 0.0009
```

Example: Taking 1000 damage ≈ 0.9 PED armor decay

## Data Files

Equipment data loaded from V1 JSON files:

- `data/weapons.json`
- `data/amps.json`
- `data/absorbers.json`
- `data/scopes.json`
- `data/sights.json`
- `data/armorsets.json`
- `data/armorplatings.json`
- `data/weapon-enhancers.json`
- `data/armor-enhancers.json`

## Loadout Workflow

### 1. Create Loadout

```typescript
const loadout = LoadoutService.create(userId, "My Hunting Setup");
```

### 2. Add Equipment

Use the Loadouts page UI:

- Search and select each equipment piece
- Add up to 10 weapon enhancers
- Add up to 10 armor enhancers

### 3. Auto-Calculate Costs

Costs automatically calculated when you save:

```typescript
loadout.costs = LoadoutService.calculateCosts(loadout);
// Returns: { totalPerShot, weaponCost, ampCost, ... }
```

### 4. Use in Session

Select loadout when starting hunting session:

- Events auto-calculate costs
- Profit = loot - (shots × totalPerShot)
- Armor decay added when hit

## UI Components

### Loadouts Page (`/loadouts`)

- Create new loadouts
- Edit existing loadouts
- View cost breakdowns
- Delete loadouts

### LoadoutSelector (in ActiveSession)

- Dropdown to select active loadout
- Shows: Name, weapon+amp, cost per shot
- Expanded view: Full equipment details

### EquipmentSelector

- Searchable dropdown for each slot
- Searches V1 equipment database
- Shows economy + damage stats
- Optional fields (can be left empty)

### EnhancerMultiSelector

- Multi-select up to 10 enhancers
- Shows all selected with remove buttons
- Calculates total enhancer cost
- Visual slot indicator (e.g., "7/10 slots")

## Session Integration

When session is active with loadout:

```typescript
// On SHOT_FIRED event
const ammoCost = loadout.costs.totalPerShot;
session.stats.totalAmmoCost += ammoCost;

// On HIT_REGISTERED event (damage taken)
const armorDecay = damage × 0.0009;
session.stats.totalAmmoCost += armorDecay;

// Calculate profit
session.stats.profit = totalLootValue - totalAmmoCost;
```

## Best Practices

1. **Always set weapon** - Required for accurate cost tracking
2. **Set amp if using one** - Significant cost component
3. **Add all enhancers** - Don't forget enhancer decay costs
4. **Update loadout when changing gear** - Keep costs accurate
5. **Create multiple loadouts** - For different mob types/situations
6. **Compare loadout performance** - Track which loadouts are profitable

## Troubleshooting

**Missing equipment in search?**

- Check JSON files in `data/` folder
- Equipment must have valid Name, Properties, Economy fields

**Costs seem wrong?**

- Verify equipment Decay/AmmoBurn values in JSON
- Check if enhancers are counted
- Ensure amp is selected if using one

**Enhancer multiplier not applying?**

- Damage calculation happens in SessionService
- Check LoadoutService.calculateEnhancedDamage()
- Multiplier only affects damage output, not costs

## Future Enhancements

- [ ] Loadout templates (pre-configured popular setups)
- [ ] Loadout comparison tool (side-by-side stats)
- [ ] Performance analytics per loadout (ROI, efficiency)
- [ ] Import/export loadouts (share with friends)
- [ ] Recommended loadouts per mob type
- [ ] Tier progression tracking (enhancer breakpoints)
