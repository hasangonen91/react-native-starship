'use strict';

const { execSync } = require('child_process');
const ui = require('./ui');

/**
 * Represents a connected Android device.
 * @typedef {Object} Device
 * @property {string} id - Device serial/ID
 * @property {string} type - 'device', 'emulator', or 'unauthorized'
 * @property {string} model - Device model name
 * @property {string} name - Friendly display name
 */

/**
 * Lists all connected Android devices via adb.
 * @returns {Device[]} Array of connected devices
 */
function listConnectedDevices() {
  try {
    const output = execSync('adb devices -l', { encoding: 'utf8', stdio: 'pipe' });
    const lines = output.split('\n').slice(1).filter(l => l.trim());
    const devices = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      const id = parts[0];
      const status = parts[1];

      if (status === 'device' || status === 'unauthorized') {
        const isEmulator = id.startsWith('emulator-');
        let model = 'Unknown';
        let name = id;

        if (status === 'device') {
          // Extract model from the -l output
          const modelMatch = line.match(/model:(\S+)/);
          const deviceMatch = line.match(/device:(\S+)/);
          if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');
          if (deviceMatch) name = deviceMatch[1].replace(/_/g, ' ');
        }

        devices.push({
          id,
          type: status === 'unauthorized' ? 'unauthorized' : (isEmulator ? 'emulator' : 'device'),
          model,
          name: status === 'unauthorized' ? `${id} (unauthorized)` : name,
        });
      }
    }

    return devices;
  } catch {
    return [];
  }
}

/**
 * Displays connected devices in a formatted table.
 * @param {Device[]} devices
 */
function displayDevices(devices) {
  if (devices.length === 0) {
    console.log(`  ${ui.c.dim}No devices connected${ui.c.reset}`);
    return;
  }

  console.log('');
  console.log(`  ${ui.c.bold}Connected Devices (${devices.length}):${ui.c.reset}`);
  console.log(`  ${ui.c.gray}${'─'.repeat(52)}${ui.c.reset}`);

  for (const device of devices) {
    const icon = device.type === 'emulator' ? '💻' : device.type === 'unauthorized' ? '🔒' : '📱';
    const typeLabel = device.type === 'emulator'
      ? `${ui.c.cyan}emulator${ui.c.reset}`
      : device.type === 'unauthorized'
        ? `${ui.c.red}unauthorized${ui.c.reset}`
        : `${ui.c.green}physical${ui.c.reset}`;

    console.log(`  ${icon} ${ui.c.white}${device.model.padEnd(20)}${ui.c.reset} ${typeLabel.padEnd(30)} ${ui.c.dim}${device.id}${ui.c.reset}`);
  }

  console.log(`  ${ui.c.gray}${'─'.repeat(52)}${ui.c.reset}`);
  console.log('');
}

/**
 * Runs adb reverse for a specific port on all connected devices.
 * @param {number} port - The port to reverse (e.g., 8081 for Metro)
 * @param {Device[]} [devices] - Optional device list (fetches if not provided)
 * @returns {{success: string[], failed: string[]}} Results per device
 */
function adbReverseAll(port, devices) {
  if (!devices) devices = listConnectedDevices();

  const results = { success: [], failed: [] };
  const activeDevices = devices.filter(d => d.type !== 'unauthorized');

  for (const device of activeDevices) {
    try {
      execSync(`adb -s ${device.id} reverse tcp:${port} tcp:${port}`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 5000,
      });
      results.success.push(device.id);
    } catch {
      results.failed.push(device.id);
    }
  }

  return results;
}

/**
 * Runs adb reverse for multiple ports on all connected devices.
 * @param {number[]} ports - Array of ports to reverse
 * @param {Device[]} [devices] - Optional device list
 */
function adbReverseAllPorts(ports, devices) {
  if (!devices) devices = listConnectedDevices();
  const activeDevices = devices.filter(d => d.type !== 'unauthorized');

  if (activeDevices.length === 0) return;

  for (const port of ports) {
    const results = adbReverseAll(port, activeDevices);
    if (results.success.length > 0) {
      ui.success(`adb reverse tcp:${port} → ${results.success.length} device(s)`);
    }
    if (results.failed.length > 0) {
      ui.warn(`adb reverse tcp:${port} failed on: ${results.failed.join(', ')}`);
    }
  }
}

/**
 * Installs APK on all connected devices.
 * @param {string} apkPath - Path to the APK file
 * @param {Device[]} [devices] - Optional device list
 * @returns {{success: string[], failed: string[]}}
 */
function installOnAllDevices(apkPath, devices) {
  if (!devices) devices = listConnectedDevices();
  const activeDevices = devices.filter(d => d.type !== 'unauthorized');

  const results = { success: [], failed: [] };

  for (const device of activeDevices) {
    try {
      execSync(`adb -s ${device.id} install -r "${apkPath}"`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000,
      });
      results.success.push(device.id);
    } catch {
      results.failed.push(device.id);
    }
  }

  return results;
}

/**
 * Sets the debug server host on all connected devices via SharedPreferences.
 * Uses `run-as` to write directly to the app's shared_prefs directory.
 * This makes the app connect to Metro without manual Dev Settings configuration.
 * @param {string} applicationId - The app's package name
 * @param {string} host - Host:port string (e.g., "192.168.1.100:8081")
 * @param {Device[]} [devices] - Optional device list
 * @returns {{success: string[], failed: string[]}}
 */
function setDebugHostOnDevices(applicationId, host, devices) {
  if (!devices) devices = listConnectedDevices();
  const activeDevices = devices.filter(d => d.type !== 'unauthorized');

  const results = { success: [], failed: [] };

  const prefsXml = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="debug_http_host">${host}</string>
</map>`;

  for (const device of activeDevices) {
    try {
      // Use run-as to write SharedPreferences file directly
      // The default prefs file is: <package>_preferences.xml
      const prefsFileName = `${applicationId}_preferences.xml`;
      const prefsDir = `/data/data/${applicationId}/shared_prefs`;

      // Create shared_prefs dir and write the file
      const writeCmd = `run-as ${applicationId} sh -c 'mkdir -p ${prefsDir} && cat > ${prefsDir}/${prefsFileName}'`;
      execSync(`adb -s ${device.id} shell "${writeCmd}"`, {
        input: prefsXml,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });

      results.success.push(device.id);
    } catch {
      // Try alternative: write via echo (some shells don't support stdin piping)
      try {
        const escaped = prefsXml.replace(/'/g, "'\"'\"'");
        const cmd = `run-as ${applicationId} sh -c 'mkdir -p /data/data/${applicationId}/shared_prefs && echo '"'"'${prefsXml.replace(/\n/g, '\\n').replace(/'/g, "\\'")}'"'"' > /data/data/${applicationId}/shared_prefs/${applicationId}_preferences.xml'`;
        execSync(`adb -s ${device.id} shell "${cmd}"`, {
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 5000,
        });
        results.success.push(device.id);
      } catch {
        results.failed.push(device.id);
      }
    }
  }

  return results;
}

module.exports = {
  listConnectedDevices,
  displayDevices,
  adbReverseAll,
  adbReverseAllPorts,
  installOnAllDevices,
  setDebugHostOnDevices,
};
