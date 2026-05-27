'use strict';

const fs = require('fs');
const path = require('path');
const { validateProject, parseApplicationId, buildApk } = require('./apk-builder');
const { getLocalIP } = require('./network');
const { startServer, buildUrl } = require('./server');
const { displayQR } = require('./qr');
const { startMetro } = require('./metro');
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
    const startTime = Date.now();
    try {
      await buildApk({ bundlerHost: options.bundlerHost });
      ui.watchRebuildSuccess(Date.now() - startTime);
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
 */
async function run(options) {
  process.on('SIGINT', gracefulShutdown);

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

  let apkPath = null;
  let iosAppPath = null;
  let iosSimulator = null;
  let iosBundleId = null;
  let applicationId = null;
  const buildPromises = [];
  let stepNum = 2;

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
      ui.step(stepNum, 'Building Android APK...');
      ui.buildStart(ip);
      const t0 = Date.now();
      buildPromises.push(
        buildApk({ bundlerHost: ip }).then((result) => {
          apkPath = result;
          ui.buildSuccess(apkPath, Date.now() - t0);
        }).catch((err) => {
          ui.buildFailed(`Android: ${err.message}`);
        })
      );
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
        const t0 = Date.now();
        buildPromises.push(
          buildIos({ bundlerHost: ip, simulator: iosSimulator.name }).then((result) => {
            iosAppPath = result;
            ui.success(`iOS built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
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

  // Serve Android APK
  if (apkPath) {
    stepNum++;
    ui.step(stepNum, 'Starting HTTP server...');
    try {
      const server = await startServer({ apkPath, host: ip, appName: applicationId });
      shutdown.httpServer = server;
      ui.serverStart();
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
    const downloadUrl = buildUrl(ip, 8888);
    ui.qrSection(downloadUrl);
    displayQR(downloadUrl);
    ui.ready(downloadUrl, options.watch, `${ip}:8081`);
  } else if (!apkPath && iosAppPath) {
    console.log('');
    console.log(`  ${ui.c.bold}${ui.c.green}🚀 Launched!${ui.c.reset}`);
    console.log(`  ${ui.c.dim}iOS running on simulator. Edit code → Fast Refresh.${ui.c.reset}`);
    console.log(`  ${ui.c.dim}Press Ctrl+C to stop${ui.c.reset}`);
    console.log('');
  }

  // Metro (shared)
  ui.metroStart();
  const metro = startMetro();
  shutdown.metroProcess = metro;

  metro.on('exit', (code) => {
    if (code !== null && code !== 0) {
      ui.error('Metro crashed', `Exit code ${code}`);
      process.exit(1);
    }
  });

  // Watch mode
  if (options.watch && hasAndroid && applicationId) {
    startWatchMode({ bundlerHost: ip });
  }

  // Interactive keyboard shortcuts
  const { startInteractive } = require('./interactive');
  startInteractive({ ip, apkPath, onQuit: gracefulShutdown });
}

module.exports = { run, shutdown, startWatchMode };
