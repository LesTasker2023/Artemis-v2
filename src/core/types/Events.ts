/**
 * Core Event Types
 * All session data is stored as immutable events
 * State is derived by reducing over events
 */

import { z } from 'zod';

// Base event schema - all events extend this
const BaseEvent = z.object({
  id: z.string().uuid(),
  timestamp: z.number(),
  sessionId: z.string().uuid(),
  userId: z.string(),
});

export type BaseEvent = z.infer<typeof BaseEvent>;

// ==================== Combat Events ====================

export const ShotFiredEvent = BaseEvent.extend({
  type: z.literal('SHOT_FIRED'),
  payload: z.object({
    weaponId: z.string(),
    ammoUsed: z.number().positive(),
    ammoCost: z.number().nonnegative(),
  }),
});

export const HitRegisteredEvent = BaseEvent.extend({
  type: z.literal('HIT_REGISTERED'),
  payload: z.object({
    damage: z.number().positive(),
    mobId: z.string().optional(),
    mobName: z.string().optional(),
    critical: z.boolean(),
    damageResisted: z.number().nonnegative().optional(), // "Target resisted some additional damage"
  }),
});

export const MissRegisteredEvent = BaseEvent.extend({
  type: z.literal('MISS_REGISTERED'),
  payload: z.object({
    weaponId: z.string(),
  }),
});

export const DodgeRegisteredEvent = BaseEvent.extend({
  type: z.literal('DODGE_REGISTERED'),
  payload: z.object({
    actor: z.enum(['player', 'target']), // Who dodged: player or target (mob)
    mobId: z.string().optional(),
  }),
});

export const EvadeRegisteredEvent = BaseEvent.extend({
  type: z.literal('EVADE_REGISTERED'),
  payload: z.object({
    actor: z.enum(['player', 'target']), // Who evaded: player or target (mob)
    mobId: z.string().optional(),
  }),
});

// ==================== Mob Events ====================

export const MobKilledEvent = BaseEvent.extend({
  type: z.literal('MOB_KILLED'),
  payload: z.object({
    mobName: z.string(),
    mobId: z.string(),
    mobMaturity: z.string().optional(),
    location: z.object({
      lon: z.number(),
      lat: z.number(),
    }),
  }),
});

export const PlayerDeathEvent = BaseEvent.extend({
  type: z.literal('PLAYER_DEATH'),
  payload: z.object({
    mobName: z.string().optional(),
    location: z.object({
      lon: z.number(),
      lat: z.number(),
    }),
    decayCost: z.number().nonnegative().optional(),
  }),
});

// ==================== Loot Events ====================

export const LootReceivedEvent = BaseEvent.extend({
  type: z.literal('LOOT_RECEIVED'),
  payload: z.object({
    items: z.array(
      z.object({
        name: z.string(),
        quantity: z.number().positive(),
        ttValue: z.number().nonnegative(),
        mvValue: z.number().nonnegative().optional(),
      })
    ),
    totalTTValue: z.number().nonnegative(),
    totalMVValue: z.number().nonnegative().optional(),
    isGlobal: z.boolean().default(false),
    mobId: z.string().optional(),
  }),
});

// ==================== GPS Events ====================

export const GPSUpdateEvent = BaseEvent.extend({
  type: z.literal('GPS_UPDATE'),
  payload: z.object({
    location: z.object({
      lon: z.number(),
      lat: z.number(),
    }),
    altitude: z.number().optional(),
  }),
});

// ==================== Session Events ====================

export const SessionStartedEvent = BaseEvent.extend({
  type: z.literal('SESSION_STARTED'),
  payload: z.object({
    name: z.string(),
    loadoutId: z.string().uuid().optional(),
  }),
});

export const SessionEndedEvent = BaseEvent.extend({
  type: z.literal('SESSION_ENDED'),
  payload: z.object({
    reason: z.enum(['manual', 'auto', 'crash']).default('manual'),
  }),
});

export const LoadoutChangedEvent = BaseEvent.extend({
  type: z.literal('LOADOUT_CHANGED'),
  payload: z.object({
    previousLoadoutId: z.string().uuid().optional(),
    newLoadoutId: z.string().uuid(),
  }),
});

// ==================== Skill & Attribute Events ====================

export const SkillRankGainEvent = BaseEvent.extend({
  type: z.literal('SKILL_RANK_GAIN'),
  payload: z.object({
    skillName: z.string(),
    newRank: z.number().positive().optional(), // Rank level if known
  }),
});

export const SkillGainEvent = BaseEvent.extend({
  type: z.literal('SKILL_GAIN'),
  payload: z.object({
    skillName: z.string(),
    gainAmount: z.number().positive(),
    currentLevel: z.number().nonnegative().optional(),
  }),
});

export const AttributeGainEvent = BaseEvent.extend({
  type: z.literal('ATTRIBUTE_GAIN'),
  payload: z.object({
    attributeName: z.string(),
    gainAmount: z.number().positive(),
    currentValue: z.number().nonnegative().optional(),
  }),
});

export const NewSkillAcquiredEvent = BaseEvent.extend({
  type: z.literal('NEW_SKILL_ACQUIRED'),
  payload: z.object({
    skillName: z.string(),
  }),
});

// ==================== Damage Taken Events ====================

export const HitTakenEvent = BaseEvent.extend({
  type: z.literal('HIT_TAKEN'),
  payload: z.object({
    damage: z.number().positive(),
    mobName: z.string().optional(),
    mobId: z.string().optional(),
    armorCost: z.number().nonnegative().optional(),
    inVehicle: z.boolean().default(false),
  }),
});

export const CriticalHitTakenEvent = BaseEvent.extend({
  type: z.literal('CRITICAL_HIT_TAKEN'),
  payload: z.object({
    damage: z.number().positive(),
    damageType: z.enum(['additional', 'penetration']).default('additional'),
    mobName: z.string().optional(),
    mobId: z.string().optional(),
    inVehicle: z.boolean().default(false),
  }),
});

export const DamageDeflectedEvent = BaseEvent.extend({
  type: z.literal('DAMAGE_DEFLECTED'),
  payload: z.object({
    mobName: z.string().optional(),
    mobId: z.string().optional(),
  }),
});

// ==================== Mob Damage Events ====================

export const MobDamagedEvent = BaseEvent.extend({
  type: z.literal('MOB_DAMAGED'),
  payload: z.object({
    mobId: z.string(),
    mobName: z.string(),
    damage: z.number().positive(),
    critical: z.boolean().default(false),
  }),
});

// ==================== Global Events ====================

export const GlobalEventObserved = BaseEvent.extend({
  type: z.literal('GLOBAL_EVENT_OBSERVED'),
  payload: z.object({
    playerName: z.string(),
    itemName: z.string(),
    value: z.number().nonnegative(),
    rawLog: z.string(),
  }),
});

// ==================== Effect Events ====================

export const EffectReceivedEvent = BaseEvent.extend({
  type: z.literal('EFFECT_RECEIVED'),
  payload: z.object({
    effectName: z.string(),
    effectType: z.enum([
      'buff',
      'debuff',
      'heal',
      'damage',
      'stat_increase',
      'stat_decrease',
      'other'
    ]).default('other'),
    duration: z.number().nonnegative().optional(),
  }),
});

export const EquipEffectEvent = BaseEvent.extend({
  type: z.literal('EQUIP_EFFECT'),
  payload: z.object({
    effectName: z.string(),
    itemId: z.string().optional(),
    isSetEffect: z.boolean().default(false),
    setEffectCount: z.number().nonnegative().optional(),
  }),
});

export const HealingReceivedEvent = BaseEvent.extend({
  type: z.literal('HEALING_RECEIVED'),
  payload: z.object({
    amount: z.number().positive(),
    isDiminished: z.boolean().default(false),
    decreasePercent: z.number().min(0).max(100).optional(),
  }),
});

// ==================== Union Type ====================

export const SessionEvent = z.discriminatedUnion('type', [
  ShotFiredEvent,
  HitRegisteredEvent,
  MissRegisteredEvent,
  DodgeRegisteredEvent,
  EvadeRegisteredEvent,
  MobKilledEvent,
  PlayerDeathEvent,
  LootReceivedEvent,
  GPSUpdateEvent,
  SessionStartedEvent,
  SessionEndedEvent,
  LoadoutChangedEvent,
  SkillRankGainEvent,
  SkillGainEvent,
  AttributeGainEvent,
  NewSkillAcquiredEvent,
  HitTakenEvent,
  CriticalHitTakenEvent,
  DamageDeflectedEvent,
  MobDamagedEvent,
  GlobalEventObserved,
  EffectReceivedEvent,
  EquipEffectEvent,
  HealingReceivedEvent,
]);

export type SessionEvent = z.infer<typeof SessionEvent>;

// Type guards for events
export const isCombatEvent = (event: SessionEvent): boolean => {
  return [
    'SHOT_FIRED',
    'HIT_REGISTERED',
    'MISS_REGISTERED',
    'DODGE_REGISTERED',
    'EVADE_REGISTERED',
  ].includes(event.type);
};

export const isLootEvent = (event: SessionEvent): boolean => {
  return event.type === 'LOOT_RECEIVED';
};

export const isGPSEvent = (event: SessionEvent): boolean => {
  return event.type === 'GPS_UPDATE';
};

export const isMobEvent = (event: SessionEvent): boolean => {
  return ['MOB_KILLED', 'PLAYER_DEATH'].includes(event.type);
};
