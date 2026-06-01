'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createBuildTimer, formatMs, loadHistory } = require('../../src/build-timer');
const { clearCache } = require('../../src/apk-cache');

describe('build-timer', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starship-timer-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('formatMs', () => {
    it('formats milliseconds under 1 second', () => {
      assert.strictEqual(formatMs(500), '500ms');
      assert.strictEqual(formatMs(0), '0ms');
      assert.strictEqual(formatMs(999), '999ms');
    });

    it('formats seconds under 1 minute', () => {
      assert.strictEqual(formatMs(1000), '1.0s');
      assert.strictEqual(formatMs(5500), '5.5s');
      assert.strictEqual(formatMs(59999), '60.0s');
    });

    it('formats minutes', () => {
      assert.strictEqual(formatMs(60000), '1m 0s');
      assert.strictEqual(formatMs(90000), '1m 30s');
      assert.strictEqual(formatMs(125000), '2m 5s');
    });
  });

  describe('createBuildTimer', () => {
    it('tracks duration', async () => {
      const timer = createBuildTimer('android');
      timer.start();

      // Wait a tiny bit
      await new Promise(r => setTimeout(r, 50));

      const duration = timer.stop();
      assert(duration >= 40, `Expected >= 40ms, got ${duration}`);
      assert(duration < 500, `Expected < 500ms, got ${duration}`);
    });

    it('returns formatted string', () => {
      const timer = createBuildTimer('android');
      timer.start();
      timer.stop();
      const formatted = timer.formatted();
      assert(typeof formatted === 'string');
      assert(formatted.length > 0);
    });

    it('saves to history file', () => {
      const timer = createBuildTimer('android');
      timer.start();
      timer.stop();
      const entry = timer.save();

      assert.strictEqual(entry.platform, 'android');
      assert(entry.duration >= 0);
      assert(entry.timestamp);

      const history = loadHistory();
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].platform, 'android');
    });

    it('saves multiple entries', () => {
      for (let i = 0; i < 3; i++) {
        const timer = createBuildTimer('android');
        timer.start();
        timer.stop();
        timer.save();
      }

      const history = loadHistory();
      assert.strictEqual(history.length, 3);
    });

    it('separates platforms in history', () => {
      const t1 = createBuildTimer('android');
      t1.start(); t1.stop(); t1.save();

      const t2 = createBuildTimer('ios');
      t2.start(); t2.stop(); t2.save();

      const history = loadHistory();
      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].platform, 'android');
      assert.strictEqual(history[1].platform, 'ios');
    });

    it('duration returns 0 before start', () => {
      const timer = createBuildTimer('android');
      assert.strictEqual(timer.duration(), 0);
    });
  });
});
