/**
 * Database Schema for ARTEMIS v2
 * Type-safe SQLite schema using Kysely
 */

import { Generated } from 'kysely';

export interface Database {
  users: UserTable;
  sessions: SessionTable;
  events: EventTable;
  loadouts: LoadoutTable;
}

export interface UserTable {
  id: string;
  username: string;
  discord_webhook_url: string | null;
  share_gps: number; // SQLite boolean (0/1)
  gps_visibility: string; // 'public' | 'friends' | 'off'
  created_at: Generated<number>;
  updated_at: Generated<number>;
}

export interface SessionTable {
  id: string;
  name: string;
  user_id: string;
  start_time: number;
  end_time: number | null;
  duration: number;
  loadout_id: string | null;
  stats: string | null; // JSON - calculated session statistics
  tags: string; // JSON array
  notes: string | null;
  version: string;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}

export interface EventTable {
  id: string;
  session_id: string;
  type: string;
  timestamp: number;
  payload: string; // JSON
  created_at: Generated<number>;
}

export interface LoadoutTable {
  id: string;
  name: string;
  user_id: string;
  weapon_id: string | null;
  armor_set: string | null;
  data: string; // JSON with full loadout details
  created_at: Generated<number>;
  updated_at: Generated<number>;
}
