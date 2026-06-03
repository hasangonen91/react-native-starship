'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateProject, parseApplicationId } = require('./apk-builder');
const { createBuildTimer } = require('./build-timer');
const ui = require('./ui');

/**
 * Builds APK (debug or release).
 * @param {Object} options
 * @param {boolean} options.release - Build release variant
 * @param {string} [options.output] - Output directory
 * @returns {Promise<string>} Path to built APK
 */
async function buildApkCommand(options = {}) {
  const variant = options.release ? 'Release' : 'Debug';
  const task = `assemble${variant}`;

  ui.banner();
  console.log(`  ${ui.c.bold}Building APK (${variant.toLowerCase()})...${ui.c.reset}`);
  console.log('');

  // Validate project
  validateProject();
  const applicationId = parseApplicationId();
  ui.success(`Package: ${applicationId}`);

  const gradlewPath = path.resolve('android', 'gradlew');
  try {
    fs.accessSync(gradlewPath, fs.constants.X_OK);
  } catch {
    throw new Error(
      'Gradle wrapper (gradlew) not found or not executable.\n' +
      "  Run 'chmod +x android/gradlew'"
    );
  }

  const timer = createBuildTimer('android');
  timer.start();

  const androidDir = path.resolve('android');

  return new Promise((resolve, reject) => {
    const child = spawn('./gradlew', [task, '--console=plain'], {
      cwd: androidDir,
      stdio: 'pipe',
    });

    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let stderrOutput = '';

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        const taskMatch = line.match(/^> Task :(.+)/);
        if (taskMatch) {
          const taskName = taskMatch[1].split(' ')[0];
          spinnerIdx = (spinnerIdx + 1) % spinner.length;
          process.stdout.write(`\r  ${spinner[spinnerIdx]}  ${taskName.substring(0, 50).padEnd(50)}`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    child.on('error', (err) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      reject(new Error(`Failed to start Gradle: ${err.message}`));
    });

    child.on('close', (code) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');

      if (code !== 0) {
        const errorLines = stderrOutput.trim().split('\n').slice(-20).join('\n');
        reject(new Error(`Gradle build failed (exit code ${code}):\n${errorLines}`));
        return;
      }

      timer.stop();
      timer.save();

      const variantLower = variant.toLowerCase();
      const apkPath = path.resolve('android', 'app', 'build', 'outputs', 'apk', variantLower, `app-${variantLower}.apk`);

      if (!fs.existsSync(apkPath)) {
        reject(new Error(`APK not found at: ${apkPath}`));
        return;
      }

      // Copy to output if specified
      let finalPath = apkPath;
      if (options.output) {
        const outputDir = path.resolve(options.output);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `${applicationId}-${variantLower}-${timestamp}.apk`;
        finalPath = path.join(outputDir, filename);
        fs.copyFileSync(apkPath, finalPath);
      }

      const stats = fs.statSync(finalPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

      console.log('');
      ui.success(`APK built successfully`);
      console.log(`  ${ui.c.dim}Path: ${finalPath}${ui.c.reset}`);
      console.log(`  ${ui.c.dim}Size: ${sizeMB} MB | Time: ${timer.formatted()}${ui.c.reset}`);
      console.log('');

      resolve(finalPath);
    });
  });
}

/**
 * Builds AAB (Android App Bundle) for Play Store.
 * @param {Object} options
 * @param {string} [options.output] - Output directory
 * @returns {Promise<string>} Path to built AAB
 */
async function buildAabCommand(options = {}) {
  ui.banner();
  console.log(`  ${ui.c.bold}Building AAB (Android App Bundle)...${ui.c.reset}`);
  console.log('');

  validateProject();
  const applicationId = parseApplicationId();
  ui.success(`Package: ${applicationId}`);

  const gradlewPath = path.resolve('android', 'gradlew');
  try {
    fs.accessSync(gradlewPath, fs.constants.X_OK);
  } catch {
    throw new Error(
      'Gradle wrapper (gradlew) not found or not executable.\n' +
      "  Run 'chmod +x android/gradlew'"
    );
  }

  const timer = createBuildTimer('android');
  timer.start();

  const androidDir = path.resolve('android');

  return new Promise((resolve, reject) => {
    const child = spawn('./gradlew', ['bundleRelease', '--console=plain'], {
      cwd: androidDir,
      stdio: 'pipe',
    });

    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let stderrOutput = '';

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        const taskMatch = line.match(/^> Task :(.+)/);
        if (taskMatch) {
          const taskName = taskMatch[1].split(' ')[0];
          spinnerIdx = (spinnerIdx + 1) % spinner.length;
          process.stdout.write(`\r  ${spinner[spinnerIdx]}  ${taskName.substring(0, 50).padEnd(50)}`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    child.on('error', (err) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      reject(new Error(`Failed to start Gradle: ${err.message}`));
    });

    child.on('close', (code) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');

      if (code !== 0) {
        const errorLines = stderrOutput.trim().split('\n').slice(-20).join('\n');
        reject(new Error(`Gradle build failed (exit code ${code}):\n${errorLines}`));
        return;
      }

      timer.stop();
      timer.save();

      const aabPath = path.resolve('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');

      if (!fs.existsSync(aabPath)) {
        reject(new Error(`AAB not found at: ${aabPath}\n  Make sure signing config is set in build.gradle`));
        return;
      }

      let finalPath = aabPath;
      if (options.output) {
        const outputDir = path.resolve(options.output);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `${applicationId}-release-${timestamp}.aab`;
        finalPath = path.join(outputDir, filename);
        fs.copyFileSync(aabPath, finalPath);
      }

      const stats = fs.statSync(finalPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

      console.log('');
      ui.success(`AAB built successfully`);
      console.log(`  ${ui.c.dim}Path: ${finalPath}${ui.c.reset}`);
      console.log(`  ${ui.c.dim}Size: ${sizeMB} MB | Time: ${timer.formatted()}${ui.c.reset}`);
      console.log(`  ${ui.c.dim}Ready for Play Store upload${ui.c.reset}`);
      console.log('');

      resolve(finalPath);
    });
  });
}

/**
 * Builds IPA for iOS distribution.
 * @param {Object} options
 * @param {string} [options.export] - Export method (development, ad-hoc, app-store, enterprise)
 * @param {string} [options.output] - Output directory
 * @returns {Promise<string>} Path to built IPA
 */
async function buildIpaCommand(options = {}) {
  const exportMethod = options.export || 'development';

  ui.banner();
  console.log(`  ${ui.c.bold}Building IPA (${exportMethod})...${ui.c.reset}`);
  console.log('');

  // Validate iOS project
  const iosDir = path.resolve('ios');
  if (!fs.existsSync(iosDir)) {
    throw new Error('ios/ directory not found');
  }

  const { findXcworkspace, getScheme, getBundleId } = require('./ios-builder');
  const workspace = findXcworkspace();
  if (!workspace) {
    throw new Error('No .xcworkspace found. Run "cd ios && pod install" first.');
  }

  const scheme = getScheme();
  const bundleId = getBundleId();
  ui.success(`Scheme: ${scheme} (${bundleId})`);

  const timer = createBuildTimer('ios');
  timer.start();

  const archivePath = path.resolve('ios', 'build', `${scheme}.xcarchive`);
  const exportPath = path.resolve('ios', 'build', 'export');

  // Step 1: Archive
  console.log(`  ${ui.c.dim}Archiving...${ui.c.reset}`);

  await new Promise((resolve, reject) => {
    const args = [
      '-workspace', path.join(iosDir, workspace),
      '-scheme', scheme,
      '-configuration', 'Release',
      '-archivePath', archivePath,
      'archive',
    ];

    const child = spawn('xcodebuild', args, { stdio: 'pipe' });

    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let stderrOutput = '';

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const phaseMatch = line.match(/^(Compile|Link|Copy|Process|Sign|Build|Archive)\w*/);
        if (phaseMatch) {
          spinnerIdx = (spinnerIdx + 1) % spinner.length;
          process.stdout.write(`\r  ${spinner[spinnerIdx]}  ${phaseMatch[0].substring(0, 50).padEnd(50)}`);
        }
      }
    });

    child.stderr.on('data', (data) => { stderrOutput += data.toString(); });

    child.on('close', (code) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      if (code !== 0) {
        const errors = stderrOutput.split('\n').filter(l => l.includes('error:')).slice(-5).join('\n');
        reject(new Error(`Archive failed (exit code ${code}):\n${errors || 'Check Xcode for details'}`));
      } else {
        ui.success('Archive created');
        resolve();
      }
    });
  });

  // Step 2: Create export options plist
  const exportOptionsPlist = path.resolve('ios', 'build', 'ExportOptions.plist');
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>${exportMethod}</string>
    <key>compileBitcode</key>
    <false/>
    <key>stripSwiftSymbols</key>
    <true/>
</dict>
</plist>`;

  const exportDir = path.dirname(exportOptionsPlist);
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
  fs.writeFileSync(exportOptionsPlist, plistContent);

  // Step 3: Export IPA
  console.log(`  ${ui.c.dim}Exporting IPA (${exportMethod})...${ui.c.reset}`);

  await new Promise((resolve, reject) => {
    const args = [
      '-exportArchive',
      '-archivePath', archivePath,
      '-exportOptionsPlist', exportOptionsPlist,
      '-exportPath', exportPath,
    ];

    const child = spawn('xcodebuild', args, { stdio: 'pipe' });
    let stderrOutput = '';

    child.stderr.on('data', (data) => { stderrOutput += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        const errors = stderrOutput.split('\n').filter(l => l.includes('error:')).slice(-5).join('\n');
        reject(new Error(`Export failed (exit code ${code}):\n${errors || 'Check signing config'}`));
      } else {
        resolve();
      }
    });
  });

  timer.stop();
  timer.save();

  // Find the IPA
  const exportedFiles = fs.readdirSync(exportPath);
  const ipaFile = exportedFiles.find(f => f.endsWith('.ipa'));

  if (!ipaFile) {
    throw new Error(`IPA not found in ${exportPath}`);
  }

  let finalPath = path.join(exportPath, ipaFile);

  if (options.output) {
    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `${scheme}-${exportMethod}-${timestamp}.ipa`;
    finalPath = path.join(outputDir, filename);
    fs.copyFileSync(path.join(exportPath, ipaFile), finalPath);
  }

  const stats = fs.statSync(finalPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

  console.log('');
  ui.success(`IPA built successfully`);
  console.log(`  ${ui.c.dim}Path: ${finalPath}${ui.c.reset}`);
  console.log(`  ${ui.c.dim}Size: ${sizeMB} MB | Time: ${timer.formatted()}${ui.c.reset}`);
  console.log(`  ${ui.c.dim}Export: ${exportMethod}${ui.c.reset}`);
  console.log('');

  // Cleanup
  try { fs.unlinkSync(exportOptionsPlist); } catch {}

  return finalPath;
}

module.exports = { buildApkCommand, buildAabCommand, buildIpaCommand };
