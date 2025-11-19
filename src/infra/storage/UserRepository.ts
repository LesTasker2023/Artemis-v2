/**
 * User Repository
 * Handles persistence of user profiles and settings
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../db/connection';
import type { UserTable } from '../db/schema';

export interface User {
  id: string;
  username: string;
  discordWebhookUrl: string | null;
  shareGPS: boolean;
  gpsVisibility: 'public' | 'friends' | 'off';
  createdAt: number;
  updatedAt: number;
}

export class UserRepository {
  /**
   * Create or update a user
   */
  static async save(user: User): Promise<void> {
    const db = getDatabase();
    const now = Date.now();

    const dbUser: Omit<UserTable, 'created_at' | 'updated_at'> = {
      id: user.id,
      username: user.username,
      discord_webhook_url: user.discordWebhookUrl,
      share_gps: user.shareGPS ? 1 : 0,
      gps_visibility: user.gpsVisibility,
    };

    // Try update first
    const result = await db
      .updateTable('users')
      .set({
        ...dbUser,
        updated_at: now,
      })
      .where('id', '=', user.id)
      .executeTakeFirst();

    // If no rows updated, insert
    if (result.numUpdatedRows === BigInt(0)) {
      await db
        .insertInto('users')
        .values({
          ...dbUser,
          created_at: now,
          updated_at: now,
        })
        .execute();
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const db = getDatabase();

    const row = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;

    return this.rowToUser(row);
  }

  /**
   * Find user by username
   */
  static async findByUsername(username: string): Promise<User | null> {
    const db = getDatabase();

    const row = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();

    if (!row) return null;

    return this.rowToUser(row);
  }

  /**
   * Get or create current user
   * Uses system username if no user exists
   */
  static async getCurrentUser(): Promise<User> {
    const db = getDatabase();

    // Try to get first user (single-user app for now)
    const row = await db
      .selectFrom('users')
      .selectAll()
      .executeTakeFirst();

    if (row) {
      return this.rowToUser(row);
    }

    // Create default user
    const defaultUser: User = {
      id: randomUUID(),
      username: 'Artemis_User',
      discordWebhookUrl: null,
      shareGPS: false,
      gpsVisibility: 'off',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.save(defaultUser);
    return defaultUser;
  }

  /**
   * Update user's Discord webhook URL
   */
  static async updateDiscordWebhook(userId: string, webhookUrl: string | null): Promise<void> {
    const db = getDatabase();

    await db
      .updateTable('users')
      .set({
        discord_webhook_url: webhookUrl,
        updated_at: Date.now(),
      })
      .where('id', '=', userId)
      .execute();
  }

  /**
   * Update GPS sharing settings
   */
  static async updateGPSSettings(
    userId: string,
    shareGPS: boolean,
    gpsVisibility: 'public' | 'friends' | 'off'
  ): Promise<void> {
    const db = getDatabase();

    await db
      .updateTable('users')
      .set({
        share_gps: shareGPS ? 1 : 0,
        gps_visibility: gpsVisibility,
        updated_at: Date.now(),
      })
      .where('id', '=', userId)
      .execute();
  }

  /**
   * Convert database row to User object
   */
  private static rowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      discordWebhookUrl: row.discord_webhook_url,
      shareGPS: row.share_gps === 1,
      gpsVisibility: row.gps_visibility as 'public' | 'friends' | 'off',
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }
}
