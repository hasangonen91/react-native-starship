'use strict';

const { execSync, spawn } = require('child_process');
const readline = require('readline');
const { listConnectedDevices, displayDevices, adbReverseAllPorts, installOnAllDevices } = require('./device-manager');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const COMMANDS = [
  { key: 'a', label: 'Run on Android (all devices)' },
  { key: 'i', label: 'Run on iOS simulator' },
  { key: 'j', label: 'Open debugger' },
  { key: 'r', label: 'Reload app' },
  { key: 'd', label: 'Open Dev Menu' },
  { key: 'l', label: 'List connected devices' },
  { key: 'q', label: 'Quit' },
];

/**
 * Starts the interactive keyboard listener.
 * @param {Object} opts
 * @param {string} opts.ip - Local IP address
 * @param {string|null} opts.apkPath - Path to built APK (null if no Android)
 * @param {Function} opts.onQuit - Called when user presses 'q'
 */
function startInteractive(opts) {
  printCommands();

  if (!process.stdin.isTTY) return;

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  process.stdin.on('keypress', (str, key) => {
    if (key && key.ctrl && key.name === 'c') {
      if (opts.onQuit) opts.onQuit();
      return;
    }

    const pressed = str ? str.toLowerCase() : '';

    switch (pressed) {
      case 'a':
        runOnAndroid(opts.apkPath);
        break;
      case 'i':
        runOnIosSimulator();
        break;
      case 'j':
        openDebugger(opts.ip);
        break;
      case 'r':
        reloadApp(opts.ip);
        break;
      case 'd':
        openDevMenu();
        break;
      case 'l':
        showDevices();
        break;
      case 'q':
        if (opts.onQuit) opts.onQuit();
        break;
      case 'h':
      case '?':
        printCommands();
        break;
    }
  });
}

function printCommands() {
  console.log('');
  console.log(`  ${c.bold}Keyboard shortcuts:${c.reset}`);
  for (const cmd of COMMANDS) {
    console.log(`    ${c.cyan}${c.bold}${cmd.key}${c.reset} ${c.dim}—${c.reset} ${cmd.label}`);
  }
  console.log(`    ${c.cyan}${c.bold}h${c.reset} ${c.dim}—${c.reset} Show this menu`);
  console.log('');
}

/**
 * Shows connected devices — both USB (adb) and WiFi (tracked).
 */
function showDevices() {
  const devices = listConnectedDevices();
  displayDevices(devices);

  // Show WiFi-connected devices from tracker + persisted file
  const fs = require('fs');
  const path = require('path');
  const file = path.resolve('.starship-cache/known-devices.json');

  let wifiDevices = [];

  // Try in-memory tracker first
  try {
    const tracker = require('./device-tracker');
    for (const [ip, info] of tracker.knownDevices) {
      if (ip.startsWith('adb:')) continue;
      if (info.model === 'Unknown' || info.model === 'Android Device') continue;
      wifiDevices.push({ ip, ...info });
    }
  } catch {}

  // Fallback: read from disk if in-memory is empty
  if (wifiDevices.length === 0) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const [ip, info] of Object.entries(data)) {
          if (ip.startsWith('adb:')) continue;
          if (info.model === 'Unknown' || info.model === 'Android Device') continue;
          wifiDevices.push({ ip, ...info });
        }
      }
    } catch {}
  }

  if (wifiDevices.length > 0) {
    console.log('');
    console.log(`  ${c.bold}WiFi Devices (${wifiDevices.length}):${c.reset}`);
    console.log(`  ${c.gray}${'─'.repeat(52)}${c.reset}`);
    for (const dev of wifiDevices) {
      const icon = dev.platform === 'iOS' ? '🍎' : '🤖';
      const time = dev.lastSeen ? new Date(dev.lastSeen).toLocaleTimeString() : '';
      console.log(`  ${icon} ${c.white}${dev.model.padEnd(22)}${c.reset} ${c.dim}${(dev.os || '').padEnd(14)}${c.reset} ${c.cyan}${dev.ip}${c.reset} ${c.dim}${time}${c.reset}`);
    }
    console.log(`  ${c.gray}${'─'.repeat(52)}${c.reset}`);
  }
  console.log('');
}

/**
 * Launches Android emulator, waits for boot, installs APK, and launches app.
 * Supports multi-device: installs on ALL connected devices.
 */
function runOnAndroid(apkPath) {
  console.log(`  ${c.yellow}▶${c.reset} Running on Android...`);

  if (!apkPath) {
    console.log(`  ${c.red}✖${c.reset} No APK built. Run starship again to build first.`);
    return;
  }

  // Check connected devices
  let devices = listConnectedDevices();
  const activeDevices = devices.filter(d => d.type !== 'unauthorized');

  if (activeDevices.length === 0) {
    // Launch emulator
    try {
      const avdOutput = execSync('emulator -list-avds', { encoding: 'utf8', stdio: 'pipe' }).trim();
      const avds = avdOutput.split('\n').filter(Boolean);
      if (avds.length === 0) {
        console.log(`  ${c.red}✖${c.reset} No emulators found. Create one in Android Studio.`);
        return;
      }
      console.log(`  ${c.dim}  Starting ${avds[0]}...${c.reset}`);
      const emu = spawn('emulator', ['-avd', avds[0]], { stdio: 'ignore', detached: true });
      emu.unref();

      console.log(`  ${c.dim}  Waiting for boot...${c.reset}`);
      execSync('adb wait-for-device', { stdio: 'pipe', timeout: 60000 });
      waitForBoot();
      console.log(`  ${c.green}✔${c.reset} Emulator ready`);
      devices = listConnectedDevices();
    } catch (err) {
      console.log(`  ${c.red}✖${c.reset} Emulator failed: ${err.message.split('\n')[0]}`);
      return;
    }
  } else {
    console.log(`  ${c.green}✔${c.reset} ${activeDevices.length} device(s) connected`);
  }

  // Reverse ports on all devices
  adbReverseAllPorts([8081, 8888], devices);

  // Install APK on all devices
  console.log(`  ${c.dim}  Installing APK on ${devices.filter(d => d.type !== 'unauthorized').length} device(s)...${c.reset}`);
  const results = installOnAllDevices(apkPath, devices);

  if (results.success.length > 0) {
    console.log(`  ${c.green}✔${c.reset} APK installed on ${results.success.length} device(s)`);
  }
  if (results.failed.length > 0) {
    console.log(`  ${c.red}✖${c.reset} Install failed on ${results.failed.length} device(s)`);
  }

  // Launch app on all devices
  try {
    const fs = require('fs');
    const path = require('path');
    const buildGradle = path.resolve('android', 'app', 'build.gradle');
    const content = fs.readFileSync(buildGradle, 'utf8');
    const match = content.match(/applicationId\s+["']([^"']+)["']/);
    if (match) {
      const pkg = match[1];
      for (const deviceId of results.success) {
        try {
          execSync(`adb -s ${deviceId} shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, { stdio: 'pipe', timeout: 5000 });
        } catch {}
      }
      console.log(`  ${c.green}✔${c.reset} ${pkg} launched on ${results.success.length} device(s)`);
    }
  } catch {
    console.log(`  ${c.yellow}⚠${c.reset} Installed but could not auto-launch. Open manually.`);
  }
}

/**
 * Waits for Android emulator to finish booting.
 */
function waitForBoot() {
  const maxWait = 30; // seconds
  for (let i = 0; i < maxWait; i++) {
    try {
      const result = execSync('adb shell getprop sys.boot_completed', { encoding: 'utf8', stdio: 'pipe' }).trim();
      if (result === '1') return;
    } catch {}
    execSync('sleep 1', { stdio: 'pipe' });
  }
}

/**
 * Runs on iOS simulator — builds and installs.
 */
function runOnIosSimulator() {
  console.log(`  ${c.yellow}▶${c.reset} Running on iOS simulator...`);

  // Open Simulator app
  try {
    execSync('open -a Simulator', { stdio: 'pipe' });
  } catch {}

  // Find booted simulator
  let bootedUdid = null;
  try {
    const output = execSync('xcrun simctl list devices booted -j', { encoding: 'utf8', stdio: 'pipe' });
    const data = JSON.parse(output);
    for (const [, devices] of Object.entries(data.devices)) {
      for (const d of devices) {
        if (d.state === 'Booted') { bootedUdid = d.udid; break; }
      }
      if (bootedUdid) break;
    }
  } catch {}

  if (!bootedUdid) {
    // Boot first available iPhone
    try {
      const output = execSync('xcrun simctl list devices available -j', { encoding: 'utf8', stdio: 'pipe' });
      const data = JSON.parse(output);
      for (const [runtime, devices] of Object.entries(data.devices)) {
        if (!runtime.includes('iOS')) continue;
        for (const d of devices) {
          if (d.isAvailable && d.name.includes('iPhone')) {
            bootedUdid = d.udid;
            console.log(`  ${c.dim}  Booting ${d.name}...${c.reset}`);
            execSync(`xcrun simctl boot ${d.udid}`, { stdio: 'pipe' });
            break;
          }
        }
        if (bootedUdid) break;
      }
    } catch {}
  }

  if (!bootedUdid) {
    console.log(`  ${c.red}✖${c.reset} No simulator available`);
    return;
  }

  // Build and install using react-native run-ios
  console.log(`  ${c.dim}  Building and installing...${c.reset}`);
  try {
    const child = spawn('npx', ['react-native', 'run-ios', '--no-packager'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let lastLine = '';
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.includes('success') || line.includes('Launching')) {
          console.log(`  ${c.green}✔${c.reset} ${line.trim()}`);
        } else if (line.includes('Build Succeeded') || line.includes('BUILD SUCCEEDED')) {
          console.log(`  ${c.green}✔${c.reset} iOS build succeeded`);
        }
        lastLine = line;
      }
    });

    child.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line.includes('error') || line.includes('Error')) {
        console.log(`  ${c.red}✖${c.reset} ${line.split('\n')[0]}`);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`  ${c.green}✔${c.reset} App launched on simulator`);
      } else if (code !== null) {
        console.log(`  ${c.red}✖${c.reset} iOS build failed (exit ${code})`);
        console.log(`  ${c.dim}  Try: cd ios && pod install && cd ..${c.reset}`);
      }
    });
  } catch (err) {
    console.log(`  ${c.red}✖${c.reset} Failed: ${err.message.split('\n')[0]}`);
  }
}

/**
 * Opens debugger.
 */
function openDebugger(ip) {
  console.log(`  ${c.yellow}▶${c.reset} Opening debugger...`);

  let androidDone = false;
  let iosDone = false;

  // Android: send Cmd+M via AppleScript or keyevent
  try {
    const devices = execSync('adb devices', { encoding: 'utf8', stdio: 'pipe' });
    if (devices.includes('\tdevice')) {
      try {
        execSync(`osascript -e 'tell application "qemu-system-aarch64" to activate' -e 'tell application "System Events" to keystroke "m" using command down'`, { stdio: 'pipe', timeout: 3000 });
      } catch {
        execSync('adb shell input keyevent 82', { stdio: 'pipe', timeout: 3000 });
      }
      console.log(`  ${c.green}✔${c.reset} Android: Dev Menu triggered`);
      androidDone = true;
    }
  } catch {}

  // iOS: send Cmd+D via AppleScript
  try {
    execSync(`osascript -e 'tell application "Simulator" to activate' -e 'tell application "System Events" to keystroke "d" using command down'`, { stdio: 'pipe', timeout: 3000 });
    console.log(`  ${c.green}✔${c.reset} iOS: Dev Menu triggered`);
    iosDone = true;
  } catch {}

  if (androidDone || iosDone) {
    console.log(`  ${c.dim}  Tap "Open DevTools" in the menu${c.reset}`);
  } else {
    console.log(`  ${c.dim}  Android: Cmd+M | iOS: Cmd+D${c.reset}`);
  }
}

/**
 * Reloads the app via Metro.
 */
function reloadApp(ip) {
  const http = require('http');
  console.log(`  ${c.cyan}↻${c.reset} Reloading...`);
  const req = http.get('http://localhost:8081/reload', (res) => {
    if (res.statusCode === 200) {
      console.log(`  ${c.green}✔${c.reset} Reloaded`);
    } else {
      console.log(`  ${c.yellow}⚠${c.reset} Reload sent (status ${res.statusCode})`);
    }
    res.resume();
  });
  req.on('error', () => {
    console.log(`  ${c.red}✖${c.reset} Metro not reachable`);
  });
}

/**
 * Opens Dev Menu.
 */
function openDevMenu() {
  console.log(`  ${c.magenta}☰${c.reset} Opening Dev Menu...`);
  try {
    execSync('adb shell input keyevent 82', { stdio: 'pipe', timeout: 3000 });
    console.log(`  ${c.green}✔${c.reset} Dev Menu opened`);
  } catch {
    console.log(`  ${c.dim}  Shake your device or press Cmd+D in simulator${c.reset}`);
  }
}

module.exports = { startInteractive, printCommands };
