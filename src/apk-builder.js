'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Validates that the current directory is a React Native CLI project
 * by checking for required Android project structure.
 *
 * @throws {Error} If android/ directory or build.gradle is missing
 */
function validateProject() {
  const androidDir = path.resolve('android');
  if (!fs.existsSync(androidDir)) {
    throw new Error(
      'android/ directory not found in current directory\n' +
      '  Make sure you are running rn-dev-qr from the root of a React Native CLI project.'
    );
  }

  const buildGradle = path.resolve('android', 'app', 'build.gradle');
  if (!fs.existsSync(buildGradle)) {
    throw new Error(
      'android/app/build.gradle not found\n' +
      '  Make sure the Gradle build file exists in your project.'
    );
  }
}

/**
 * Validates that an applicationId conforms to the Android package name format.
 * Must be dot-separated segments where each segment starts with a lowercase letter
 * and contains only lowercase letters, digits, or underscores. Must have at least 2 segments.
 *
 * @param {string} id - The applicationId to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidApplicationId(id) {
  if (typeof id !== 'string') {
    return false;
  }
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id);
}

/**
 * Reads and parses the applicationId from android/app/build.gradle.
 * Handles both single and double quote styles.
 * If multiple matches exist, uses the first one found.
 *
 * @returns {string} The parsed applicationId
 * @throws {Error} If applicationId cannot be found or is invalid
 */
function parseApplicationId() {
  const buildGradlePath = path.resolve('android', 'app', 'build.gradle');
  const content = fs.readFileSync(buildGradlePath, 'utf8');

  // Match applicationId with either single or double quotes
  const regex = /applicationId\s+["']([^"']+)["']/;
  const match = content.match(regex);

  if (!match) {
    throw new Error(
      'applicationId not found in android/app/build.gradle\n' +
      '  Make sure your build.gradle contains an applicationId in the defaultConfig block.'
    );
  }

  const applicationId = match[1];

  if (!isValidApplicationId(applicationId)) {
    throw new Error(
      'applicationId not found in android/app/build.gradle\n' +
      '  Make sure your build.gradle contains an applicationId in the defaultConfig block.'
    );
  }

  return applicationId;
}

/**
 * Executes ./gradlew assembleDebug with bundler URL configuration.
 * @param {Object} options
 * @param {string} options.bundlerHost - The detected local IP address
 * @returns {Promise<string>} Absolute path to the built APK file
 * @throws {Error} If build fails or APK not found
 */
async function buildApk({ bundlerHost }) {
  const gradlewPath = path.resolve('android', 'gradlew');

  // Check that gradlew exists and is executable
  try {
    fs.accessSync(gradlewPath, fs.constants.X_OK);
  } catch {
    throw new Error(
      'Gradle wrapper (gradlew) not found or not executable in android/ directory\n' +
      "  Run 'chmod +x android/gradlew' or ensure the Gradle wrapper is present."
    );
  }

  const androidDir = path.resolve('android');

  return new Promise((resolve, reject) => {
    const child = spawn('./gradlew', ['assembleDebug', '--console=plain', '-q'], {
      cwd: androidDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        REACT_NATIVE_PACKAGER_HOSTNAME: bundlerHost,
      },
    });

    // Collect stderr for error reporting, but don't spam terminal
    let stderrOutput = '';
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let lastTask = '';

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        // Extract task name for progress display
        const taskMatch = line.match(/^> Task :(.+)/);
        if (taskMatch) {
          lastTask = taskMatch[1].split(' ')[0];
          spinnerIdx = (spinnerIdx + 1) % spinner.length;
          process.stdout.write(`\r  ${spinner[spinnerIdx]}  ${lastTask.substring(0, 48).padEnd(48)}`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    child.on('error', (err) => {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
      reject(new Error(`Failed to start Gradle build: ${err.message}`));
    });

    child.on('close', (code) => {
      // Clear the spinner line
      process.stdout.write('\r' + ' '.repeat(60) + '\r');

      if (code !== 0) {
        // Show last 20 lines of stderr on failure
        const errorLines = stderrOutput.trim().split('\n').slice(-20).join('\n');
        reject(new Error(`Gradle build failed (exit code ${code}):\n${errorLines}`));
        return;
      }

      const apkPath = path.resolve('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

      if (!fs.existsSync(apkPath)) {
        reject(new Error(
          `APK file not found at expected path: android/app/build/outputs/apk/debug/app-debug.apk\n` +
          '  The build may have produced the APK in a different location.'
        ));
        return;
      }

      resolve(apkPath);
    });
  });
}

module.exports = { validateProject, parseApplicationId, isValidApplicationId, buildApk };
