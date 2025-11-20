/**
 * User Type Definitions
 * User profiles, authentication, and social features
 */

import { z } from 'zod';

// ==================== User Profile ====================

export const User = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(32),
  
  // Discord integration
  discordId: z.string().optional(),
  discordUsername: z.string().optional(),
  discordAvatar: z.string().url().optional(),
  
  // Settings
  settings: z.object({
    // GPS sharing
    shareGPS: z.boolean().default(false),
    gpsVisibility: z.enum(['public', 'friends', 'off']).default('off'),
    
    // Chat log path (for auto-detection)
    chatLogPath: z.string().optional(),
    
    // Privacy
    showOnlineStatus: z.boolean().default(true),
    allowFriendRequests: z.boolean().default(true),
    
    // Notifications
    notifyOnFriendOnline: z.boolean().default(true),
    notifyOnFriendNearby: z.boolean().default(true),
  }).default({}),
  
  // Social
  friendIds: z.array(z.string().uuid()).default([]),
  blockedIds: z.array(z.string().uuid()).default([]),
  
  // Metadata
  createdAt: z.number(),
  lastSeen: z.number(),
  version: z.literal('2.0'),
});

export type User = z.infer<typeof User>;

// ==================== User Presence ====================

export const UserPresence = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  avatar: z.string().url().optional(),
  
  // Status
  status: z.enum(['online', 'hunting', 'idle', 'offline']),
  statusMessage: z.string().max(128).optional(),
  
  // Current activity
  currentSessionId: z.string().uuid().optional(),
  currentLoadoutId: z.string().uuid().optional(),
  
  // Last known location (if sharing enabled)
  lastLocation: z.object({
    lon: z.number(),
    lat: z.number(),
    timestamp: z.number(),
    area: z.string().optional(), // "Cape Corinth", "Twin Peaks", etc.
  }).optional(),
  
  // Timestamps
  lastSeen: z.number(),
  lastActive: z.number(),
});

export type UserPresence = z.infer<typeof UserPresence>;

// ==================== Friend Request ====================

export const FriendRequest = z.object({
  id: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  status: z.enum(['pending', 'accepted', 'rejected']),
  message: z.string().max(256).optional(),
  createdAt: z.number(),
  respondedAt: z.number().optional(),
});

export type FriendRequest = z.infer<typeof FriendRequest>;

// ==================== Live GPS Update ====================

export const LiveGPSUpdate = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  avatar: z.string().url().optional(),
  
  location: z.object({
    lon: z.number(),
    lat: z.number(),
  }),
  
  // Context
  status: z.enum(['hunting', 'traveling', 'idle']),
  sessionId: z.string().uuid().optional(),
  loadoutName: z.string().optional(),
  
  // Stats (optional, for sharing context)
  currentProfit: z.number().optional(),
  killCount: z.number().nonnegative().optional(),
  lastKill: z.string().optional(), // Last mob killed
  
  // Metadata
  timestamp: z.number(),
  ttl: z.number().default(300000), // 5 minutes expiry
});

export type LiveGPSUpdate = z.infer<typeof LiveGPSUpdate>;
