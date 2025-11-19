# ARTEMIS Live GPS Sharing - Implementation Guide

**Status:** Architecture Complete, Implementation In Progress  
**Feature:** Real-time multiplayer GPS location sharing

---

## Overview

ARTEMIS Live GPS allows hunters to share their real-time locations with friends and society members. See where your teammates are hunting, track proximity, and coordinate gameplay in real-time.

### Features

- **Real-time location updates** (configurable interval, default 30 seconds)
- **Live map overlay** showing online users
- **Status indicators** (hunting, traveling, idle)
- **Privacy controls** (public, friends-only, off)
- **Session context** (current profit, kills, loadout)
- **Proximity alerts** (notify when friends nearby)
- **Stale indicator** (dim markers older than 60 seconds)

---

## Architecture

### Communication Options

We've designed **three** communication backends (use any one):

#### Option 1: Discord Webhooks (Simplest - Recommended for v1)

**Pros:**

- ✅ No server infrastructure needed
- ✅ Users already have Discord
- ✅ Simple webhook API
- ✅ Free tier sufficient for small groups

**Cons:**

- ⚠️ Rate limited (30 requests/minute per webhook)
- ⚠️ One-way communication (broadcast only)
- ⚠️ Requires polling or Discord bot for receiving updates

**How it works:**

1. User enables GPS sharing
2. Every 30s, ARTEMIS sends GPS update to Discord webhook
3. Message includes embed (human-readable) + parseable content
4. Other clients **would** poll Discord channel or use bot to receive updates
5. Updates displayed on live map overlay

**Setup:**

```bash
# 1. Create Discord server for your society/friends
# 2. Create webhook in a GPS channel
# 3. Copy webhook URL
# 4. Paste in ARTEMIS settings
```

**Rate Limiting Strategy:**

- Update interval: 30 seconds (120 updates/hour)
- 30 requests/minute = safe for 30 users broadcasting every 30s
- For larger groups (>30 users), increase interval to 60s

#### Option 2: WebSocket Relay Server (Best for Large Groups)

**Pros:**

- ✅ Bi-directional real-time updates
- ✅ No rate limits
- ✅ Low latency (<100ms)
- ✅ Scalable to hundreds of users

**Cons:**

- ❌ Requires hosting (DigitalOcean, AWS, etc.)
- ❌ More complex setup
- ❌ Monthly cost ($5-10/month)

**How it works:**

1. Deploy Node.js WebSocket server (provided in this repo - future)
2. Users connect to `wss://your-server.com`
3. Server broadcasts GPS updates to all connected clients
4. Updates displayed instantly on live map

**Deployment:**

```bash
# We'll provide a docker-compose.yml for easy deployment
docker-compose up -d

# Or deploy to Heroku/Railway/Fly.io (free tiers available)
```

#### Option 3: Discord Rich Presence (Future Enhancement)

**Pros:**

- ✅ Native Discord integration
- ✅ Presence updates automatic
- ✅ No webhooks needed

**Cons:**

- ❌ Requires Discord desktop app
- ❌ Electron-specific implementation
- ❌ Limited data payload

---

## Implementation Status

### ✅ Completed

**Core Types:**

- `User.ts` - User profiles, settings, authentication
- `UserPresence.ts` - Online status, last location
- `LiveGPSUpdate.ts` - Real-time GPS broadcast format
- `FriendRequest.ts` - Social features

**Services:**

- `LiveGPSService.ts` - Core GPS broadcasting logic
  - `broadcastLocation()` - Send updates
  - `receiveUpdate()` - Process incoming updates
  - `getActiveUpdates()` - Fetch all live users
  - `getNearbyUsers()` - Find hunters within radius
  - TTL-based expiration (5 minute default)

**Infrastructure:**

- `DiscordIntegration.ts` - Discord webhook sender
  - `sendToDiscord()` - Formatted embeds
  - `parseDiscordMessage()` - Extract GPS from content
- `GPSRelayServer.ts` - WebSocket client (for Option 2)
  - Auto-reconnect logic
  - Message parsing
  - Broadcast/receive

**UI Components:**

- `LiveGPSOverlay.tsx` - Map overlay showing live users
  - User markers with status colors
  - Hover tooltips with context
  - Stale indicator (>60s old)
  - Pulse animation for active hunters
- `LiveGPSControls.tsx` - Control panel UI
  - Enable/disable toggle
  - Online user counter
  - Nearby user counter

### ⏳ Pending Implementation

**Integration:**

- [ ] Wire up LiveGPSService to ActiveSession page
- [ ] Add GPS sharing toggle to Settings
- [ ] Integrate LiveGPSOverlay into InteractiveMapView
- [ ] Add Discord webhook configuration UI
- [ ] Store user preferences (shareGPS, visibility)

**User Management:**

- [ ] Create User profile page
- [ ] Discord OAuth login (optional)
- [ ] Friend list management UI
- [ ] Block list management
- [ ] Friend request system

**Advanced Features:**

- [ ] Proximity notifications ("Friend nearby!")
- [ ] Session coordination ("Join my hunt")
- [ ] Area claiming ("I'm hunting Twin Peaks")
- [ ] Loot notifications to friends
- [ ] Global tracking ("Show me all active hunts")

**Testing:**

- [ ] Unit tests for LiveGPSService
- [ ] Integration tests with mock Discord
- [ ] E2E test with 2+ clients

---

## Quick Start (For Testing)

### 1. Create Discord Webhook

```
1. Go to Discord Server Settings → Integrations → Webhooks
2. Create New Webhook
3. Name: "ARTEMIS GPS Tracker"
4. Channel: #gps-tracking (create this channel)
5. Copy Webhook URL
```

### 2. Configure in Code (Temporary - will add UI later)

```typescript
// In your ActiveSession.tsx or wherever you init services
import { LiveGPSService } from "@/core/services/LiveGPSService";
import { DiscordIntegrationService } from "@/infra/discord/DiscordIntegration";

const liveGPS = new LiveGPSService({
  discordWebhookUrl: "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL",
  updateInterval: 30000, // 30 seconds
  ttl: 300000, // 5 minutes
});

// Start broadcasting
liveGPS.startBroadcasting("user-123", "YourUsername");

// When GPS updates (every time log watcher detects GPS)
const update: LiveGPSUpdate = {
  userId: "user-123",
  username: "YourUsername",
  location: { lon: 12345, lat: 67890 },
  status: "hunting",
  sessionId: currentSessionId,
  loadoutName: currentLoadout?.name,
  currentProfit: sessionProfit,
  killCount: sessionKills,
  timestamp: Date.now(),
  ttl: 300000,
};

await liveGPS.broadcastLocation(update);
```

### 3. Add to InteractiveMapView

```tsx
import {
  LiveGPSOverlay,
  LiveGPSControls,
} from "@/ui/components/map/LiveGPSOverlay";

// Inside InteractiveMapView component
const [liveUpdates, setLiveUpdates] = createSignal<LiveGPSUpdate[]>([]);
const [gpsEnabled, setGpsEnabled] = createSignal(false);

// Poll for updates every 5 seconds
createEffect(() => {
  if (!gpsEnabled()) return;

  const interval = setInterval(() => {
    const updates = liveGPS.getActiveUpdates();
    setLiveUpdates(updates);
  }, 5000);

  onCleanup(() => clearInterval(interval));
});

// In render
return (
  <div>
    {/* Existing map */}
    <canvas ref={canvasRef} />

    {/* NEW: Live GPS overlay */}
    <LiveGPSOverlay
      updates={liveUpdates()}
      currentUserId="user-123"
      visible={gpsEnabled()}
      onUserClick={(userId) => console.log("Clicked user:", userId)}
    />

    {/* NEW: Controls */}
    <div class="absolute bottom-4 right-4">
      <LiveGPSControls
        enabled={gpsEnabled()}
        onToggle={setGpsEnabled}
        onlineUsers={liveUpdates().length}
        nearbyUsers={liveGPS.getNearbyUsers(currentLocation, 500).length}
      />
    </div>
  </div>
);
```

---

## Data Flow

```
[ARTEMIS Client A]
    |
    | 1. GPS Update Event
    | (LogWatcher detects GPS coords)
    v
[LiveGPSService]
    |
    | 2. broadcastLocation()
    | (Rate limited: max 1/30s)
    v
[Discord Webhook] OR [WebSocket Server]
    |
    | 3. Message broadcast
    | Content: "GPS:userId:lon:lat:timestamp"
    | Embed: Human-readable with stats
    v
[Discord Channel] OR [WebSocket Clients]
    |
    | 4. Other clients receive
    | (Polling or push notification)
    v
[ARTEMIS Client B, C, D...]
    |
    | 5. receiveUpdate()
    | Parse & validate
    v
[LiveGPSOverlay]
    |
    | 6. Render marker on map
    | Update every 5 seconds
    v
[User sees live locations]
```

---

## Privacy & Security

### User Controls

**Visibility Modes:**

- `off` - GPS not shared (default)
- `friends` - Only friends see your location
- `public` - All ARTEMIS users see your location

**Granular Settings:**

- Share GPS on/off toggle
- Share session stats (profit/kills) on/off
- Share loadout name on/off
- Show online status on/off

### Data Expiry

- GPS updates have 5-minute TTL
- Expired updates automatically removed from cache
- No persistent storage of other users' locations
- Only your own GPS history stored in session events

### Rate Limiting

- Maximum 1 broadcast per 30 seconds (configurable)
- Prevents spam and Discord rate limit issues
- Client-side throttling

---

## Discord Message Format

### Embed (Human-Readable)

```json
{
  "title": "📍 YourUsername - Location Update",
  "color": 3910902,
  "fields": [
    {
      "name": "Coordinates",
      "value": "Lon: 12345, Lat: 67890",
      "inline": true
    },
    { "name": "Status", "value": "Hunting", "inline": true },
    { "name": "Loadout", "value": "Twin Peaks Armax", "inline": true },
    { "name": "Profit", "value": "+23.45 PED", "inline": true },
    { "name": "Kills", "value": "12", "inline": true }
  ],
  "timestamp": "2024-11-18T15:30:00.000Z",
  "footer": { "text": "ARTEMIS Live GPS" }
}
```

### Content (Machine-Parseable)

```
GPS:user-123:12345:67890:1700319000000
```

Format: `GPS:userId:longitude:latitude:timestamp`

This allows other clients to extract location data without parsing the embed.

---

## WebSocket Server (Future)

We'll provide a simple Node.js WebSocket server:

```typescript
// server/index.ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const clients = new Map<string, WebSocket>();

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const message = JSON.parse(data);

    if (message.type === "gps_update") {
      // Broadcast to all connected clients
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  });
});
```

Deploy with Docker:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server/ ./
EXPOSE 8080
CMD ["node", "index.js"]
```

---

## Roadmap

### Phase 1: MVP (Current Sprint) ✅

- [x] Core types and services
- [x] Discord webhook integration
- [x] Live GPS overlay UI
- [x] Basic controls
- [ ] Integration into ActiveSession
- [ ] Settings UI for webhook config

### Phase 2: User Profiles

- [ ] User authentication (Discord OAuth)
- [ ] Profile page with stats
- [ ] Friend list management
- [ ] Privacy settings UI

### Phase 3: Social Features

- [ ] Friend requests
- [ ] Block list
- [ ] Proximity notifications
- [ ] Session invitations
- [ ] Area reservations

### Phase 4: Advanced

- [ ] WebSocket relay server
- [ ] Mobile app (React Native)
- [ ] Society integration
- [ ] Leaderboards
- [ ] Event coordination ("Society hunt @ Twin Peaks 20:00 UTC")

---

## Testing Checklist

**Manual Testing:**

- [ ] Create Discord webhook, paste URL in config
- [ ] Start active session with GPS sharing enabled
- [ ] Move in-game, verify Discord messages appear every 30s
- [ ] Open second ARTEMIS instance (different user)
- [ ] Verify first user's marker appears on second user's map
- [ ] Hover over marker, verify tooltip shows correct data
- [ ] Wait 60+ seconds without update, verify marker dims
- [ ] Toggle GPS sharing off, verify broadcasts stop

**Multi-User Testing:**

- [ ] 2 users in same area (< 500m radius)
- [ ] Verify "Nearby" counter updates
- [ ] 10+ users broadcasting simultaneously
- [ ] Verify no rate limit errors from Discord
- [ ] Test with users in different continents
- [ ] Verify location accuracy on map

---

## Configuration Reference

```typescript
interface LiveGPSConfig {
  // Discord webhook URL
  discordWebhookUrl: string;

  // How often to broadcast (milliseconds)
  // 30000 = 30 seconds (recommended)
  updateInterval: number;

  // How long updates stay valid (milliseconds)
  // 300000 = 5 minutes (recommended)
  ttl: number;
}

interface UserSettings {
  // Enable GPS broadcasting
  shareGPS: boolean; // default: false

  // Who can see your location
  gpsVisibility: "public" | "friends" | "off"; // default: 'off'

  // Share session stats with GPS
  shareSessionStats: boolean; // default: true

  // Show online status
  showOnlineStatus: boolean; // default: true
}
```

---

## FAQ

**Q: Does this work without Discord?**  
A: Not yet. Future versions will support a standalone WebSocket server. For now, Discord webhooks are required.

**Q: Can I see players from other societies?**  
A: Yes, if they use the same Discord channel and have `gpsVisibility: 'public'`. For friends-only, implement friend system.

**Q: How much Discord API rate limit do I have?**  
A: 30 requests per minute per webhook. With 30-second intervals, you can support 60 simultaneous users. For more, create multiple webhooks.

**Q: Is my location stored permanently?**  
A: No. Only GPS events in your own sessions are stored. Other users' locations are cached in memory with 5-minute expiry.

**Q: What happens if my internet disconnects?**  
A: GPS updates will fail silently. When reconnected, updates resume. Your marker will appear stale to others after 60 seconds.

**Q: Can I use this for PvP tracking?**  
A: **Please use ethically.** This is designed for society coordination, not griefing. Implement friend lists and privacy controls.

---

## Next Steps

1. **Add Settings UI** - Let users paste Discord webhook URL without editing code
2. **Integrate with ActiveSession** - Auto-broadcast when session active
3. **Test with real users** - Get 2-3 friends to test simultaneously
4. **Build friend system** - Filter updates to friends-only
5. **Deploy WebSocket server** - For users without Discord

---

**Questions?** Open an issue on GitHub or ask in Discord!

**Want to contribute?** PRs welcome for:

- Friend system UI
- WebSocket relay server
- Mobile app (React Native)
- Global map view (all hunts)
