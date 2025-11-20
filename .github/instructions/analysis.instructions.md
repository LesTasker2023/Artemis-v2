# ARTEMIS Analytics System - Implementation Plan

## 📊 Available Data Sources

### **1. Session Event Data** (Real-time, Granular)
All data stored as immutable events in `artemis-v2.db`:

**Combat Events:**
- `SHOT_FIRED`: weapon, ammo used, ammo cost
- `HIT_REGISTERED`: damage, mob, critical flag, damage resisted
- `MISS_REGISTERED`: weapon
- `DODGE_REGISTERED`: actor (player/mob)
- `EVADE_REGISTERED`: actor (player/mob)
- `DEFLECT_REGISTERED`: damage deflected

**Mob Events:**
- `MOB_KILLED`: name, maturity, species, GPS location, mob ID
- `PLAYER_DEATH`: mob name, GPS location, decay cost

**Economic Events:**
- `LOOT_RECEIVED`: items array (name, quantity, TT value, MV value)
- Total loot value, markup, global flag

**GPS Events:**
- `GPS_UPDATE`: lon, lat, timestamp
- Continuous tracking during sessions

**Skill Events:**
- `SKILL_GAIN`: skill name, amount gained
- `SKILL_RANK_GAIN`: skill name, new rank
- `ATTRIBUTE_GAIN`: attribute name, amount
- `NEW_SKILL_ACQUIRED`: skill name

**Session Metadata:**
- Start/end time, duration
- Loadout ID (weapon, amp, armor)
- Tags, notes

### **2. Entropia Database** (`data/entropia.db`)

**Mobs Table:**
```sql
CREATE TABLE mobs (
  id INTEGER PRIMARY KEY,
  name TEXT,              -- "Proteron Young", "Atrox Provider"
  planet TEXT,            -- "Calypso"
  hp INTEGER,             -- Base health
  maturity TEXT,          -- "Young", "Mature", "Old", "Provider"
  min_damage INTEGER,
  max_damage INTEGER,
  loot_table TEXT,        -- JSON array of possible loot
  species TEXT,           -- "Proteron", "Atrox"
  mob_type TEXT,
  level INTEGER
);
```

**Nexus Spawns Table:** (775 spawn areas with polygon data)
```sql
CREATE TABLE nexus_spawns (
  id TEXT PRIMARY KEY,
  name TEXT,              -- "Proteron - Mature/Old/Provider/Young"
  planet TEXT,
  type TEXT,              -- "MobArea"
  shape TEXT,             -- "Polygon"
  center_lon REAL,
  center_lat REAL,
  density TEXT,           -- "Low", "Medium", "High"
  data_json TEXT          -- JSON: { vertices: [...], shape, altitude }
);
```

**Items Table:**
```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,          -- "Material", "Weapon", "Armor"
  tt_value REAL,
  stackable INTEGER,
  max_stack INTEGER,
  weight REAL
);
```

**Markups Table:** (Time-series pricing)
```sql
CREATE TABLE markups (
  id INTEGER PRIMARY KEY,
  item_id INTEGER,
  planet TEXT,
  day REAL,               -- Daily average markup
  week REAL,
  month REAL,
  year REAL,
  sample_size INTEGER,
  recorded_at TIMESTAMP
);
```

### **3. Loadout Equipment Data** (`data/*.json`)
- `weapons.json`: All weapons with stats, ammo types, DPS
- `amps.json`: Amplifiers with damage multipliers, costs
- `armorsets.json`: Armor with protection values, decay rates
- `armor-enhancers.json`: Plating upgrades
- `weapon-enhancers.json`: Weapon attachments (scopes, sights)

---

## 🎯 Analytics Features to Build

### **1. Hunting Zone Intelligence** (GPS Heatmap)

**Purpose:** Show where you make the most profit and where you die.

**Data Required:**
- Session events with GPS coordinates
- Kill locations (from `MOB_KILLED` events)
- Death locations (from `PLAYER_DEATH` events)
- Loot value and costs per kill

**Metrics to Calculate:**
```typescript
interface HuntingZone {
  center: { lon: number; lat: number };
  radius: number;                    // meters
  
  // Performance
  totalSessions: number;
  totalKills: number;
  totalDeaths: number;
  totalProfit: number;               // loot - costs
  profitPerHour: number;
  returnRate: number;                // loot / costs
  
  // Combat
  avgAccuracy: number;
  avgKillTime: number;               // seconds
  avgShotsPerKill: number;
  
  // Mob composition
  mobEncounters: {
    [mobName: string]: {
      count: number;
      avgLootValue: number;
      profitPerKill: number;
    };
  };
  
  // Safety
  dangerLevel: number;               // deaths per hour (0-1 normalized)
  avgDamageTaken: number;
  
  // Rating
  overallScore: number;              // 0-100
  recommendation: 'excellent' | 'good' | 'average' | 'poor';
}
```

**Algorithm - Zone Detection:**
```typescript
// 1. Cluster kills into zones (500m radius)
// 2. For each zone, aggregate all kills within radius
// 3. Calculate metrics from events
// 4. Score zones based on:
//    - Profit/hour (weight: 40%)
//    - Return rate (weight: 30%)
//    - Safety/deaths (weight: 20%)
//    - Consistency (weight: 10%)
```

**Scoring Thresholds:**
- **Excellent**: Profit/hour > 50 PED, return > 1.08, deaths < 0.3/hour
- **Good**: Profit/hour > 30 PED, return > 1.03, deaths < 0.5/hour
- **Average**: Profit/hour > 10 PED, return > 0.98
- **Poor**: Negative profit or high death rate

**UI Component:**
- Mapbox GL heatmap overlay
- Color gradient: Green (profit) → Yellow → Red (loss)
- Death markers as red skull icons
- Click zone → Show detailed breakdown modal

---

### **2. Mob Profitability Rankings**

**Purpose:** Determine which mobs are most profitable to hunt.

**Data Required:**
- `MOB_KILLED` events (mob name, maturity, location)
- `LOOT_RECEIVED` events linked to kills
- `SHOT_FIRED` events (ammo costs)
- Time between kills (kill duration)
- Damage taken during fight

**Metrics per Mob Type:**
```typescript
interface MobProfitability {
  mobName: string;                   // "Proteron Mature"
  species: string;                   // "Proteron"
  maturity: string;                  // "Mature"
  
  // Sample size
  totalKills: number;
  totalSessions: number;
  lastKilled: number;                // timestamp
  
  // Economics
  avgLootValue: number;              // PED per kill
  avgAmmoCost: number;               // PED per kill
  avgDecayCost: number;              // PED per kill (estimated)
  profitPerKill: number;             // loot - costs
  returnRate: number;                // loot / costs
  profitPerHour: number;             // (profitPerKill / avgKillTime) * 3600
  
  // Combat
  avgKillTime: number;               // seconds
  avgShotsToKill: number;
  avgAccuracy: number;
  avgDamageTaken: number;
  avgDamageDealt: number;
  
  // Loot patterns
  globalRate: number;                // % of kills that global
  avgGlobalValue: number;
  commonLoot: string[];              // Top 5 items
  
  // Efficiency
  damagePerPED: number;              // Total damage / total cost
  efficiencyScore: number;           // 0-100 composite
  
  // Recommendation
  recommendation: 'hunt' | 'neutral' | 'avoid';
  reason: string;
}
```

**Recommendation Logic:**
```typescript
function recommendMob(mob: MobProfitability): 'hunt' | 'neutral' | 'avoid' {
  // AVOID if:
  if (mob.returnRate < 0.95) return 'avoid';  // 5%+ loss
  if (mob.profitPerHour < -10) return 'avoid'; // Losing money fast
  if (mob.avgDamageTaken > 500 && mob.profitPerHour < 20) return 'avoid'; // Dangerous + unprofitable
  
  // HUNT if:
  if (mob.returnRate > 1.05 && mob.profitPerHour > 30) return 'hunt'; // 5%+ profit + good rate
  if (mob.returnRate > 1.10) return 'hunt'; // Excellent return
  if (mob.profitPerHour > 50) return 'hunt'; // Excellent rate
  
  // Otherwise NEUTRAL
  return 'neutral';
}
```

**UI Component:**
- Sortable table with color-coded rows
- Columns: Mob, Kills, Profit/Kill, Profit/Hour, Return %, Recommendation
- Click row → Detailed breakdown with charts
- Filter by species, maturity, profitability

---

### **3. Loadout Performance Comparison**

**Purpose:** Find your most profitable weapon/amp/armor combos.

**Data Required:**
- Session loadout IDs
- Session stats (profit, return rate, accuracy)
- Equipment costs and decay rates

**Metrics per Loadout:**
```typescript
interface LoadoutPerformance {
  loadoutId: string;
  name: string;
  
  // Equipment
  weapon: string;
  amp: string | null;
  armor: string;
  
  // Usage
  totalSessions: number;
  totalHours: number;
  lastUsed: number;
  
  // Performance
  avgProfitPerHour: number;
  avgReturnRate: number;
  avgAccuracy: number;
  avgDamagePerShot: number;
  
  // Economics
  totalProfit: number;
  totalAmmoCost: number;
  totalDecayCost: number;
  costPerHour: number;
  
  // Comparison
  betterThan: number;                // % of other loadouts
  recommendation: 'recommended' | 'good' | 'average' | 'expensive';
}
```

**Ranking Algorithm:**
```typescript
// Score = (0.5 * profitPerHour) + (0.3 * returnRate) + (0.2 * efficiency)
// Where efficiency = damagePerPED / averageDamagePerPED
```

**UI Component:**
- Card grid layout (3 columns)
- Each card shows: equipment, profit/hour, return rate, sessions
- Highlight "BEST PERFORMER" badge
- "Switch to this loadout" button
- Comparison chart: Profit/hour over time per loadout

---

### **4. Session Performance Trends**

**Purpose:** Track improvement over time.

**Data Required:**
- All sessions sorted by date
- Aggregate metrics per session

**Charts to Show:**
1. **Profit/Hour Timeline** (line chart)
   - X-axis: Date
   - Y-axis: PED per hour
   - Color: Green above breakeven, red below

2. **Return Rate Trend** (line chart)
   - X-axis: Date
   - Y-axis: Return % (with 100% breakeven line)

3. **Accuracy Progression** (line chart)
   - X-axis: Date
   - Y-axis: Accuracy %

4. **Skill Gains per Hour** (stacked area chart)
   - X-axis: Date
   - Y-axis: Total skill points gained
   - Stacked by skill category

**Insights to Generate:**
```typescript
interface TrendInsight {
  type: 'improvement' | 'decline' | 'stable';
  metric: string;                    // "Profit/hour", "Return rate"
  change: number;                    // +23% or -15%
  timeframe: string;                 // "last 7 days"
  message: string;                   // "Your profit/hour increased 23% this week!"
}
```

**UI Component:**
- Recharts line/area charts
- Time period selector: 7 days, 30 days, all time
- Key insights cards above charts
- Export data button (CSV download)

---

### **5. Spawn Area Recommendations**

**Purpose:** Suggest new hunting spots based on your level/gear.

**Data Required:**
- 775 spawn polygons from `nexus_spawns`
- Mob HP data from `mobs` table
- Your past session performance
- Your current loadout

**Recommendation Algorithm:**
```typescript
interface SpawnRecommendation {
  spawnId: string;
  spawnName: string;                 // "Proteron - Mature/Old/Provider/Young"
  location: { lon: number; lat: number };
  
  // Mob info
  mobTypes: string[];                // All maturities in this spawn
  avgMobHP: number;
  estimatedDifficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  
  // Your history (if hunted before)
  yourKills?: number;
  yourProfitPerHour?: number;
  yourReturnRate?: number;
  
  // Predictions (if not hunted)
  estimatedProfitPerHour: number;    // Based on mob HP + loot tables
  estimatedReturnRate: number;
  confidenceLevel: number;           // 0-1 (based on sample size)
  
  // Comparison
  betterThan: number;                // % of other spawns
  distanceFromYou: number;           // meters (if GPS available)
  
  // Recommendation
  score: number;                     // 0-100
  reason: string;
}
```

**Prediction Model:**
```typescript
// For unvisited spawns, estimate profit based on:
// 1. Mob HP → ammo cost (shots = HP / weaponDamage)
// 2. Loot table → avg loot value (from items table + markups)
// 3. Kill time = shots * weapon speed
// 4. Profit/hour = (lootValue - ammoCost) / killTime * 3600

// Adjust prediction based on:
// - Your accuracy (lower accuracy = more shots)
// - Your weapon DPS (higher DPS = faster kills)
// - Mob density (higher density = less travel time)
```

**UI Component:**
- List of spawn cards (sorted by score)
- Each card shows:
  - Spawn name + mob types
  - Distance from you
  - Estimated profit/hour (or actual if visited)
  - Difficulty badge
  - "Navigate here" button (sends GPS to Discord)
- Filter: Difficulty, Distance, Profit range
- Map view toggle (show on Mapbox)

---

### **6. Economic Efficiency Dashboard**

**Purpose:** Optimize your PED spending.

**Metrics to Show:**

**Overall Efficiency:**
```typescript
interface EfficiencyMetrics {
  // Damage efficiency
  totalDamageDealt: number;
  totalPEDSpent: number;
  damagePerPED: number;              // Primary metric
  
  // Cost breakdown
  ammoCosts: number;                 // %
  decayCosts: number;                // %
  deathCosts: number;                // %
  
  // Comparisons
  yourDamagePerPED: number;          // 145
  avgDamagePerPED: number;           // 180 (hypothetical benchmark)
  top10PercentDamagePerPED: number;  // 200
  
  // Improvement suggestions
  suggestions: Array<{
    action: string;                  // "Switch to Weapon X"
    expectedGain: number;            // +15 damage/PED
    cost: number;                    // PED to implement
  }>;
}
```

**ROI Calculator:**
```typescript
interface EquipmentROI {
  equipmentName: string;
  purchasePrice: number;             // TT value
  estimatedLifespan: number;         // uses
  costPerUse: number;
  breakEvenSessions: number;
  expectedProfit: number;            // Over lifetime
}
```

**UI Component:**
- Large metric cards: Damage/PED, Cost breakdown pie chart
- Comparison bar chart: You vs Average vs Top 10%
- Improvement suggestions list with "+" buttons
- ROI calculator tool (input gear, see breakeven)

---

### **7. Skill Progression Analytics**

**Purpose:** Optimize skill gain efficiency.

**Data Required:**
- `SKILL_GAIN` events with timestamps
- `SKILL_RANK_GAIN` events
- Session costs during skill gains

**Metrics per Skill:**
```typescript
interface SkillAnalytics {
  skillName: string;                 // "Rifle (Hit)"
  
  // Progression
  totalGains: number;                // All-time
  currentRank: number;
  gainsToNextRank: number;
  
  // Efficiency
  gainsPerHour: number;
  gainsPerPED: number;               // Skill points / PED spent
  avgGainValue: number;              // Avg gain amount
  
  // Timeline
  recentGains: Array<{
    timestamp: number;
    amount: number;
    sessionId: string;
  }>;
  
  // Predictions
  estimatedTimeToNextRank: number;   // hours
  estimatedCostToNextRank: number;   // PED
  
  // Best hunting spots for this skill
  topLocations: Array<{
    location: { lon: number; lat: number };
    gainsPerHour: number;
    costPerGain: number;
  }>;
}
```

**UI Component:**
- Skill tree visualization (all skills)
- Click skill → Detailed view with charts
- Gains over time (line chart)
- Best hunting spots map
- "Optimize for [skill]" mode (filter spawns)

---

### **8. Mob Intelligence System**

**Purpose:** Aggregate community knowledge (or just your data) about each mob.

**Data Required:**
- All `MOB_KILLED` events across all sessions
- Combat patterns (dodge rate, damage patterns)
- Loot frequency analysis

**Intelligence Report per Mob:**
```typescript
interface MobIntelligence {
  mobName: string;
  species: string;
  maturity: string;
  
  // Combat characteristics
  avgHP: number;
  hpRange: { min: number; max: number };
  avgDamagePerHit: number;
  dodgeRate: number;                 // % of attacks dodged
  evadeRate: number;
  resistanceRate: number;            // % damage resisted
  
  // Your performance vs mob
  yourKills: number;
  yourAccuracy: number;
  yourAvgKillTime: number;
  yourProfitPerKill: number;
  
  // Loot analysis
  lootFrequency: {
    [itemName: string]: {
      dropRate: number;              // % of kills
      avgQuantity: number;
      avgValue: number;
    };
  };
  bestLoot: string[];                // Top 5 valuable items
  globalRate: number;
  
  // Tactical info
  strengths: string[];               // ["High dodge rate", "Resists stabbing"]
  weaknesses: string[];              // ["Vulnerable to impact", "Low HP"]
  recommendedWeapons: string[];      // Based on damage type
  recommendedLoadout: string;
  
  // AI-generated tip
  tipOfTheDay: string;               // "This mob dodges frequently. Use high accuracy weapons."
}
```

**Tip Generation Logic:**
```typescript
function generateTip(intel: MobIntelligence): string {
  if (intel.dodgeRate > 0.3) return "This mob dodges frequently. Improve accuracy or use weapons with hit bonuses.";
  if (intel.resistanceRate > 0.2) return "High damage resistance detected. Consider armor-penetrating weapons.";
  if (intel.globalRate > 0.15) return "High global rate! Excellent for loot hunting.";
  if (intel.yourAccuracy < 0.6) return "Your accuracy is low against this mob. Try using scopes or aim enhancers.";
  return "Standard mob. Focus on ammo efficiency.";
}
```

**UI Component:**
- Search bar: Type mob name
- Mob profile card:
  - Image (if available)
  - Stats table
  - Strengths/weaknesses badges
  - Loot frequency chart (pie chart)
  - Your performance comparison
- "Hunt this mob" button → Filter sessions/spawns

---

## 🗄️ Database Queries to Implement

### **Analytics Service Layer:**

```typescript
class AnalyticsService {
  // Zone analytics
  static async getHuntingZones(userId: string): Promise<HuntingZone[]>;
  static async getZoneDetails(zoneId: string): Promise<HuntingZone>;
  
  // Mob analytics
  static async getMobProfitability(userId: string): Promise<MobProfitability[]>;
  static async getMobIntelligence(mobName: string): Promise<MobIntelligence>;
  
  // Loadout analytics
  static async getLoadoutPerformance(userId: string): Promise<LoadoutPerformance[]>;
  static async compareLoadouts(loadoutIds: string[]): Promise<LoadoutComparison>;
  
  // Trends
  static async getSessionTrends(userId: string, days: number): Promise<TrendData>;
  static async getSkillProgression(userId: string, skillName?: string): Promise<SkillAnalytics[]>;
  
  // Recommendations
  static async getSpawnRecommendations(userId: string, limit: number): Promise<SpawnRecommendation[]>;
  static async getEfficiencyInsights(userId: string): Promise<EfficiencyMetrics>;
}
```

### **Example Query - Most Profitable Zones:**

```sql
-- Aggregate kills by zone (500m clusters)
WITH kill_zones AS (
  SELECT 
    ROUND(location_lon / 500) * 500 AS zone_lon,
    ROUND(location_lat / 500) * 500 AS zone_lat,
    session_id,
    mob_name,
    loot_value,
    ammo_cost,
    decay_cost,
    kill_duration
  FROM (
    SELECT 
      mk.payload->>'location'->>'lon' AS location_lon,
      mk.payload->>'location'->>'lat' AS location_lat,
      mk.session_id,
      mk.payload->>'mobName' AS mob_name,
      COALESCE(lr.payload->>'totalTTValue', 0) AS loot_value,
      -- Calculate ammo cost from shots between kills
      SUM(sf.payload->>'ammoCost') AS ammo_cost,
      -- Estimate decay
      SUM(sf.payload->>'ammoCost') * 0.02 AS decay_cost,
      -- Kill duration = time between kills
      (mk.timestamp - LAG(mk.timestamp) OVER (PARTITION BY mk.session_id ORDER BY mk.timestamp)) / 1000 AS kill_duration
    FROM events mk
    LEFT JOIN events lr ON lr.type = 'LOOT_RECEIVED' AND lr.timestamp = mk.timestamp
    LEFT JOIN events sf ON sf.type = 'SHOT_FIRED' AND sf.session_id = mk.session_id AND sf.timestamp BETWEEN LAG(mk.timestamp) OVER (PARTITION BY mk.session_id ORDER BY mk.timestamp) AND mk.timestamp
    WHERE mk.type = 'MOB_KILLED'
    GROUP BY mk.id
  )
)
SELECT 
  zone_lon,
  zone_lat,
  COUNT(*) AS total_kills,
  COUNT(DISTINCT session_id) AS total_sessions,
  SUM(loot_value - ammo_cost - decay_cost) AS total_profit,
  AVG((loot_value - ammo_cost - decay_cost) / kill_duration * 3600) AS profit_per_hour,
  AVG(loot_value / NULLIF(ammo_cost + decay_cost, 0)) AS return_rate,
  -- Mob composition (JSON)
  JSON_GROUP_ARRAY(
    JSON_OBJECT(
      'mobName', mob_name,
      'count', COUNT(*),
      'avgLoot', AVG(loot_value)
    )
  ) AS mob_composition
FROM kill_zones
WHERE kill_duration > 0
GROUP BY zone_lon, zone_lat
HAVING total_kills >= 10
ORDER BY profit_per_hour DESC;
```

---

## 🎨 UI Implementation Priority

### **Phase 1: Core Analytics** (Week 1-2)
1. ✅ Database queries and service layer
2. ✅ Mob profitability table (sortable, filterable)
3. ✅ Loadout performance cards
4. ✅ Session trends charts (profit/hour, return rate)

### **Phase 2: GPS Intelligence** (Week 3)
1. ✅ Hunting zone detection algorithm
2. ✅ GPS heatmap with Mapbox
3. ✅ Zone detail modal
4. ✅ Death location markers

### **Phase 3: Recommendations** (Week 4)
1. ✅ Spawn recommendation engine
2. ✅ Spawn cards with filtering
3. ✅ "Navigate here" Discord integration
4. ✅ Efficiency insights & suggestions

### **Phase 4: Advanced Features** (Week 5+)
1. ✅ Mob intelligence profiles
2. ✅ Skill progression analytics
3. ✅ Equipment ROI calculator
4. ✅ Achievements & badges

---

## 📐 Visual Design Guidelines

**Color Scheme:**
- **Profit**: Green gradient (#22c55e → #16a34a)
- **Loss**: Red gradient (#ef4444 → #dc2626)
- **Neutral**: Gray (#6b7280)
- **Highlight**: Blue (#3b82f6)

**Data Visualization:**
- Use Recharts for charts (already in package.json)
- Mapbox GL for GPS heatmap
- Lucide React icons (NO EMOJIS)
- Shadcn/ui components for cards, tables, modals

**Responsiveness:**
- Desktop-first (hunters use PCs)
- Mobile: Stack components vertically
- Tablet: 2-column grid

---

## 🚀 Performance Considerations

**Database Optimization:**
- Index on: `session_id`, `timestamp`, `event_type`, `mob_name`
- Materialize views for common aggregations
- Cache zone calculations (rebuild on new sessions)

**UI Optimization:**
- Lazy load charts (only render visible tabs)
- Virtual scroll for large tables (>100 rows)
- Debounce filters (300ms)
- Memoize expensive calculations

**Data Freshness:**
- Real-time: Session in progress (update every event)
- Historical: Cache for 5 minutes
- Recommendations: Cache for 1 hour

---

## 🧪 Testing Strategy

**Unit Tests:**
- AnalyticsService query logic
- Zone clustering algorithm
- Profitability scoring
- Recommendation engine

**Integration Tests:**
- Database queries with mock data
- Cross-referencing mobs + spawns + loot

**E2E Tests:**
- Navigate Analytics page
- Filter/sort tables
- Click spawn → See details
- Export data

---

## 📊 Success Metrics

**User Engagement:**
- % of users who visit Analytics page
- Time spent on Analytics page
- Most viewed sections

**Actionable Insights:**
- % of users who change loadouts based on recommendations
- % of users who try recommended spawns
- Avg profit/hour improvement after using Analytics

**Data Quality:**
- % of kills with successful mob identification
- GPS coverage (% of events with location)
- Event completeness (all expected events present)

---

## 🎯 MVP Definition

**Minimum Viable Analytics Page:**

1. **Mob Profitability Table**
   - Sort by profit/hour
   - Color-coded recommendations
   - Click for details

2. **Loadout Performance Cards**
   - Top 3 loadouts
   - Profit/hour comparison

3. **Session Trends Chart**
   - Profit/hour over last 30 days
   - Return rate trend line

4. **GPS Heatmap** (basic)
   - Show kill locations as dots
   - Color by profit (green/red)
   - No polygon overlays (v2 feature)

**Out of Scope for MVP:**
- Spawn recommendations (requires prediction model)
- Mob intelligence profiles (needs AI tips)
- Skill progression (complex calculations)
- Efficiency suggestions (needs benchmarking)

**MVP Timeline:** 2 weeks

---

## 🔮 Future Enhancements

**Machine Learning:**
- Predict best hunting time based on historical patterns
- Anomaly detection (unusual profit spikes/drops)
- Personalized recommendations based on playstyle

**Community Features:**
- Compare your stats to friends
- Global leaderboards (opt-in)
- Share hunting zones

**Advanced Visualizations:**
- 3D terrain map with elevation
- Animated kill paths
- Loot timeline (show when globals happened)

**Export & Reporting:**
- PDF report generation
- Excel export with charts
- Weekly email summary

---

**End of Plan** ✅
