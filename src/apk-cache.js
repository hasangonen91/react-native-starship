'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Gets the cache directory path (relative to cwd).
 * @returns {string}
 */
function getCacheDir() {
  return path.resolve('.starship-cache');
}

/**
 * Gets the cache meta file path.
 * @returns {string}
 */
function getCacheMetaFile() {
  return path.join(getCacheDir(), 'build-meta.json');
}

// getCacheDir() is used dynamically to support cwd changes

/**
 * Computes a hash of all relevant source files to detect changes.
 * Includes: android/app/src/**, android/app/build.gradle, android/build.gradle
 * @returns {string} SHA-256 hash of source content
 */
function computeSourceHash() {
  const hash = crypto.createHash('sha256');
  const filesToHash = [];

  // Collect android source files
  const srcDir = path.resolve('android', 'app', 'src');
  if (fs.existsSync(srcDir)) {
    collectFiles(srcDir, filesToHash);
  }

  // Include build.gradle files
  const buildGradleApp = path.resolve('android', 'app', 'build.gradle');
  const buildGradleRoot = path.resolve('android', 'build.gradle');
  const settingsGradle = path.resolve('android', 'settings.gradle');

  if (fs.existsSync(buildGradleApp)) filesToHash.push(buildGradleApp);
  if (fs.existsSync(buildGradleRoot)) filesToHash.push(buildGradleRoot);
  if (fs.existsSync(settingsGradle)) filesToHash.push(settingsGradle);

  // Sort for deterministic hashing
  filesToHash.sort();

  for (const file of filesToHash) {
    try {
      const content = fs.readFileSync(file);
      hash.update(file); // include path in hash
      hash.update(content);
    } catch {
      // Skip unreadable files
    }
  }

  return hash.digest('hex');
}

/**
 * Recursively collects file paths from a directory.
 * @param {string} dir
 * @param {string[]} result
 */
function collectFiles(dir, result) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip build directories
        if (entry.name === 'build' || entry.name === '.gradle') continue;
        collectFiles(fullPath, result);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

/**
 * Checks if a cached APK exists and is still valid.
 * @returns {{hit: boolean, apkPath: string|null, hash: string}}
 */
function checkCache() {
  const currentHash = computeSourceHash();
  const metaFile = getCacheMetaFile();

  if (!fs.existsSync(metaFile)) {
    return { hit: false, apkPath: null, hash: currentHash };
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));

    if (meta.sourceHash === currentHash && meta.apkPath && fs.existsSync(meta.apkPath)) {
      return { hit: true, apkPath: meta.apkPath, hash: currentHash };
    }
  } catch {
    // Corrupted cache — treat as miss
  }

  return { hit: false, apkPath: null, hash: currentHash };
}

/**
 * Saves build metadata to cache.
 * @param {Object} meta
 * @param {string} meta.apkPath - Path to the built APK
 * @param {string} meta.sourceHash - Hash of source files at build time
 * @param {number} meta.buildTimeMs - Build duration in milliseconds
 * @param {string} meta.timestamp - ISO timestamp of the build
 */
function saveCache(meta) {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const data = {
    sourceHash: meta.sourceHash,
    apkPath: meta.apkPath,
    buildTimeMs: meta.buildTimeMs,
    timestamp: meta.timestamp || new Date().toISOString(),
    version: 1,
  };

  fs.writeFileSync(getCacheMetaFile(), JSON.stringify(data, null, 2));
}

/**
 * Clears the APK cache.
 */
function clearCache() {
  const cacheDir = getCacheDir();
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

/**
 * Gets cache statistics.
 * @returns {{exists: boolean, lastBuild: string|null, lastBuildTime: number|null}}
 */
function getCacheStats() {
  const metaFile = getCacheMetaFile();
  if (!fs.existsSync(metaFile)) {
    return { exists: false, lastBuild: null, lastBuildTime: null };
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    return {
      exists: true,
      lastBuild: meta.timestamp || null,
      lastBuildTime: meta.buildTimeMs || null,
    };
  } catch {
    return { exists: false, lastBuild: null, lastBuildTime: null };
  }
}

module.exports = {
  computeSourceHash,
  checkCache,
  saveCache,
  clearCache,
  getCacheStats,
  getCacheDir,
};
