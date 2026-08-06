'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

/**
 * Validates that the iOS project structure exists.
 * @throws {Error} If ios/ directory or .xcworkspace is missing
 */
function validateIosProject() {
  const iosDir = path.resolve('ios');
  if (!fs.existsSync(iosDir)) {
    throw new Error(
      'ios/ directory not found in current directory\n' +
      '  Make sure you are running starship from the root of a React Native CLI project.'
    );
  }

  // Find .xcworkspace
  const workspace = findXcworkspace();
  if (!workspace) {
    throw new Error(
      'No .xcworkspace found in ios/ directory\n' +
      '  Run "cd ios && pod install" first to generate the workspace.'
    );
  }
}

/**
 * Finds the .xcworkspace file in the ios/ directory.
 * @returns {string|null} Workspace filename or null
 */
function findXcworkspace() {
  const iosDir = path.resolve('ios');
  try {
    const files = fs.readdirSync(iosDir);
    const workspace = files.find(f => f.endsWith('.xcworkspace'));
    return workspace || null;
  } catch {
    return null;
  }
}

/**
 * Gets the scheme name (usually the app name).
 * @returns {string} The scheme name
 */
function getScheme() {
  const workspace = findXcworkspace();
  // Scheme is usually the workspace name without extension
  return workspace.replace('.xcworkspace', '');
}

/**
 * Gets the bundle identifier from the Xcode project.
 * @returns {string} Bundle identifier
 */
function getBundleId() {
  const scheme = getScheme();
  // Try reading from project.pbxproj
  const pbxprojPath = path.resolve('ios', `${scheme}.xcodeproj`, 'project.pbxproj');
  if (fs.existsSync(pbxprojPath)) {
    const content = fs.readFileSync(pbxprojPath, 'utf8');
    const match = content.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?([^";]+)"?/);
    if (match) return match[1];
  }
  // Fallback: try from Info.plist or use scheme as identifier
  return `com.${scheme.toLowerCase()}`;
}

/**
 * Lists available iOS simulators.
 * @returns {Array<{name: string, udid: string, state: string}>}
 */
function listSimulators() {
  try {
    const output = execSync('xcrun simctl list devices available -j', { encoding: 'utf8' });
    const data = JSON.parse(output);
    const simulators = [];

    for (const [runtime, devices] of Object.entries(data.devices)) {
      if (!runtime.includes('iOS')) continue;
      for (const device of devices) {
        if (device.isAvailable) {
          simulators.push({
            name: device.name,
            udid: device.udid,
            state: device.state,
            runtime: runtime.split('.').pop().replace('iOS-', 'iOS ').replace(/-/g, '.'),
          });
        }
      }
    }
    return simulators;
  } catch {
    return [];
  }
}

/**
 * Boots a simulator if not already booted.
 * @param {string} udid - Simulator UDID
 */
function bootSimulator(udid) {
  try {
    execSync(`xcrun simctl boot ${udid}`, { encoding: 'utf8', stdio: 'pipe' });
  } catch {
    // Already booted — that's fine
  }
}

// ---------------------------------------------------------------------------
// iOS Cache — mirrors the Android APK cache system
// ---------------------------------------------------------------------------

function getIosCacheDir() {
  return path.resolve('.starship-cache');
}

function getIosCacheMetaFile() {
  return path.join(getIosCacheDir(), 'ios-build-meta.json');
}

/**
 * Computes a hash of iOS source files to detect changes.
 * Hashes: ios/**\/*.{swift,m,h,mm,storyboard,xib,plist,pbxproj,podfile,podfile.lock}
 * @returns {string} SHA-256 hash
 */
function computeIosSourceHash() {
  const hash = crypto.createHash('sha256');
  const filesToHash = [];

  const IOS_SOURCE_EXTS = new Set([
    '.swift', '.m', '.h', '.mm',
    '.storyboard', '.xib', '.plist',
    '.pbxproj', '.podfile', '.lock',
    '.json', '.js', '.ts', '.tsx', '.jsx',
  ]);

  const iosDir = path.resolve('ios');
  if (fs.existsSync(iosDir)) {
    collectIosFiles(iosDir, filesToHash, IOS_SOURCE_EXTS);
  }

  // Also include JS/TS source (affects bundle)
  const srcDir = path.resolve('src');
  if (fs.existsSync(srcDir)) {
    collectIosFiles(srcDir, filesToHash, new Set(['.js', '.ts', '.tsx', '.jsx', '.json']));
  }
  const indexJs = path.resolve('index.js');
  if (fs.existsSync(indexJs)) filesToHash.push(indexJs);

  filesToHash.sort();

  for (const file of filesToHash) {
    try {
      const content = fs.readFileSync(file);
      hash.update(file);
      hash.update(content);
    } catch {
      // skip
    }
  }

  return hash.digest('hex');
}

function collectIosFiles(dir, result, exts) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip build/generated dirs
        if (['build', 'DerivedData', 'Pods', '.git', 'node_modules',
             '__pycache__', 'xcuserdata'].includes(entry.name)) continue;
        collectIosFiles(fullPath, result, exts);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Also include Podfile (no extension match) by name
        if (exts.has(ext) || entry.name === 'Podfile') {
          result.push(fullPath);
        }
      }
    }
  } catch {
    // skip unreadable
  }
}

/**
 * Checks if a cached iOS .app exists and source hasn't changed.
 * @returns {{hit: boolean, appPath: string|null, hash: string}}
 */
function checkIosCache() {
  const currentHash = computeIosSourceHash();
  const metaFile = getIosCacheMetaFile();

  if (!fs.existsSync(metaFile)) {
    return { hit: false, appPath: null, hash: currentHash };
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    if (meta.sourceHash === currentHash && meta.appPath && fs.existsSync(meta.appPath)) {
      return { hit: true, appPath: meta.appPath, hash: currentHash };
    }
  } catch {
    // corrupted cache
  }

  return { hit: false, appPath: null, hash: currentHash };
}

/**
 * Saves iOS build metadata to cache.
 */
function saveIosCache({ appPath, sourceHash, buildTimeMs }) {
  const cacheDir = getIosCacheDir();
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(getIosCacheMetaFile(), JSON.stringify({
    sourceHash,
    appPath,
    buildTimeMs,
    timestamp: new Date().toISOString(),
    version: 1,
  }, null, 2));
}

// ---------------------------------------------------------------------------

/**
 * Checks if ccache is installed and enables it for the build environment.
 * ccache wraps the C++ compilers and caches results — huge speedup on repeated builds.
 * @returns {Object} env additions if ccache is available
 */
function getCcacheEnv() {
  try {
    const { execSync } = require('child_process');
    // Check if ccache is installed
    const ccachePath = execSync('which ccache', { encoding: 'utf8', stdio: 'pipe', timeout: 2000 }).trim();
    if (!ccachePath) return {};

    // Set ccache as the compiler wrapper for Clang/GCC
    return {
      CC: `${ccachePath} clang`,
      CXX: `${ccachePath} clang++`,
      CCACHE_SLOPPINESS: 'clang_index_store,ivfsoverlay,include_file_ctime,include_file_mtime',
      CCACHE_FILECLONE: 'true',
      CCACHE_DEPEND: 'true',
      CCACHE_INODECACHE: 'true',
      // Max cache size: 10GB
      CCACHE_MAXSIZE: '10G',
    };
  } catch {
    return {};
  }
}

/**
 * Enables ccache in ios/Podfile by uncommenting the ccache_enabled line.
 * React Native ships with ccache support built-in, just needs to be enabled.
 */
function enableCcacheInPodfile() {
  const podfilePath = path.resolve('ios', 'Podfile');
  if (!fs.existsSync(podfilePath)) return;

  try {
    let content = fs.readFileSync(podfilePath, 'utf8');
    // RN Podfile has this line commented out — uncomment it
    if (content.includes('#ccache_enabled = true') || content.includes('# ccache_enabled = true')) {
      content = content
        .replace(/#\s*ccache_enabled\s*=\s*true/g, 'ccache_enabled = true');
      fs.writeFileSync(podfilePath, content);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Builds the iOS app for simulator.
 * Uses xcodebuild with parallelized jobs, incremental build support, and ccache.
 * @param {Object} options
 * @param {string} options.bundlerHost - Metro host IP
 * @param {string} options.simulator - Simulator name (e.g., "iPhone 16")
 * @returns {Promise<string>} Path to the built .app
 */
async function buildIos({ bundlerHost, simulator }) {
  const iosDir = path.resolve('ios');
  const workspace = findXcworkspace();
  const scheme = getScheme();

  // Derived data path for finding the .app
  const derivedData = path.resolve('ios', 'build');

  // Enable ccache in Podfile if available (idempotent)
  enableCcacheInPodfile();

  // Number of CPU cores for parallel compilation
  const cpus = require('os').cpus().length;

  // ccache env vars — empty object if ccache not installed
  const ccacheEnv = getCcacheEnv();

  return new Promise((resolve, reject) => {
    const args = [
      '-workspace', path.join(iosDir, workspace),
      '-scheme', scheme,
      '-configuration', 'Debug',
      '-sdk', 'iphonesimulator',
      '-derivedDataPath', derivedData,
      '-destination', `platform=iOS Simulator,name=${simulator}`,
      // Parallel jobs — use all cores
      '-jobs', String(cpus),
      // Suppress verbose output for speed
      '-quiet',
      'build',
    ];

    const child = spawn('xcodebuild', args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        ...ccacheEnv,
        RCT_METRO_HOST: bundlerHost,
        RCT_METRO_PORT: '8081',
        // Disable Xcode index store writing — not needed for dev builds
        COMPILER_INDEX_STORE_ENABLE: 'NO',
        // Disable dSYM generation for debug simulator builds — saves time
        DEBUG_INFORMATION_FORMAT: 'dwarf',
        // Swift: incremental compilation (not whole-module) for debug
        SWIFT_COMPILATION_MODE: 'incremental',
      },
    });

    // Show progress with spinner
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let lastStep = 'Building';

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // Extract build phase for progress (even with -quiet some lines show)
        const phaseMatch = line.match(/^(Compile|Link|Copy|Process|Sign|Build|Merge|Generate)\w*/);
        if (phaseMatch) {
          lastStep = phaseMatch[0];
          spinnerIdx = (spinnerIdx + 1) % spinner.length;
          process.stdout.write(`\r  ${spinner[spinnerIdx]}  ${lastStep.substring(0, 48).padEnd(48)}`);
        }
      }
    });

    // xcodebuild with -quiet sends errors to stdout, not stderr
    let errorOutput = '';
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Animate spinner even when no output
    const spinnerTimer = setInterval(() => {
      spinnerIdx = (spinnerIdx + 1) % spinner.length;
      process.stdout.write(`\r  ${spinner[spinnerIdx]}  ${lastStep.substring(0, 48).padEnd(48)}`);
    }, 100);

    child.on('error', (err) => {
      clearInterval(spinnerTimer);
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      reject(new Error(`Failed to start xcodebuild: ${err.message}`));
    });

    child.on('close', (code) => {
      clearInterval(spinnerTimer);
      process.stdout.write('\r' + ' '.repeat(60) + '\r');

      if (code !== 0) {
        const errorLines = errorOutput.split('\n')
          .filter(l => l.includes('error:') || l.includes('Error:'))
          .slice(-5)
          .join('\n');
        reject(new Error(`Xcode build failed (exit code ${code}):\n${errorLines || 'Check Xcode for details'}`));
        return;
      }

      // Find the .app in derived data
      const appDir = path.join(derivedData, 'Build', 'Products', 'Debug-iphonesimulator');
      try {
        const files = fs.readdirSync(appDir);
        const appFile = files.find(f => f.endsWith('.app'));
        if (!appFile) {
          reject(new Error(`Built .app not found in ${appDir}`));
          return;
        }
        resolve(path.join(appDir, appFile));
      } catch (err) {
        reject(new Error(`Cannot read build output: ${err.message}`));
      }
    });
  });
}

/**
 * Installs and launches the app on a simulator.
 * @param {string} appPath - Path to the .app bundle
 * @param {string} udid - Simulator UDID
 * @param {string} bundleId - App bundle identifier
 */
function installOnSimulator(appPath, udid, bundleId) {
  execSync(`xcrun simctl install ${udid} "${appPath}"`, { stdio: 'pipe' });
  execSync(`xcrun simctl launch ${udid} ${bundleId}`, { stdio: 'pipe' });
  // Open Simulator app
  execSync('open -a Simulator', { stdio: 'pipe' });
}

module.exports = {
  validateIosProject,
  findXcworkspace,
  getScheme,
  getBundleId,
  listSimulators,
  bootSimulator,
  buildIos,
  installOnSimulator,
  checkIosCache,
  saveIosCache,
  computeIosSourceHash,
  enableCcacheInPodfile,
};
