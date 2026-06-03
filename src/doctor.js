'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ui = require('./ui');

/**
 * Runs diagnostic checks on the development environment.
 */
async function runDoctor() {
  ui.banner();
  console.log(`  ${ui.c.bold}Starship Doctor${ui.c.reset}`);
  console.log(`  ${ui.c.dim}Checking your environment...${ui.c.reset}`);
  console.log('');

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  // Node.js
  const nodeResult = checkNode();
  if (nodeResult.ok) passed++; else failed++;

  // npm/yarn
  const pmResult = checkPackageManager();
  if (pmResult.ok) passed++; else if (pmResult.warn) warnings++; else failed++;

  // Android SDK
  console.log('');
  console.log(`  ${ui.c.bold}Android:${ui.c.reset}`);
  const androidChecks = checkAndroid();
  for (const check of androidChecks) {
    if (check.ok) passed++; else if (check.warn) warnings++; else failed++;
  }

  // iOS (macOS only)
  console.log('');
  console.log(`  ${ui.c.bold}iOS:${ui.c.reset}`);
  const iosChecks = checkIos();
  for (const check of iosChecks) {
    if (check.ok) passed++; else if (check.warn) warnings++; else failed++;
  }

  // Project structure
  console.log('');
  console.log(`  ${ui.c.bold}Project:${ui.c.reset}`);
  const projectChecks = checkProject();
  for (const check of projectChecks) {
    if (check.ok) passed++; else if (check.warn) warnings++; else failed++;
  }

  // Metro config
  console.log('');
  console.log(`  ${ui.c.bold}Metro:${ui.c.reset}`);
  const metroChecks = checkMetro();
  for (const check of metroChecks) {
    if (check.ok) passed++; else if (check.warn) warnings++; else failed++;
  }

  // GitHub CLI (for cloud builds)
  console.log('');
  console.log(`  ${ui.c.bold}Cloud:${ui.c.reset}`);
  const cloudChecks = checkCloud();
  for (const check of cloudChecks) {
    if (check.ok) passed++; else if (check.warn) warnings++; else failed++;
  }

  // Summary
  console.log('');
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  ${ui.c.green}✔ ${passed} passed${ui.c.reset}  ${failed > 0 ? `${ui.c.red}✖ ${failed} failed${ui.c.reset}  ` : ''}${warnings > 0 ? `${ui.c.yellow}⚠ ${warnings} warnings${ui.c.reset}` : ''}`);

  if (failed === 0) {
    console.log(`  ${ui.c.green}${ui.c.bold}Environment is ready!${ui.c.reset}`);
  } else {
    console.log(`  ${ui.c.red}Fix the issues above to use Starship.${ui.c.reset}`);
  }
  console.log('');
}

function checkNode() {
  try {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);
    if (major >= 18) {
      console.log(`  ${ui.c.green}✔${ui.c.reset}  Node.js ${version}`);
      return { ok: true };
    } else {
      console.log(`  ${ui.c.red}✖${ui.c.reset}  Node.js ${version} — ${ui.c.dim}need v18+${ui.c.reset}`);
      return { ok: false };
    }
  } catch {
    console.log(`  ${ui.c.red}✖${ui.c.reset}  Node.js not found`);
    return { ok: false };
  }
}

function checkPackageManager() {
  try {
    const yarnVersion = execSync('yarn --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log(`  ${ui.c.green}✔${ui.c.reset}  Yarn ${yarnVersion}`);
    return { ok: true };
  } catch {
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
      console.log(`  ${ui.c.green}✔${ui.c.reset}  npm ${npmVersion}`);
      return { ok: true };
    } catch {
      console.log(`  ${ui.c.red}✖${ui.c.reset}  No package manager found`);
      return { ok: false };
    }
  }
}

function checkAndroid() {
  const results = [];

  // Java/JDK
  try {
    const javaVersion = execSync('java -version 2>&1', { encoding: 'utf8', stdio: 'pipe' });
    const match = javaVersion.match(/version "([^"]+)"/);
    const ver = match ? match[1] : 'detected';
    console.log(`  ${ui.c.green}✔${ui.c.reset}  JDK ${ver}`);
    results.push({ ok: true });
  } catch {
    console.log(`  ${ui.c.red}✖${ui.c.reset}  JDK not found — ${ui.c.dim}install JDK 17+${ui.c.reset}`);
    results.push({ ok: false });
  }

  // ANDROID_HOME
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome && fs.existsSync(androidHome)) {
    console.log(`  ${ui.c.green}✔${ui.c.reset}  ANDROID_HOME: ${ui.c.dim}${androidHome}${ui.c.reset}`);
    results.push({ ok: true });
  } else {
    console.log(`  ${ui.c.red}✖${ui.c.reset}  ANDROID_HOME not set — ${ui.c.dim}set environment variable${ui.c.reset}`);
    results.push({ ok: false });
  }

  // adb
  try {
    const adbVersion = execSync('adb version', { encoding: 'utf8', stdio: 'pipe' }).split('\n')[0];
    console.log(`  ${ui.c.green}✔${ui.c.reset}  ${adbVersion.trim()}`);
    results.push({ ok: true });
  } catch {
    console.log(`  ${ui.c.red}✖${ui.c.reset}  adb not found — ${ui.c.dim}install Android SDK Platform-Tools${ui.c.reset}`);
    results.push({ ok: false });
  }

  // Gradle wrapper
  const gradlew = path.resolve('android', 'gradlew');
  if (fs.existsSync(gradlew)) {
    try {
      fs.accessSync(gradlew, fs.constants.X_OK);
      console.log(`  ${ui.c.green}✔${ui.c.reset}  gradlew (executable)`);
      results.push({ ok: true });
    } catch {
      console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  gradlew exists but not executable — ${ui.c.dim}run: chmod +x android/gradlew${ui.c.reset}`);
      results.push({ warn: true });
    }
  } else if (fs.existsSync(path.resolve('android'))) {
    console.log(`  ${ui.c.red}✖${ui.c.reset}  gradlew not found in android/`);
    results.push({ ok: false });
  }

  return results;
}

function checkIos() {
  const results = [];
  const isMac = process.platform === 'darwin';

  if (!isMac) {
    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  Not macOS — local iOS builds unavailable`);
    console.log(`  ${ui.c.dim}     Use "starship build ipa --cloud" for cloud builds${ui.c.reset}`);
    results.push({ warn: true });
    return results;
  }

  // Xcode
  try {
    const xcodeVersion = execSync('xcodebuild -version', { encoding: 'utf8', stdio: 'pipe' }).split('\n')[0];
    console.log(`  ${ui.c.green}✔${ui.c.reset}  ${xcodeVersion}`);
    results.push({ ok: true });
  } catch {
    console.log(`  ${ui.c.red}✖${ui.c.reset}  Xcode not found — ${ui.c.dim}install from App Store${ui.c.reset}`);
    results.push({ ok: false });
  }

  // CocoaPods
  try {
    const podVersion = execSync('pod --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log(`  ${ui.c.green}✔${ui.c.reset}  CocoaPods ${podVersion}`);
    results.push({ ok: true });
  } catch {
    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  CocoaPods not found — ${ui.c.dim}gem install cocoapods${ui.c.reset}`);
    results.push({ warn: true });
  }

  // iOS simulator
  try {
    const output = execSync('xcrun simctl list devices available -j', { encoding: 'utf8', stdio: 'pipe' });
    const data = JSON.parse(output);
    let count = 0;
    for (const [runtime, devices] of Object.entries(data.devices)) {
      if (runtime.includes('iOS')) count += devices.length;
    }
    if (count > 0) {
      console.log(`  ${ui.c.green}✔${ui.c.reset}  ${count} iOS simulator(s) available`);
      results.push({ ok: true });
    } else {
      console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  No iOS simulators — ${ui.c.dim}download in Xcode → Settings → Platforms${ui.c.reset}`);
      results.push({ warn: true });
    }
  } catch {
    results.push({ warn: true });
  }

  return results;
}

function checkProject() {
  const results = [];

  // package.json
  if (fs.existsSync('package.json')) {
    console.log(`  ${ui.c.green}✔${ui.c.reset}  package.json found`);
    results.push({ ok: true });

    // Check react-native dependency
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const rnVersion = (pkg.dependencies && pkg.dependencies['react-native']) ||
                        (pkg.devDependencies && pkg.devDependencies['react-native']);
      if (rnVersion) {
        console.log(`  ${ui.c.green}✔${ui.c.reset}  react-native: ${rnVersion}`);
        results.push({ ok: true });
      } else {
        console.log(`  ${ui.c.red}✖${ui.c.reset}  react-native not in dependencies`);
        results.push({ ok: false });
      }
    } catch {
      results.push({ ok: false });
    }
  } else {
    console.log(`  ${ui.c.red}✖${ui.c.reset}  package.json not found — are you in a React Native project?`);
    results.push({ ok: false });
  }

  // android/
  if (fs.existsSync('android')) {
    console.log(`  ${ui.c.green}✔${ui.c.reset}  android/ directory`);
    results.push({ ok: true });
  } else {
    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  android/ not found — Android builds unavailable`);
    results.push({ warn: true });
  }

  // ios/
  if (fs.existsSync('ios')) {
    console.log(`  ${ui.c.green}✔${ui.c.reset}  ios/ directory`);
    results.push({ ok: true });
  } else {
    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  ios/ not found — iOS builds unavailable`);
    results.push({ warn: true });
  }

  return results;
}

function checkMetro() {
  const results = [];

  const metroConfig = ['metro.config.js', 'metro.config.ts'].find(f => fs.existsSync(f));
  if (metroConfig) {
    console.log(`  ${ui.c.green}✔${ui.c.reset}  ${metroConfig} found`);
    results.push({ ok: true });

    // Check for watchFolders with symlink validation
    try {
      const content = fs.readFileSync(metroConfig, 'utf8');
      if (content.includes('watchFolders')) {
        // Extract paths and validate
        const pathMatches = content.match(/watchFolders[^[]*\[([^\]]+)\]/s);
        if (pathMatches) {
          const folderStr = pathMatches[1];
          const resolveMatches = folderStr.match(/resolve\([^)]+\)/g) || [];

          let allValid = true;
          for (const match of resolveMatches) {
            const argMatch = match.match(/['"]([^'"]+)['"]/);
            if (argMatch) {
              const folder = path.resolve(argMatch[1]);
              if (fs.existsSync(folder)) {
                // Check if symlink resolves properly
                try {
                  const realPath = fs.realpathSync(folder);
                  if (!fs.existsSync(realPath)) {
                    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  watchFolder symlink broken: ${ui.c.dim}${folder}${ui.c.reset}`);
                    allValid = false;
                  }
                } catch {
                  allValid = false;
                }
              } else {
                console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  watchFolder not found: ${ui.c.dim}${folder}${ui.c.reset}`);
                allValid = false;
              }
            }
          }

          if (allValid) {
            console.log(`  ${ui.c.green}✔${ui.c.reset}  watchFolders configured (paths valid)`);
          }
          results.push(allValid ? { ok: true } : { warn: true });
        }
      }
    } catch {
      // Can't parse metro config — that's okay
    }
  } else {
    console.log(`  ${ui.c.green}✔${ui.c.reset}  No custom metro config (using defaults)`);
    results.push({ ok: true });
  }

  // Check if Metro port is available
  try {
    const net = require('net');
    const server = net.createServer();
    server.listen(8081, '0.0.0.0');
    server.close();
    console.log(`  ${ui.c.green}✔${ui.c.reset}  Port 8081 available`);
    results.push({ ok: true });
  } catch {
    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  Port 8081 in use — ${ui.c.dim}use --port to change${ui.c.reset}`);
    results.push({ warn: true });
  }

  return results;
}

function checkCloud() {
  const results = [];

  // GitHub CLI
  try {
    const ghVersion = execSync('gh --version', { encoding: 'utf8', stdio: 'pipe' }).split('\n')[0];
    console.log(`  ${ui.c.green}✔${ui.c.reset}  ${ghVersion.trim()}`);
    results.push({ ok: true });

    // Check auth
    try {
      execSync('gh auth status', { stdio: 'pipe' });
      console.log(`  ${ui.c.green}✔${ui.c.reset}  GitHub CLI authenticated`);
      results.push({ ok: true });
    } catch {
      console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  GitHub CLI not authenticated — ${ui.c.dim}run: gh auth login${ui.c.reset}`);
      results.push({ warn: true });
    }
  } catch {
    console.log(`  ${ui.c.yellow}⚠${ui.c.reset}  GitHub CLI not installed — ${ui.c.dim}needed for cloud builds (brew install gh)${ui.c.reset}`);
    results.push({ warn: true });
  }

  // Cloud config
  const { isInitialized } = require('./cloud-config');
  if (isInitialized()) {
    console.log(`  ${ui.c.green}✔${ui.c.reset}  Cloud initialized`);
    results.push({ ok: true });
  } else {
    console.log(`  ${ui.c.dim}  ○  Cloud not initialized (run: starship cloud init)${ui.c.reset}`);
    results.push({ warn: true });
  }

  return results;
}

module.exports = { runDoctor };
