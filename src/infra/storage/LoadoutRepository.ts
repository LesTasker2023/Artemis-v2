/**
 * LoadoutRepository
 * SQLite persistence for loadouts
 */

import Database from 'better-sqlite3';
import { Loadout } from '../../core/types/Loadout';
import { LoadoutService } from '../../core/services/LoadoutService';

export class LoadoutRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  /**
   * Create loadouts table
   */
  private initialize(): void {
    // Check if loadouts table exists and has the correct schema
    const tableInfo = this.db.prepare("PRAGMA table_info(loadouts)").all() as any[];
    const hasTimestamp = tableInfo.some(col => col.name === 'timestamp');
    
    // If table exists but doesn't have timestamp column, drop and recreate
    if (tableInfo.length > 0 && !hasTimestamp) {
      console.log('⚠️ Loadouts table schema mismatch, recreating...');
      this.db.exec('DROP TABLE IF EXISTS loadouts');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loadouts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        
        -- Equipment names
        weapon TEXT,
        amp TEXT,
        absorber TEXT,
        armor_set TEXT,
        armor_plating TEXT,
        scope TEXT,
        sight TEXT,
        
        -- Full equipment data (JSON)
        weapon_data TEXT,
        amp_data TEXT,
        absorber_data TEXT,
        armor_set_data TEXT,
        armor_plating_data TEXT,
        scope_data TEXT,
        sight_data TEXT,
        
        -- Enhancers (JSON)
        weapon_enhancers TEXT,
        armor_enhancers TEXT,
        
        -- Calculated costs (JSON)
        costs TEXT,
        
        -- Manual cost override
        use_manual_cost INTEGER DEFAULT 0,
        manual_cost_override REAL,
        
        -- Metadata
        timestamp INTEGER NOT NULL,
        total_ped_cycled REAL DEFAULT 0,
        version TEXT DEFAULT '2.0',
        tags TEXT,
        notes TEXT,
        
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_loadouts_user_id ON loadouts(user_id);
      CREATE INDEX IF NOT EXISTS idx_loadouts_timestamp ON loadouts(timestamp);
    `);

    // Migration: Add manual cost columns if they don't exist
    const hasManualCost = tableInfo.some(col => col.name === 'use_manual_cost');
    if (tableInfo.length > 0 && !hasManualCost) {
      console.log('🔄 Migrating loadouts table - adding manual cost columns...');
      this.db.exec(`
        ALTER TABLE loadouts ADD COLUMN use_manual_cost INTEGER DEFAULT 0;
        ALTER TABLE loadouts ADD COLUMN manual_cost_override REAL;
      `);
      console.log('✅ Migration complete');
    }
  }

  /**
   * Save a loadout (insert or update)
   */
  async save(loadout: Loadout): Promise<void> {
    // DON'T recalculate costs - preserve manual override if set
    // Costs are already calculated in the UI before saving
    const loadoutToSave = loadout;

    const stmt = this.db.prepare(`
      INSERT INTO loadouts (
        id, user_id, name,
        weapon, amp, absorber, armor_set, armor_plating, scope, sight,
        weapon_data, amp_data, absorber_data, armor_set_data, armor_plating_data, scope_data, sight_data,
        weapon_enhancers, armor_enhancers, costs,
        use_manual_cost, manual_cost_override,
        timestamp, total_ped_cycled, version, tags, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        name = excluded.name,
        weapon = excluded.weapon,
        amp = excluded.amp,
        absorber = excluded.absorber,
        armor_set = excluded.armor_set,
        armor_plating = excluded.armor_plating,
        scope = excluded.scope,
        sight = excluded.sight,
        weapon_data = excluded.weapon_data,
        amp_data = excluded.amp_data,
        absorber_data = excluded.absorber_data,
        armor_set_data = excluded.armor_set_data,
        armor_plating_data = excluded.armor_plating_data,
        scope_data = excluded.scope_data,
        sight_data = excluded.sight_data,
        weapon_enhancers = excluded.weapon_enhancers,
        armor_enhancers = excluded.armor_enhancers,
        costs = excluded.costs,
        use_manual_cost = excluded.use_manual_cost,
        manual_cost_override = excluded.manual_cost_override,
        timestamp = excluded.timestamp,
        total_ped_cycled = excluded.total_ped_cycled,
        version = excluded.version,
        tags = excluded.tags,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      loadoutToSave.id,
      loadoutToSave.userId,
      loadoutToSave.name,
      loadoutToSave.weapon || null,
      loadoutToSave.amp || null,
      loadoutToSave.absorber || null,
      loadoutToSave.armorSet || null,
      loadoutToSave.armorPlating || null,
      loadoutToSave.scope || null,
      loadoutToSave.sight || null,
      loadoutToSave.weaponData ? JSON.stringify(loadoutToSave.weaponData) : null,
      loadoutToSave.ampData ? JSON.stringify(loadoutToSave.ampData) : null,
      loadoutToSave.absorberData ? JSON.stringify(loadoutToSave.absorberData) : null,
      loadoutToSave.armorSetData ? JSON.stringify(loadoutToSave.armorSetData) : null,
      loadoutToSave.armorPlatingData ? JSON.stringify(loadoutToSave.armorPlatingData) : null,
      loadoutToSave.scopeData ? JSON.stringify(loadoutToSave.scopeData) : null,
      loadoutToSave.sightData ? JSON.stringify(loadoutToSave.sightData) : null,
      JSON.stringify(loadoutToSave.weaponEnhancers),
      JSON.stringify(loadoutToSave.armorEnhancers),
      loadoutToSave.costs ? JSON.stringify(loadoutToSave.costs) : null,
      loadoutToSave.useManualCost ? 1 : 0,
      loadoutToSave.costs?.manualCostOverride ?? null,
      loadoutToSave.timestamp,
      loadoutToSave.totalPEDCycled,
      loadoutToSave.version,
      JSON.stringify(loadoutToSave.tags),
      loadoutToSave.notes || null,
      Date.now()
    );
  }

  /**
   * Find loadout by ID
   */
  async findById(id: string): Promise<Loadout | null> {
    const stmt = this.db.prepare('SELECT * FROM loadouts WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.rowToLoadout(row);
  }

  /**
   * Find all loadouts for a user
   */
  async findAll(userId?: string): Promise<Loadout[]> {
    const stmt = userId
      ? this.db.prepare('SELECT * FROM loadouts WHERE user_id = ? ORDER BY timestamp DESC')
      : this.db.prepare('SELECT * FROM loadouts ORDER BY timestamp DESC');

    const rows = userId ? stmt.all(userId) : stmt.all();

    return (rows as any[]).map(row => this.rowToLoadout(row));
  }

  /**
   * Delete a loadout
   */
  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM loadouts WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Count loadouts
   */
  async count(userId?: string): Promise<number> {
    const stmt = userId
      ? this.db.prepare('SELECT COUNT(*) as count FROM loadouts WHERE user_id = ?')
      : this.db.prepare('SELECT COUNT(*) as count FROM loadouts');

    const result = userId ? stmt.get(userId) : stmt.get();
    return (result as any).count;
  }

  /**
   * Convert database row to Loadout object
   */
  private rowToLoadout(row: any): Loadout {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      weapon: row.weapon || undefined,
      amp: row.amp || undefined,
      absorber: row.absorber || undefined,
      armorSet: row.armor_set || undefined,
      armorPlating: row.armor_plating || undefined,
      scope: row.scope || undefined,
      sight: row.sight || undefined,
      weaponData: row.weapon_data ? JSON.parse(row.weapon_data) : undefined,
      ampData: row.amp_data ? JSON.parse(row.amp_data) : undefined,
      absorberData: row.absorber_data ? JSON.parse(row.absorber_data) : undefined,
      armorSetData: row.armor_set_data ? JSON.parse(row.armor_set_data) : undefined,
      armorPlatingData: row.armor_plating_data ? JSON.parse(row.armor_plating_data) : undefined,
      scopeData: row.scope_data ? JSON.parse(row.scope_data) : undefined,
      sightData: row.sight_data ? JSON.parse(row.sight_data) : undefined,
      weaponEnhancers: JSON.parse(row.weapon_enhancers || '{}'),
      armorEnhancers: JSON.parse(row.armor_enhancers || '{}'),
      costs: row.costs ? JSON.parse(row.costs) : undefined,
      useManualCost: row.use_manual_cost === 1,
      timestamp: row.timestamp,
      totalPEDCycled: row.total_ped_cycled,
      version: row.version,
      tags: JSON.parse(row.tags || '[]'),
      notes: row.notes || undefined,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
