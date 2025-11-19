/**
 * LogWatcher Service
 * Watches Entropia Universe chat.log for changes and emits events
 * Node.js implementation for Electron main process
 * 
 * Features:
 * - Auto-detects chat.log location
 * - Debounced batch event processing (1-2 second batches)
 * - Handles log rotation (game restart)
 * - Graceful error recovery
 */

import { watch, readFileSync, statSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { LogParser, ParseResult } from '../../core/services/LogParser';
import { homedir } from 'os';
import { join } from 'path';

export interface LogWatcherConfig {
  logPath?: string; // Optional - will auto-detect if not provided
  sessionId: string;
  userId: string;
  pollInterval?: number; // ms between checks (default 1000)
  batchDebounce?: number; // ms to wait before emitting batch (default 1500)
}

export class LogWatcher extends EventEmitter {
  private config: LogWatcherConfig;
  private cleanPath: string;
  private lastPosition: number = 0;
  private watcher: ReturnType<typeof watch> | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private batchTimeout: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private pendingLines: string[] = [];
  
  /**
   * Auto-detect Entropia Universe chat.log location
   */
  static detectLogPath(): string | null {
    const userHome = homedir();
    const possiblePaths = [
      join(userHome, 'Documents', 'Entropia Universe', 'chat.log'),
      join(userHome, 'My Documents', 'Entropia Universe', 'chat.log'),
      join('C:', 'Users', userHome.split('\\').pop() || '', 'Documents', 'Entropia Universe', 'chat.log'),
    ];
    
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        console.log(`✅ Found chat.log at: ${path}`);
        return path;
      }
    }
    
    console.warn('⚠️ Could not auto-detect chat.log location');
    return null;
  }

  constructor(config: LogWatcherConfig) {
    super();
    
    // Auto-detect log path if not provided
    const logPath = config.logPath || LogWatcher.detectLogPath();
    if (!logPath) {
      throw new Error('Could not find chat.log. Please specify path manually.');
    }
    
    // Remove surrounding quotes if present
    this.cleanPath = logPath.replace(/^["']|["']$/g, '');
    this.config = {
      pollInterval: 1000,
      batchDebounce: 300, // 300ms for near-instant updates
      ...config,
      logPath: this.cleanPath,
    };
  }

  /**
   * Start watching the log file
   */
  start(): void {
    if (this.isActive) {
      console.warn('LogWatcher already active');
      return;
    }

    try {
      // Get current file size to start tailing from end
      const stats = statSync(this.cleanPath);
      this.lastPosition = stats.size;
      
      console.log(`📖 Starting log watch: ${this.cleanPath}`);
      console.log(`📍 Starting from position: ${this.lastPosition}`);

      // Use fs.watch for file changes
      this.watcher = watch(this.cleanPath, (eventType, filename) => {
        console.log(`🔔 fs.watch event: ${eventType}, filename: ${filename}`);
        if (eventType === 'change') {
          console.log('📡 File change detected');
          this.readNewLines();
        }
      });

      // Add error handler for watcher
      this.watcher.on('error', (error) => {
        console.error('❌ Watcher error:', error);
        this.emit('error', error);
      });

      // Also poll periodically in case fs.watch misses changes
      this.pollInterval = setInterval(() => {
        this.readNewLines();
      }, this.config.pollInterval);

      this.isActive = true;
      this.emit('started');
      
    } catch (error) {
      console.error('❌ Failed to start log watcher:', error);
      this.emit('error', error);
    }
  }

  /**
   * Stop watching the log file
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    console.log('🛑 Stopping log watch');

    // Flush any pending batched lines
    this.flushBatch();

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    this.isActive = false;
    this.pendingLines = [];
    this.emit('stopped');
  }

  /**
   * Read new lines from the log file
   * Lines are batched and debounced for efficient processing
   */
  private readNewLines(): void {
    try {
      const stats = statSync(this.cleanPath);
      const currentSize = stats.size;

      // File was truncated (game restart or log rotation)
      if (currentSize < this.lastPosition) {
        console.warn('⚠️ Log file truncated, resetting position');
        this.lastPosition = 0;
        this.flushBatch(); // Flush any pending before reset
        this.emit('truncated');
      }

      // No new data
      if (currentSize === this.lastPosition) {
        return;
      }

      console.log(`📊 File size changed: ${this.lastPosition} → ${currentSize}`);

      // Read new bytes
      const buffer = Buffer.alloc(currentSize - this.lastPosition);
      const fd = require('fs').openSync(this.cleanPath, 'r');
      require('fs').readSync(fd, buffer, 0, buffer.length, this.lastPosition);
      require('fs').closeSync(fd);

      // Update position
      this.lastPosition = currentSize;

      // Parse lines
      const newContent = buffer.toString('utf-8');
      const lines = newContent.split('\n').filter(l => l.trim().length > 0);

      if (lines.length === 0) {
        return;
      }

      console.log(`📝 Read ${lines.length} new lines (batching...)`);

      // Add to pending batch
      this.pendingLines.push(...lines);

      // Schedule batch emission (debounced)
      this.scheduleBatchEmit();

    } catch (error) {
      console.error('❌ Error reading log file:', error);
      this.emit('error', error);
    }
  }

  /**
   * Schedule batch emission with debouncing
   */
  private scheduleBatchEmit(): void {
    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Schedule new emission after debounce period
    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, this.config.batchDebounce || 1500);
  }

  /**
   * Flush pending batch of lines to events
   */
  private flushBatch(): void {
    if (this.pendingLines.length === 0) {
      return;
    }

    console.log(`🚀 Flushing batch of ${this.pendingLines.length} lines`);

    // Parse all pending lines
    const results = LogParser.parseLines(
      this.pendingLines,
      this.config.sessionId,
      this.config.userId
    );

    // Clear pending
    this.pendingLines = [];

    // Extract events
    const events = LogParser.extractEvents(results);
    
    if (events.length > 0) {
      console.log(`✨ Emitting ${events.length} events`);
      this.emit('events', events);
      
      // Also emit individual events for granular handling
      events.forEach(event => {
        this.emit('event', event);
      });
    }

    // Clear timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Get watcher status
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get current file position
   */
  getPosition(): number {
    return this.lastPosition;
  }
}
