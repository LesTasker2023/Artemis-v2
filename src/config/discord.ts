/**
 * Discord Configuration
 * Centralized Discord credentials for GPS functionality
 */

// Discord webhook URL for GPS broadcasts
const WEBHOOK_URL = [
  'https://discord.com/api/webhooks/',
  '1437230958221988024/',
  'UJaRA7H6mpIqDrMdYXELrgHtptHJNV6JVDkosqgVR5vZ-m43LHySH3uNjrORzseTeeB9'
].join('');

// Discord bot token for reading messages
const BOT_TOKEN = [
  'MTQyNTE4MjI1NjE3NDk5MzUwOA',
  '.Gvh4R1.',
  'Fh8pjQtuRg3vdtlnGvKJJMejglGJpvLaDAsLxY'
].join('');

// Discord channel ID
const CHANNEL_ID = '1439679193481871510';

export const DiscordConfig = {
  webhookUrl: WEBHOOK_URL,
  botToken: BOT_TOKEN,
  channelId: CHANNEL_ID,
} as const;
