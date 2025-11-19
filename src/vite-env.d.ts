/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DISCORD_WEBHOOK_URL?: string
  readonly DISCORD_BOT_TOKEN?: string
  readonly DISCORD_CHANNEL_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
