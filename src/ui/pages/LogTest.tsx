/**
 * LogTest Page
 * Test the chat.log parser with sample log lines
 */

import { createSignal, For, onCleanup } from "solid-js";
import { LogParser } from "../../core/services/LogParser";
import type { SessionEvent } from "../../core/types/Events";

export default function LogTest() {
  const [logLines, setLogLines] = createSignal<string>("");
  const [parsedEvents, setParsedEvents] = createSignal<SessionEvent[]>([]);
  const [sessionId] = createSignal(crypto.randomUUID());
  const [userId] = createSignal("test-user");
  const [isWatching, setIsWatching] = createSignal(false);
  const [logPath, setLogPath] = createSignal("");
  const [liveEventCount, setLiveEventCount] = createSignal(0);
  const [watchError, setWatchError] = createSignal<string>("");

  // Sample log lines from real EU data
  const sampleLogs = `2025-11-17 20:30:32 [System] [] You inflicted 83.6 points of damage
2025-11-17 20:30:34 [System] [] You inflicted 79.0 points of damage
2025-11-17 20:30:35 [System] [] Critical hit - Additional damage! You inflicted 190.0 points of damage
2025-11-17 20:30:36 [System] [] The target Dodged your attack
2025-11-17 20:30:37 [System] [] You received Shrapnel x (14065) Value: 1.40 PED
2025-11-17 20:30:38 [System] [] You received Animal Pancreas Oil x (5) Value: 2.50 PED
2025-11-17 20:30:39 [System] [] You have gained a new rank in Dexterity!
2025-11-17 20:30:40 [System] [] You Evaded the attack
2025-11-17 20:30:41 [System] [] Damage deflected!
2025-11-17 20:30:42 [System] [] You took 30.0 points of damage
2025-11-17 20:30:43 [System] [] Received Effect Over Time: Heal
2025-11-17 20:30:44 [System] [] Equip Effect: Increased Critical Chance
2025-11-17 20:30:45 [Globals] [] Nicholas Looser EnterGate killed a creature (Daspletor Young) with a value of 62 PED!`;

  const handleParse = () => {
    const lines = logLines()
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const results = LogParser.parseLines(lines, sessionId(), userId());
    const events = LogParser.extractEvents(results);
    setParsedEvents(events);
  };

  const loadSample = () => {
    setLogLines(sampleLogs);
  };

  const clearAll = () => {
    setLogLines("");
    setParsedEvents([]);
    setLiveEventCount(0);
  };

  // Live log watching
  const startWatching = async () => {
    if (!window.electron?.logWatcher) {
      setWatchError("Log watcher API not available");
      return;
    }

    const path = logPath().trim();
    if (!path) {
      setWatchError("Please enter chat.log path");
      return;
    }

    try {
      setWatchError("");

      // Set up event listeners
      window.electron.logWatcher.onEvent((event: SessionEvent) => {
        setParsedEvents((prev) => [...prev, event]);
        setLiveEventCount((c) => c + 1);
      });

      window.electron.logWatcher.onEvents((events: SessionEvent[]) => {
        setParsedEvents((prev) => [...prev, ...events]);
        setLiveEventCount((c) => c + events.length);
      });

      window.electron.logWatcher.onError((error: string) => {
        setWatchError(error);
        setIsWatching(false);
      });

      // Start watching
      await window.electron.logWatcher.start({
        logPath: path,
        sessionId: sessionId(),
        userId: userId(),
      });

      setIsWatching(true);
    } catch (error) {
      setWatchError(error instanceof Error ? error.message : String(error));
      setIsWatching(false);
    }
  };

  const stopWatching = async () => {
    if (!window.electron?.logWatcher) return;

    try {
      await window.electron.logWatcher.stop();
      setIsWatching(false);
    } catch (error) {
      setWatchError(error instanceof Error ? error.message : String(error));
    }
  };

  // Clean up on unmount
  onCleanup(() => {
    if (isWatching()) {
      stopWatching();
    }
  });

  const getEventColor = (type: string) => {
    switch (type) {
      case "HIT_REGISTERED":
        return "text-green-400";
      case "MISS_REGISTERED":
        return "text-red-400";
      case "LOOT_RECEIVED":
        return "text-yellow-400";
      case "SKILL_RANK_GAIN":
        return "text-blue-400";
      case "EFFECT_RECEIVED":
        return "text-purple-400";
      case "DODGE_REGISTERED":
      case "EVADE_REGISTERED":
        return "text-cyan-400";
      case "HIT_TAKEN":
        return "text-orange-400";
      case "GLOBAL_EVENT_OBSERVED":
        return "text-pink-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div class="min-h-screen bg-gray-900 text-white p-6">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold text-white">Chat.log Parser Test</h1>
          <a
            href="/"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>

        {/* Live Log Monitoring Section */}
        <div class="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-white mb-4">
            Live Chat.log Monitor
          </h2>

          <div class="flex gap-2 mb-4">
            <input
              type="text"
              value={logPath()}
              onInput={(e) => setLogPath(e.currentTarget.value)}
              placeholder="C:\Program Files (x86)\Steam\steamapps\common\Entropia Universe\chat.log"
              class="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none placeholder:text-gray-500"
            />
            {isWatching() ? (
              <button
                onClick={stopWatching}
                class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={startWatching}
                class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold"
              >
                Start Watching
              </button>
            )}
          </div>

          {isWatching() && (
            <div class="bg-green-900/20 border border-green-500 rounded-lg p-3 text-green-400 text-sm">
              ✓ Watching for new events... ({liveEventCount()} events captured)
            </div>
          )}

          {watchError() && (
            <div class="bg-red-900/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              Error: {watchError()}
            </div>
          )}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-white mb-4">
              Manual Test Input
            </h2>

            <div class="flex gap-2 mb-4">
              <button
                onClick={loadSample}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Load Sample
              </button>
              <button
                onClick={handleParse}
                class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Parse
              </button>
              <button
                onClick={clearAll}
                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>

            <textarea
              value={logLines()}
              onInput={(e) => setLogLines(e.currentTarget.value)}
              placeholder="Paste chat.log lines here..."
              class="w-full h-96 bg-gray-900 text-white p-4 rounded-lg font-mono text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
            />

            <div class="mt-4 text-sm text-gray-400">
              Lines:{" "}
              {
                logLines()
                  .split("\n")
                  .filter((l) => l.trim()).length
              }
            </div>
          </div>

          {/* Output Section */}
          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-white mb-4">Parsed Events</h2>

            <div class="text-sm text-gray-400 mb-4">
              Parsed: {parsedEvents().length} events
            </div>

            <div class="bg-gray-900 rounded-lg p-4 h-[500px] overflow-y-auto">
              <For each={parsedEvents()}>
                {(event, index) => (
                  <div class="mb-4 pb-4 border-b border-gray-700 last:border-0">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-gray-500 text-xs">#{index() + 1}</span>
                      <span
                        class={`font-semibold ${getEventColor(event.type)}`}
                      >
                        {event.type}
                      </span>
                      <span class="text-gray-500 text-xs ml-auto">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <pre class="text-xs text-gray-300 bg-gray-950 p-2 rounded overflow-x-auto">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </For>

              {parsedEvents().length === 0 && (
                <div class="text-center text-gray-500 mt-8">
                  No events parsed yet. Load sample and click Parse!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Type Legend */}
        <div class="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-white mb-4">
            Event Types Legend
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300">
            <div>
              <span class="text-green-400">●</span> HIT_REGISTERED - Damage
              dealt
            </div>
            <div>
              <span class="text-red-400">●</span> MISS_REGISTERED - Target
              dodged
            </div>
            <div>
              <span class="text-yellow-400">●</span> LOOT_RECEIVED - Items
              looted
            </div>
            <div>
              <span class="text-blue-400">●</span> SKILL_RANK_GAIN - Skill level
              up
            </div>
            <div>
              <span class="text-purple-400">●</span> EFFECT_RECEIVED -
              Buff/debuff
            </div>
            <div>
              <span class="text-cyan-400">●</span> DODGE/EVADE - Avoided attack
            </div>
            <div>
              <span class="text-orange-400">●</span> HIT_TAKEN - Damage received
            </div>
            <div>
              <span class="text-pink-400">●</span> GLOBAL_EVENT - Other player's
              global
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
