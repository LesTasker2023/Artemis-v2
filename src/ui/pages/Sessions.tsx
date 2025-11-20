import { createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Download, Plus } from "lucide-solid";
import type { Session } from "../../core/types/Session";
import { Button } from "../components/atoms/Button";
import { SessionList } from "./SessionList";

export function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [importing, setImporting] = createSignal(false);

  // Load sessions from database on mount
  onMount(async () => {
    if (window.electron?.session) {
      try {
        const loadedSessions = await window.electron.session.findAll();
        setSessions(loadedSessions);
        console.log("[Sessions] Loaded sessions:", loadedSessions.length);
      } catch (error) {
        console.error("[Sessions] Failed to load sessions:", error);
      }
    }
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await window.electron?.session.importLegacySessions();
      if (result) {
        console.log(`[Sessions] Imported ${result.imported} sessions`);
        // Reload sessions after import
        const loadedSessions = await window.electron.session.findAll();
        setSessions(loadedSessions);
      }
    } catch (error) {
      console.error("[Sessions] Failed to import:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await window.electron?.session.delete(sessionId);
      // Reload sessions after delete
      const loadedSessions = await window.electron.session.findAll();
      setSessions(loadedSessions);
      console.log(`[Sessions] Deleted session ${sessionId}`);
    } catch (error) {
      console.error("[Sessions] Failed to delete session:", error);
    }
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-primary">Sessions</h1>
          <p class="text-muted-foreground mt-1">
            View and manage all your hunting sessions
          </p>
        </div>

        <div class="flex gap-3">
          <Button
            variant="outline"
            onClick={handleImport}
            disabled={importing()}
            class="flex items-center gap-2"
          >
            <Download size={18} />
            {importing() ? "Importing..." : "Import Legacy"}
          </Button>

          <Button
            onClick={() => navigate("/active")}
            class="flex items-center gap-2"
          >
            <Plus size={18} />
            New Session
          </Button>
        </div>
      </div>

      {/* Session List */}
      <SessionList
        sessions={sessions()}
        onViewSession={(id) => navigate(`/session/${id}`)}
        onDeleteSession={handleDeleteSession}
      />
    </div>
  );
}
