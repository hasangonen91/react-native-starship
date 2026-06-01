'use strict';

const fs = require('fs');
const path = require('path');
const { validateProject, parseApplicationId, buildApk } = require('./apk-builder');
const { getLocalIP } = require('./network');
const { startServer, buildUrl } = require('./server');
const { displayQR } = require('./qr');
const { startMetro } = require('./metro');
const { listConnectedDevices, displayDevices, adbReverseAllPorts, installOnAllDevices, setDebugHostOnDevices } = require('./device-manager');
const { checkCache, saveCache } = require('./apk-cache');
const { createBuildTimer } = require('./build-timer');
const ui = require('./ui');

const shutdown = {
  metroProcess: null,
  buildProcess: null,
  httpServer: null,
  fileWatcher: null,
};

function gracefulShutdown() {
  ui.shutdownMsg();
  if (shutdown.metroProcess) shutdown.metroProcess.kill('SIGTERM');
  if (shutdown.buildProcess) shutdown.buildProcess.kill('SIGTERM');
  if (shutdown.httpServer) shutdown.httpServer.close();
  if (shutdown.fileWatcher) shutdown.fileWatcher.close();

  const t = setTimeout(() => {
    if (shutdown.metroProcess) shutdown.metroProcess.kill('SIGKILL');
    if (shutdown.buildProcess) shutdown.buildProcess.kill('SIGKILL');
    process.exit(0);
  }, 5000);
  t.unref();
  setTimeout(() => { process.exit(0); }, 500).unref();
}

function startWatchMode(options) {
  const watchDir = path.resolve('android', 'app', 'src');
  const validExtensions = ['.java', '.kt', '.xml'];
  let isBuilding = false;
  let rebuildQueued = false;
  let debounceTimer = null;

  async function performBuild() {
    isBuilding = true;
    const timer = createBuildTimer('android');
    timer.start();
    try {
      await buildApk({ bundlerHost: options.bundlerHost, metroPort: options.metroPort, serverPort: options.serverPort });
      timer.stop();
      timer.save();
      ui.watchRebuildSuccess(timer.duration());
      timer.report();
    } catch (err) {
      ui.watchRebuildFailed(err.message);
    } finally {
      isBuilding = false;
      shutdown.buildProcess = null;
      if (rebuildQueued) { rebuildQueued = false; performBuild(); }
    }
  }

  function onFileChange(eventType, filename) {
    if (filename) {
      const ext = path.extname(filename);
      if (!validExtensions.includes(ext)) return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (isBuilding) { rebuildQueued = true; } else { performBuild(); }
    }, 500);
  }

  const watcher = fs.watch(watchDir, { recursive: true }, onFileChange);
  shutdown.fileWatcher = watcher;
}

/**
 * Main entry — auto-detects platforms and builds both if available.
 * Single command: `npx react-native starship`
 *
 * @param {Object} options
 * @param {boolean} options.watch - Watch mode
 * @param {boolean} options.ios - iOS mode
 * @param {number} options.port - Custom Metro port (default: 8081)
 * @param {number} options.serverPort - Custom HTTP server port (default: 8888)
 * @param {boolean} options.noCache - Skip APK cache
 */
async function run(options) {
  process.on('SIGINT', gracefulShutdown);

  const metroPort = options.port || 8081;
  const serverPort = options.serverPort || 8888;

  ui.banner();

  // Detect platforms
  const hasAndroid = fs.existsSync(path.resolve('android'));
  const hasIos = fs.existsSync(path.resolve('ios'));

  if (!hasAndroid && !hasIos) {
    ui.error('No platform found', 'Neither android/ nor ios/ directory exists.');
    process.exit(1);
  }

  // Step 1: Network IP
  ui.step(1, 'Detecting network IP...');
  let ip;
  try {
    ip = getLocalIP();
    ui.success(`Network IP: ${ip}`);
  } catch (err) {
    ui.error('Network detection failed', err.message);
    process.exit(1);
  }

  // Step 2: Detect connected devices
  if (hasAndroid) {
    ui.step(2, 'Scanning connected devices...');
    const devices = listConnectedDevices();
    displayDevices(devices);

    // Automatic adb reverse for Metro and HTTP server ports
    if (devices.length > 0) {
      const portsToReverse = [metroPort, serverPort];
      adbReverseAllPorts(portsToReverse, devices);
    }
  }

  let apkPath = null;
  let iosAppPath = null;
  let iosSimulator = null;
  let iosBundleId = null;
  let applicationId = null;
  const buildPromises = [];
  let stepNum = 3;

  // --- Android ---
  if (hasAndroid) {
    ui.step(stepNum, 'Preparing Android...');
    try {
      validateProject();
      applicationId = parseApplicationId();
      ui.success(`Android: ${applicationId}`);
    } catch (err) {
      ui.warn(`Android skipped: ${err.message.split('\n')[0]}`);
    }

    if (applicationId) {
      stepNum++;

      // Check APK cache
      if (!options.noCache) {
        const cache = checkCache();
        if (cache.hit) {
          apkPath = cache.apkPath;
          ui.success(`APK cache hit — skipping build`);
          console.log(`  ${ui.c.dim}  Cached: ${path.basename(apkPath)}${ui.c.reset}`);
        }
      }

      if (!apkPath) {
        ui.step(stepNum, 'Building Android APK...');
        ui.buildStart(ip);
        const timer = createBuildTimer('android');
        timer.start();

        buildPromises.push(
          buildApk({ bundlerHost: ip, metroPort, serverPort }).then((result) => {
            apkPath = result;
            timer.stop();
            timer.save();
            ui.buildSuccess(apkPath, timer.duration());
            timer.report();

            // Save to cache
            if (!options.noCache) {
              const { computeSourceHash } = require('./apk-cache');
              saveCache({
                apkPath: result,
                sourceHash: computeSourceHash(),
                buildTimeMs: timer.duration(),
              });
            }
          }).catch((err) => {
            ui.buildFailed(`Android: ${err.message}`);
          })
        );
      }
    }
  }

  // --- iOS ---
  if (hasIos) {
    const {
      validateIosProject, getScheme, getBundleId,
      listSimulators, bootSimulator, buildIos,
    } = require('./ios-builder');

    stepNum++;
    ui.step(stepNum, 'Preparing iOS...');
    try {
      validateIosProject();
      const scheme = getScheme();
      iosBundleId = getBundleId();
      ui.success(`iOS: ${scheme} (${iosBundleId})`);

      const simulators = listSimulators();
      if (simulators.length > 0) {
        iosSimulator = simulators.find(s => s.state === 'Booted');
        if (!iosSimulator) {
          const iphones = simulators.filter(s => s.name.includes('iPhone'));
          iosSimulator = iphones.length > 0 ? iphones[iphones.length - 1] : simulators[0];
          bootSimulator(iosSimulator.udid);
        }
        ui.success(`Simulator: ${iosSimulator.name}`);

        stepNum++;
        ui.step(stepNum, `Building iOS for ${iosSimulator.name}...`);
        const timer = createBuildTimer('ios');
        timer.start();
        buildPromises.push(
          buildIos({ bundlerHost: ip, simulator: iosSimulator.name }).then((result) => {
            iosAppPath = result;
            timer.stop();
            timer.save();
            ui.success(`iOS built in ${timer.formatted()}`);
            timer.report();
          }).catch((err) => {
            ui.warn(`iOS build failed: ${err.message.split('\n')[0]}`);
          })
        );
      } else {
        ui.warn('No iOS simulators — skipping');
      }
    } catch (err) {
      ui.warn(`iOS skipped: ${err.message.split('\n')[0]}`);
    }
  }

  // Wait for builds
  if (buildPromises.length > 0) await Promise.all(buildPromises);

  // Multi-device APK install
  if (apkPath && hasAndroid) {
    const devices = listConnectedDevices();
    const activeDevices = devices.filter(d => d.type !== 'unauthorized');

    if (activeDevices.length > 0) {
      stepNum++;
      ui.step(stepNum, `Installing APK on ${activeDevices.length} device(s)...`);
      const results = installOnAllDevices(apkPath, devices);
      if (results.success.length > 0) {
        ui.success(`APK installed on ${results.success.length} device(s)`);
      }
      if (results.failed.length > 0) {
        ui.warn(`Install failed on ${results.failed.length} device(s)`);
      }

      // Auto-set debug server host on USB-connected devices
      if (applicationId && results.success.length > 0) {
        const metroHost = `${ip}:${metroPort}`;
        const hostResults = setDebugHostOnDevices(applicationId, metroHost, devices);
        if (hostResults.success.length > 0) {
          ui.success(`Debug host ${metroHost} set on ${hostResults.success.length} device(s)`);
        }
      }
    }
  }

  // Serve Android APK
  if (apkPath) {
    stepNum++;
    ui.step(stepNum, 'Starting HTTP server...');
    try {
      const server = await startServer({ apkPath, host: ip, appName: applicationId, port: serverPort });
      shutdown.httpServer = server;
      ui.success(`HTTP server listening on port ${serverPort}`);
    } catch (err) {
      ui.warn(`HTTP server failed: ${err.message}`);
    }
  }

  // Install iOS on simulator
  if (iosAppPath && iosSimulator) {
    const { installOnSimulator } = require('./ios-builder');
    try {
      installOnSimulator(iosAppPath, iosSimulator.udid, iosBundleId);
      ui.success(`iOS launched on ${iosSimulator.name}`);
    } catch (err) {
      ui.warn(`iOS install failed: ${err.message}`);
    }
  }

  // QR code for Android
  if (apkPath && shutdown.httpServer) {
    stepNum++;
    ui.step(stepNum, 'Generating QR code...');
    const downloadUrl = buildUrl(ip, serverPort);
    ui.qrSection(downloadUrl);
    displayQR(downloadUrl);
    ui.ready(downloadUrl, options.watch, `${ip}:${metroPort}`);
  } else if (!apkPath && iosAppPath) {
    console.log('');
    console.log(`  ${ui.c.bold}${ui.c.green}🚀 Launched!${ui.c.reset}`);
    console.log(`  ${ui.c.dim}iOS running on simulator. Edit code → Fast Refresh.${ui.c.reset}`);
    console.log(`  ${ui.c.dim}Press Ctrl+C to stop${ui.c.reset}`);
    console.log('');
  }

  // Metro (shared)
  ui.metroStart();
  const metro = startMetro(metroPort);
  shutdown.metroProcess = metro;

  metro.on('exit', (code) => {
    if (code !== null && code !== 0) {
      ui.error('Metro crashed', `Exit code ${code}`);
      process.exit(1);
    }
  });

  // Watch mode
  if (options.watch && hasAndroid && applicationId) {
    startWatchMode({ bundlerHost: ip, metroPort, serverPort });
  }

  // Interactive keyboard shortcuts
  const { startInteractive } = require('./interactive');
  startInteractive({ ip, apkPath, onQuit: gracefulShutdown });
}

module.exports = { run, shutdown, startWatchMode };
