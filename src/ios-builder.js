'use strict';

const fs = require('fs');
const path = require('path');
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
  const iosDir = path.resolve('ios');
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

/**
 * Builds the iOS app for simulator.
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

  return new Promise((resolve, reject) => {
    const args = [
      '-workspace', path.join(iosDir, workspace),
      '-scheme', scheme,
      '-configuration', 'Debug',
      '-sdk', 'iphonesimulator',
      '-derivedDataPath', derivedData,
      '-destination', `platform=iOS Simulator,name=${simulator}`,
      'build',
    ];

    const child = spawn('xcodebuild', args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        RCT_METRO_HOST: bundlerHost,
        RCT_METRO_PORT: '8081',
      },
    });

    // Show progress with spinner
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let lastStep = '';

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // Extract build phase for progress
        const phaseMatch = line.match(/^(Compile|Link|Copy|Process|Sign|Build)\w*/);
        if (phaseMatch) {
          lastStep = phaseMatch[0];
          spinnerIdx = (spinnerIdx + 1) % spinner.length;
          process.stdout.write(`\r  ${spinner[spinnerIdx]}  ${lastStep.substring(0, 48).padEnd(48)}`);
        }
      }
    });

    let stderrOutput = '';
    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    child.on('error', (err) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      reject(new Error(`Failed to start xcodebuild: ${err.message}`));
    });

    child.on('close', (code) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');

      if (code !== 0) {
        // Extract meaningful error from xcodebuild output
        const errorLines = stderrOutput.split('\n')
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
};
