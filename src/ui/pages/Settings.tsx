/**
 * Settings Page
 * User preferences and configuration
 */

import { createSignal, onMount } from "solid-js";
import { Card } from "../components/atoms/Card";
import { Button } from "../components/atoms/Button";
import { Save, Radio, FolderOpen, Download } from "lucide-solid";

export default function Settings() {
  const [currentUser, setCurrentUser] = createSignal<any>(null);
  const [username, setUsername] = createSignal("");
  const [shareGPS, setShareGPS] = createSignal(false);
  const [visibility, setVisibility] = createSignal<
    "public" | "friends" | "off"
  >("off");
  const [chatLogPath, setChatLogPath] = createSignal("");
  const [saved, setSaved] = createSignal(false);
  const [appVersion, setAppVersion] = createSignal("");

  // Load user from database on mount
  onMount(async () => {
    if (window.electron?.user) {
      try {
        const user = await window.electron.user.getCurrent();
        setCurrentUser(user);
        setUsername(user.username);
        setShareGPS(user.shareGPS);
        setVisibility(user.gpsVisibility);
        setChatLogPath(user.chatLogPath || "");
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    }
    
    // Get app version
    if (window.electron?.getAppVersion) {
      try {
        const version = await window.electron.getAppVersion();
        setAppVersion(version);
      } catch (error) {
        console.error("Failed to get app version:", error);
      }
    }
    
    // Auto-detect chat.log path if not set
    if (!chatLogPath() && window.electron?.logWatcher) {
      try {
        const detectResult = await window.electron.logWatcher.detectPath();
        if (detectResult.success && detectResult.path) {
          setChatLogPath(detectResult.path);
        }
      } catch (error) {
        console.error("Failed to auto-detect chat.log:", error);
      }
    }
  });

  const handleCheckForUpdates = async () => {
    const repoUrl = "https://github.com/LesTasker2023/ARTEMIS/releases";
    if (window.electron?.openExternal) {
      try {
        await window.electron.openExternal(repoUrl);
      } catch (error) {
        console.error("Failed to open releases page:", error);
        // Fallback to window.open
        window.open(repoUrl, '_blank');
      }
    } else {
      // Fallback for web
      window.open(repoUrl, '_blank');
    }
  };

  const handleBrowseChatLog = async () => {
    if (!window.electron?.logWatcher) return;
    
    try {
      const result = await window.electron.logWatcher.browsePath();
      if (result.success && result.path) {
        setChatLogPath(result.path);
      }
    } catch (error) {
      console.error("Failed to browse for chat.log:", error);
      alert("Failed to open file browser. Check console for details.");
    }
  };

  const handleAutoDetect = async () => {
    if (!window.electron?.logWatcher) return;
    
    try {
      const result = await window.electron.logWatcher.detectPath();
      if (result.success && result.path) {
        setChatLogPath(result.path);
      } else {
        alert("Could not auto-detect chat.log location. Please browse manually.");
      }
    } catch (error) {
      console.error("Failed to auto-detect chat.log:", error);
      alert("Failed to auto-detect. Check console for details.");
    }
  };

  const handleSave = async () => {
    const user = currentUser();
    if (!user || !window.electron?.user) return;

    try {
      // Update user profile
      const updatedUser = {
        ...user,
        username: username(),
        shareGPS: shareGPS(),
        gpsVisibility: visibility(),
        chatLogPath: chatLogPath(),
        updatedAt: Date.now(),
      };

      await window.electron.user.update(updatedUser);
      setCurrentUser(updatedUser);

      // Show saved indicator
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings. Check console for details.");
    }
  };

  return (
    <div class="p-8">
      <div class="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 class="text-4xl font-bold text-white mb-2">Settings</h1>
          <p class="text-primary/60">Configure your ARTEMIS preferences</p>
        </div>

        {/* User Profile */}
        <Card>
          <div class="p-6">
            <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              User Profile
            </h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-primary/80 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  placeholder="Enter your username"
                  class="w-full px-4 py-2 bg-background-lighter border border-primary/20 rounded-lg text-white placeholder-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p class="text-xs text-primary/40 mt-1">
                  This name will be displayed to other users when sharing GPS
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-primary/80 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={currentUser()?.id || ""}
                  disabled
                  class="w-full px-4 py-2 bg-background-lighter/50 border border-primary/10 rounded-lg text-primary/40 font-mono text-sm"
                />
                <p class="text-xs text-primary/40 mt-1">
                  Auto-generated unique identifier
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Chat Log Settings */}
        <Card>
          <div class="p-6">
            <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <FolderOpen size={16} class="text-primary" />
              </div>
              Chat Log Path
            </h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-primary/80 mb-2">
                  Entropia Universe chat.log Location
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={chatLogPath()}
                    onInput={(e) => setChatLogPath(e.currentTarget.value)}
                    placeholder="C:\Users\YourName\Documents\Entropia Universe\chat.log"
                    class="flex-1 px-4 py-2 bg-background-lighter border border-primary/20 rounded-lg text-white placeholder-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  />
                  <Button onClick={handleBrowseChatLog} variant="secondary">
                    Browse
                  </Button>
                  <Button onClick={handleAutoDetect} variant="secondary">
                    Auto-Detect
                  </Button>
                </div>
                <p class="text-xs text-primary/40 mt-2">
                  ARTEMIS reads this file to track your hunting session automatically.
                  Common locations:
                </p>
                <ul class="text-xs text-primary/40 mt-1 ml-4 space-y-1">
                  <li>• Documents\Entropia Universe\chat.log</li>
                  <li>• C:\Program Files (x86)\Steam\steamapps\common\Entropia Universe\chat.log</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Live GPS Settings */}
        <Card>
          <div class="p-6">
            <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Radio size={16} class="text-primary" />
              </div>
              Live GPS Sharing
            </h2>

            <div class="space-y-6">
              {/* Enable GPS Sharing */}
              <div>
                <label class="flex items-center gap-3 p-3 bg-background-lighter rounded-lg cursor-pointer hover:bg-background-lighter/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={shareGPS()}
                    onChange={(e) => setShareGPS(e.currentTarget.checked)}
                    class="w-4 h-4 text-primary focus:ring-2 focus:ring-primary rounded"
                  />
                  <div class="flex-1">
                    <div class="text-white font-medium">Enable GPS Sharing</div>
                    <div class="text-xs text-primary/60">
                      Broadcast your location every 30 seconds during active
                      sessions
                    </div>
                  </div>
                </label>
              </div>

              {/* Visibility */}
              <div>
                <label class="block text-sm font-medium text-primary/80 mb-2">
                  GPS Visibility
                </label>
                <div class="space-y-2">
                  <label class="flex items-center gap-3 p-3 bg-background-lighter rounded-lg cursor-pointer hover:bg-background-lighter/70 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="off"
                      checked={visibility() === "off"}
                      onChange={(e) =>
                        setVisibility(
                          e.currentTarget.value as "public" | "friends" | "off"
                        )
                      }
                      class="w-4 h-4 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <div class="flex-1">
                      <div class="text-white font-medium">Private</div>
                      <div class="text-xs text-primary/60">
                        Only you can see your location
                      </div>
                    </div>
                  </label>

                  <label class="flex items-center gap-3 p-3 bg-background-lighter rounded-lg cursor-pointer hover:bg-background-lighter/70 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="friends"
                      checked={visibility() === "friends"}
                      onChange={(e) =>
                        setVisibility(
                          e.currentTarget.value as "public" | "friends" | "off"
                        )
                      }
                      class="w-4 h-4 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <div class="flex-1">
                      <div class="text-white font-medium">Friends Only</div>
                      <div class="text-xs text-primary/60">
                        Share with approved friends (coming soon)
                      </div>
                    </div>
                  </label>

                  <label class="flex items-center gap-3 p-3 bg-background-lighter rounded-lg cursor-pointer hover:bg-background-lighter/70 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility() === "public"}
                      onChange={(e) =>
                        setVisibility(
                          e.currentTarget.value as "public" | "friends" | "off"
                        )
                      }
                      class="w-4 h-4 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <div class="flex-1">
                      <div class="text-white font-medium">Public</div>
                      <div class="text-xs text-primary/60">
                        Share with all ARTEMIS users in channel
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* App Info & Updates */}
        <Card>
          <div class="p-6">
            <h2 class="text-xl font-semibold text-white mb-4">About</h2>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between p-4 bg-background-lighter rounded-lg">
                <div>
                  <div class="text-white font-medium">Version</div>
                  <div class="text-sm text-primary/60 font-mono">{appVersion() || 'Loading...'}</div>
                </div>
                <Button 
                  onClick={handleCheckForUpdates} 
                  variant="secondary"
                  icon={Download}
                  size="sm"
                >
                  Check for Updates
                </Button>
              </div>
              
              <p class="text-xs text-primary/60">
                ARTEMIS is an open-source hunting tracker for Entropia Universe.
                Visit GitHub for updates, bug reports, and feature requests.
              </p>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div class="flex items-center gap-4">
          <Button onClick={handleSave} icon={Save} size="lg">
            Save Settings
          </Button>

          {saved() && (
            <div class="text-green-500 flex items-center gap-2 animate-fade-in">
              <span class="text-xl">✓</span>
              <span>Settings saved!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
