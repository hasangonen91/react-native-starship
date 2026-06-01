'use strict';

const fs = require('fs');
const path = require('path');
const ui = require('./ui');

const HISTORY_FILE_NAME = 'build-history.json';

/**
 * Gets the history file path (relative to cwd).
 * @returns {string}
 */
function getHistoryPath() {
  return path.resolve('.starship-cache', HISTORY_FILE_NAME);
}
const MAX_HISTORY = 20;

/**
 * Creates a build timer instance.
 * @param {string} platform - 'android' or 'ios'
 * @returns {Object} Timer with start/stop/report methods
 */
function createBuildTimer(platform) {
  let startTime = null;
  let endTime = null;

  return {
    start() {
      startTime = Date.now();
      endTime = null;
    },

    stop() {
      endTime = Date.now();
      return this.duration();
    },

    duration() {
      if (!startTime) return 0;
      return (endTime || Date.now()) - startTime;
    },

    /**
     * Formats duration as human-readable string.
     * @returns {string}
     */
    formatted() {
      const ms = this.duration();
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      const mins = Math.floor(ms / 60000);
      const secs = ((ms % 60000) / 1000).toFixed(0);
      return `${mins}m ${secs}s`;
    },

    /**
     * Saves build time to history and displays comparison.
     */
    save() {
      const duration = this.duration();
      const entry = {
        platform,
        duration,
        timestamp: new Date().toISOString(),
      };

      const history = loadHistory();
      history.push(entry);

      // Keep only last N entries
      while (history.length > MAX_HISTORY) {
        history.shift();
      }

      saveHistory(history);
      return entry;
    },

    /**
     * Prints build time summary with comparison to previous builds.
     */
    report() {
      const duration = this.duration();
      const history = loadHistory().filter(h => h.platform === platform);

      if (history.length < 2) return;

      const previous = history[history.length - 2];
      if (!previous) return;

      const diff = duration - previous.duration;
      const pct = ((diff / previous.duration) * 100).toFixed(0);

      if (diff > 1000) {
        console.log(`  ${ui.c.dim}  ↑ ${Math.abs(pct)}% slower than last build (${formatMs(previous.duration)})${ui.c.reset}`);
      } else if (diff < -1000) {
        console.log(`  ${ui.c.dim}  ↓ ${Math.abs(pct)}% faster than last build (${formatMs(previous.duration)})${ui.c.reset}`);
      }

      // Show average
      if (history.length >= 3) {
        const avg = history.reduce((sum, h) => sum + h.duration, 0) / history.length;
        console.log(`  ${ui.c.dim}  ⌀ Average: ${formatMs(avg)} (${history.length} builds)${ui.c.reset}`);
      }
    },
  };
}

/**
 * Formats milliseconds to human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function formatMs(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

/**
 * Loads build history from disk.
 * @returns {Array}
 */
function loadHistory() {
  const historyFile = getHistoryPath();
  try {
    if (fs.existsSync(historyFile)) {
      return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    }
  } catch {
    // Corrupted file
  }
  return [];
}

/**
 * Saves build history to disk.
 * @param {Array} history
 */
function saveHistory(history) {
  const historyFile = getHistoryPath();
  const dir = path.dirname(historyFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

/**
 * Prints a summary of all build history.
 */
function printBuildStats() {
  const history = loadHistory();
  if (history.length === 0) {
    console.log(`  ${ui.c.dim}No build history yet${ui.c.reset}`);
    return;
  }

  const android = history.filter(h => h.platform === 'android');
  const ios = history.filter(h => h.platform === 'ios');

  console.log('');
  console.log(`  ${ui.c.bold}Build Statistics:${ui.c.reset}`);

  if (android.length > 0) {
    const avg = android.reduce((s, h) => s + h.duration, 0) / android.length;
    const fastest = Math.min(...android.map(h => h.duration));
    const slowest = Math.max(...android.map(h => h.duration));
    console.log(`  ${ui.c.green}Android${ui.c.reset}: avg ${formatMs(avg)} | fastest ${formatMs(fastest)} | slowest ${formatMs(slowest)} (${android.length} builds)`);
  }

  if (ios.length > 0) {
    const avg = ios.reduce((s, h) => s + h.duration, 0) / ios.length;
    const fastest = Math.min(...ios.map(h => h.duration));
    const slowest = Math.max(...ios.map(h => h.duration));
    console.log(`  ${ui.c.cyan}iOS${ui.c.reset}:     avg ${formatMs(avg)} | fastest ${formatMs(fastest)} | slowest ${formatMs(slowest)} (${ios.length} builds)`);
  }

  console.log('');
}

module.exports = {
  createBuildTimer,
  formatMs,
  printBuildStats,
  loadHistory,
};
