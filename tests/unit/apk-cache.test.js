'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { computeSourceHash, checkCache, saveCache, clearCache, getCacheStats, getCacheDir } = require('../../src/apk-cache');

describe('apk-cache', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starship-cache-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('computeSourceHash', () => {
    it('returns a hex string', () => {
      fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main {}');
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), 'apply plugin');

      const hash = computeSourceHash();
      assert.match(hash, /^[a-f0-9]{64}$/);
    });

    it('returns different hash when source changes', () => {
      fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main {}');

      const hash1 = computeSourceHash();

      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main { int x; }');

      const hash2 = computeSourceHash();
      assert.notStrictEqual(hash1, hash2);
    });

    it('returns same hash when source is unchanged', () => {
      fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main {}');

      const hash1 = computeSourceHash();
      const hash2 = computeSourceHash();
      assert.strictEqual(hash1, hash2);
    });

    it('returns a hash even with no android directory', () => {
      const hash = computeSourceHash();
      assert.match(hash, /^[a-f0-9]{64}$/);
    });
  });

  describe('checkCache', () => {
    it('returns miss when no cache exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src'), { recursive: true });
      const result = checkCache();
      assert.strictEqual(result.hit, false);
      assert.strictEqual(result.apkPath, null);
      assert.match(result.hash, /^[a-f0-9]{64}$/);
    });

    it('returns hit when cache matches and APK exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main {}');

      const apkPath = path.join(tmpDir, 'app-debug.apk');
      fs.writeFileSync(apkPath, 'fake-apk');

      const hash = computeSourceHash();
      saveCache({ apkPath, sourceHash: hash, buildTimeMs: 5000 });

      const result = checkCache();
      assert.strictEqual(result.hit, true);
      assert.strictEqual(result.apkPath, apkPath);
    });

    it('returns miss when source has changed', () => {
      fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main {}');

      const apkPath = path.join(tmpDir, 'app-debug.apk');
      fs.writeFileSync(apkPath, 'fake-apk');

      const hash = computeSourceHash();
      saveCache({ apkPath, sourceHash: hash, buildTimeMs: 5000 });

      // Change source
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main { int y; }');

      const result = checkCache();
      assert.strictEqual(result.hit, false);
    });

    it('returns miss when APK file is deleted', () => {
      fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'Main.java'), 'class Main {}');

      const apkPath = path.join(tmpDir, 'app-debug.apk');
      fs.writeFileSync(apkPath, 'fake-apk');

      const hash = computeSourceHash();
      saveCache({ apkPath, sourceHash: hash, buildTimeMs: 5000 });

      // Delete APK
      fs.unlinkSync(apkPath);

      const result = checkCache();
      assert.strictEqual(result.hit, false);
    });
  });

  describe('saveCache / clearCache', () => {
    it('creates cache directory and meta file', () => {
      const apkPath = path.join(tmpDir, 'app.apk');
      fs.writeFileSync(apkPath, 'apk');

      saveCache({ apkPath, sourceHash: 'abc123', buildTimeMs: 3000 });

      const cacheDir = path.resolve('.starship-cache');
      assert.strictEqual(fs.existsSync(cacheDir), true);
      assert.strictEqual(fs.existsSync(path.join(cacheDir, 'build-meta.json')), true);
    });

    it('clearCache removes the cache directory', () => {
      saveCache({ apkPath: '/tmp/x.apk', sourceHash: 'abc', buildTimeMs: 1000 });
      const cacheDir = path.resolve('.starship-cache');
      assert.strictEqual(fs.existsSync(cacheDir), true);
      clearCache();
      assert.strictEqual(fs.existsSync(cacheDir), false);
    });
  });

  describe('getCacheStats', () => {
    it('returns exists: false when no cache', () => {
      const stats = getCacheStats();
      assert.strictEqual(stats.exists, false);
      assert.strictEqual(stats.lastBuild, null);
    });

    it('returns stats when cache exists', () => {
      saveCache({ apkPath: '/tmp/x.apk', sourceHash: 'abc', buildTimeMs: 4200, timestamp: '2025-01-01T00:00:00.000Z' });

      const stats = getCacheStats();
      assert.strictEqual(stats.exists, true);
      assert.strictEqual(stats.lastBuildTime, 4200);
      assert.strictEqual(stats.lastBuild, '2025-01-01T00:00:00.000Z');
    });
  });
});
