'use strict';

/**
 * Tracks devices that interact with Starship (download APK, connect to Metro).
 * Shared state between server.js and metro.js.
 */

const knownDevices = new Map(); // ip -> { model, platform, os, firstSeen, lastSeen }

// Load persisted devices from disk
const DEVICES_FILE = '.starship-cache/known-devices.json';
function loadPersistedDevices() {
  try {
    const fs = require('fs');
    const path = require('path');
    const file = path.resolve(DEVICES_FILE);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const [ip, info] of Object.entries(data)) {
        knownDevices.set(ip, info);
      }
    }
  } catch {}
}

function persistDevices() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.resolve('.starship-cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(knownDevices);
    fs.writeFileSync(path.resolve(DEVICES_FILE), JSON.stringify(obj, null, 2));
  } catch {}
}

loadPersistedDevices();

/**
 * Parses device info from User-Agent header.
 * @param {string|undefined} ua - User-Agent string
 * @returns {{model: string, platform: string, os: string}|null}
 */
function parseDevice(ua) {
  if (!ua) return null;

  // Android: "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007) ..."
  // or: "Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Pro Build/...)"
  const androidMatch = ua.match(/Android\s+([\d.]+);\s*(?:U;\s*)?([^;)]+?)(?:\s*Build\/|\))/);
  if (androidMatch) {
    let model = androidMatch[2].trim();
    // Short code names (1-2 chars) are useless — use "Android Device" instead
    if (model.length <= 2) {
      model = getAdbModel() || 'Android Device';
    }
    return {
      model,
      platform: 'Android',
      os: `Android ${androidMatch[1]}`,
    };
  }

  // Simpler Android pattern: "; MODEL Build/"
  const simpleAndroid = ua.match(/;\s*([^;)]+)\s*Build\//);
  if (simpleAndroid && ua.toLowerCase().includes('android')) {
    let model = simpleAndroid[1].trim();
    if (model.length <= 2) {
      model = getAdbModel() || 'Android Device';
    }
    const ver = ua.match(/Android\s+([\d.]+)/);
    return {
      model,
      platform: 'Android',
      os: ver ? `Android ${ver[1]}` : 'Android',
    };
  }

  // iOS: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ..."
  const iosMatch = ua.match(/(iPhone|iPad).*?OS\s+([\d_]+)/);
  if (iosMatch) {
    return {
      model: iosMatch[1],
      platform: 'iOS',
      os: `iOS ${iosMatch[2].replace(/_/g, '.')}`,
    };
  }

  // React Native runtime UA: "ReactNative/0.85 (com.helloworld; ...)"
  if (ua.includes('ReactNative') || ua.includes('okhttp')) {
    return {
      model: getAdbModel() || 'Android Device',
      platform: 'Android',
      os: 'Android',
    };
  }

  return null;
}

/**
 * Tries to get the device model from adb (first connected physical device).
 * @returns {string|null}
 */
function getAdbModel() {
  try {
    const { execSync } = require('child_process');
    // Get all devices with model info
    const output = execSync('adb devices -l', { encoding: 'utf8', stdio: 'pipe', timeout: 3000 });
    const lines = output.split('\n').filter(l => l.includes('\tdevice'));

    for (const line of lines) {
      // Skip emulators
      if (line.startsWith('emulator-')) continue;
      const modelMatch = line.match(/model:(\S+)/);
      if (modelMatch) {
        return modelMatch[1].replace(/_/g, ' ');
      }
    }

    // If only emulator, try getprop on it
    for (const line of lines) {
      if (line.startsWith('emulator-')) {
        const id = line.split(/\s+/)[0];
        const model = execSync(`adb -s ${id} shell getprop ro.product.model`, { encoding: 'utf8', stdio: 'pipe', timeout: 3000 }).trim();
        if (model) return model.replace(/_/g, ' ');
      }
    }
  } catch {}
  return null;
}

/**
 * Pre-seeds the device tracker with info from USB-connected devices.
 * Called at startup to have model info ready before WiFi connections arrive.
 */
function seedFromAdb() {
  try {
    const { execSync } = require('child_process');
    const output = execSync('adb devices -l', { encoding: 'utf8', stdio: 'pipe', timeout: 3000 });
    const lines = output.split('\n').filter(l => l.includes('\tdevice'));

    for (const line of lines) {
      if (line.startsWith('emulator-')) continue;
      const id = line.split(/\s+/)[0];
      const modelMatch = line.match(/model:(\S+)/);
      if (!modelMatch) continue;

      const model = modelMatch[1].replace(/_/g, ' ');

      // Try to get Android version
      let osVersion = 'Android';
      try {
        const ver = execSync(`adb -s ${id} shell getprop ro.build.version.release`, { encoding: 'utf8', stdio: 'pipe', timeout: 2000 }).trim();
        if (ver) osVersion = `Android ${ver}`;
      } catch {}

      // Try to get device IP to map WiFi connections later
      let deviceIp = null;
      try {
        const ipOutput = execSync(`adb -s ${id} shell ip route | grep wlan`, { encoding: 'utf8', stdio: 'pipe', timeout: 2000 }).trim();
        const ipMatch = ipOutput.match(/src\s+([\d.]+)/);
        if (ipMatch) deviceIp = ipMatch[1];
      } catch {}

      if (deviceIp) {
        knownDevices.set(deviceIp, {
          model,
          platform: 'Android',
          os: osVersion,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }

      // Also store by device ID for reference
      knownDevices.set(`adb:${id}`, {
        model,
        platform: 'Android',
        os: osVersion,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      });
    }

    persistDevices();
  } catch {}
}

// Seed on module load
seedFromAdb();

/**
 * Registers a device that accessed the server.
 * @param {string} ip - Device IP address
 * @param {string|undefined} userAgent - User-Agent header
 * @returns {{model: string, platform: string, os: string}|null}
 */
function trackDevice(ip, userAgent) {
  const info = parseDevice(userAgent);
  const now = Date.now();
  const existing = knownDevices.get(ip);

  // If we already have good info from adb seed, don't overwrite with bad UA data
  if (existing && existing.model !== 'Unknown' && existing.model !== 'Android Device') {
    existing.lastSeen = now;
    return existing;
  }

  if (info && info.model !== 'Android Device') {
    knownDevices.set(ip, { ...info, firstSeen: existing ? existing.firstSeen : now, lastSeen: now });
    persistDevices();
  } else if (!existing) {
    const fallback = info || { model: 'Android Device', platform: 'Android', os: 'Android' };
    knownDevices.set(ip, { ...fallback, firstSeen: now, lastSeen: now });
  } else {
    existing.lastSeen = now;
  }

  return knownDevices.get(ip);
}

/**
 * Gets device info by IP.
 * @param {string} ip
 * @returns {{model: string, platform: string, os: string}|null}
 */
function getDevice(ip) {
  return knownDevices.get(ip) || null;
}

/**
 * Gets the last known device (most recently seen).
 * @returns {{ip: string, model: string, platform: string, os: string}|null}
 */
function getLastDevice() {
  let latest = null;
  let latestTime = 0;

  for (const [ip, info] of knownDevices) {
    if (info.lastSeen > latestTime && info.model !== 'Unknown') {
      latestTime = info.lastSeen;
      latest = { ip, ...info };
    }
  }

  return latest;
}

/**
 * Formats device info for terminal display.
 * @param {{model: string, platform: string, os: string}} device
 * @returns {string}
 */
function formatDevice(device) {
  if (!device) return '';
  const icon = device.platform === 'iOS' ? '🍎' : '🤖';
  return `${icon} ${device.model} (${device.os})`;
}

module.exports = {
  parseDevice,
  trackDevice,
  getDevice,
  getLastDevice,
  formatDevice,
  knownDevices,
};
