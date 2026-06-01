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
 * Injects a temporary ContentProvider that auto-sets the debug server host
 * so the app connects to Metro without manual configuration.
 * @param {Object} options
 * @param {string} options.bundlerHost - The detected local IP address
 * @param {number} [options.metroPort] - Metro port (default: 8081)
 * @returns {Promise<string>} Absolute path to the built APK file
 * @throws {Error} If build fails or APK not found
 */
async function buildApk({ bundlerHost, metroPort, serverPort }) {
  const gradlewPath = path.resolve('android', 'gradlew');
  const port = metroPort || 8081;
  const sPort = serverPort || 8888;
  const devHost = `${bundlerHost}:${port}`;

  // Check that gradlew exists and is executable
  try {
    fs.accessSync(gradlewPath, fs.constants.X_OK);
  } catch {
    throw new Error(
      'Gradle wrapper (gradlew) not found or not executable in android/ directory\n' +
      "  Run 'chmod +x android/gradlew' or ensure the Gradle wrapper is present."
    );
  }

  // --- Inject StarshipDevHostInitializer ---
  const injectedFiles = injectDevHostInitializer(devHost, sPort);

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
      cleanupInjectedFiles(injectedFiles);
      reject(new Error(`Failed to start Gradle build: ${err.message}`));
    });

    child.on('close', (code) => {
      // Clear the spinner line
      process.stdout.write('\r' + ' '.repeat(60) + '\r');

      // Clean up injected files
      cleanupInjectedFiles(injectedFiles);

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

/**
 * Injects a ContentProvider into the debug build that auto-sets the Metro host.
 * This allows the app to connect to Metro without manual Dev Settings configuration.
 * @param {string} devHost - The host:port string (e.g., "192.168.1.100:8081")
 * @returns {string[]} List of injected file paths (for cleanup)
 */
function injectDevHostInitializer(devHost, serverPort) {
  const injectedFiles = [];

  // 1. Create the Java source file
  const javaDir = path.resolve('android', 'app', 'src', 'debug', 'java', 'com', 'starship');
  fs.mkdirSync(javaDir, { recursive: true });

  const javaFile = path.join(javaDir, 'StarshipDevHostProvider.java');
  const serverHost = devHost.split(':')[0];
  const sPort = String(serverPort || 8888);
  const javaContent = `package com.starship;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.preference.PreferenceManager;

/**
 * Auto-generated by Starship. Sets the debug server host on app startup
 * and reports device info back to the dev server.
 *
 * SAFETY: This class only runs in debug builds (src/debug/ source set).
 * It is never included in release/production APKs.
 * Additionally, it checks the debuggable flag at runtime as a safeguard.
 */
public class StarshipDevHostProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        Context ctx = getContext();
        if (ctx == null) return true;

        // SAFETY: Never run in production — double-check debuggable flag
        boolean isDebuggable = (ctx.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!isDebuggable) return true;

        PreferenceManager.getDefaultSharedPreferences(ctx)
            .edit()
            .putString("debug_http_host", "${devHost}")
            .apply();

        // Report device info to Starship server in background
        new Thread(() -> {
            try {
                String model = Build.MODEL;
                String brand = Build.BRAND;
                String os = "Android " + Build.VERSION.RELEASE;
                String displayName = brand.substring(0, 1).toUpperCase() + brand.substring(1) + " " + model;
                String json = "{\\"model\\":\\"" + displayName + "\\",\\"platform\\":\\"Android\\",\\"os\\":\\"" + os + "\\"}";

                java.net.URL url = new java.net.URL("http://${serverHost}:${sPort}/device-info");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                conn.getOutputStream().write(json.getBytes());
                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception e) {
                // Silent fail — dev server may not be running
            }
        }).start();

        return true;
    }

    @Override public Cursor query(Uri u, String[] p, String s, String[] a, String o) { return null; }
    @Override public String getType(Uri u) { return null; }
    @Override public Uri insert(Uri u, ContentValues v) { return null; }
    @Override public int delete(Uri u, String s, String[] a) { return 0; }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
`;
  fs.writeFileSync(javaFile, javaContent);
  injectedFiles.push(javaFile);
  // Track the created directories for cleanup
  injectedFiles.push(javaDir);
  injectedFiles.push(path.resolve('android', 'app', 'src', 'debug', 'java', 'com', 'starship'));

  // 2. Create/update the debug AndroidManifest.xml to register the provider
  const manifestDir = path.resolve('android', 'app', 'src', 'debug');
  const manifestFile = path.join(manifestDir, 'AndroidManifest.xml');

  let existingManifest = null;
  if (fs.existsSync(manifestFile)) {
    existingManifest = fs.readFileSync(manifestFile, 'utf8');
  }

  // Check if provider is already registered (from a previous failed cleanup)
  const providerTag = '<provider android:name="com.starship.StarshipDevHostProvider"';
  if (existingManifest && existingManifest.includes(providerTag)) {
    // Already there, no need to modify
    return injectedFiles;
  }

  const manifestContent = existingManifest
    ? addProviderToManifest(existingManifest)
    : createDebugManifest();

  fs.writeFileSync(manifestFile, manifestContent);
  if (!existingManifest) {
    injectedFiles.push(manifestFile);
  } else {
    // Store original for restoration
    injectedFiles.push({ path: manifestFile, original: existingManifest });
  }

  return injectedFiles;
}

/**
 * Creates a minimal debug AndroidManifest.xml with the StarshipDevHostProvider.
 */
function createDebugManifest() {
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application>
        <provider
            android:name="com.starship.StarshipDevHostProvider"
            android:authorities="\${applicationId}.starship_dev_host_init"
            android:exported="false"
            android:initOrder="9999" />
    </application>
</manifest>
`;
}

/**
 * Adds the StarshipDevHostProvider to an existing AndroidManifest.xml.
 */
function addProviderToManifest(manifest) {
  const providerXml = `
        <provider
            android:name="com.starship.StarshipDevHostProvider"
            android:authorities="\${applicationId}.starship_dev_host_init"
            android:exported="false"
            android:initOrder="9999" />`;

  if (manifest.includes('<application')) {
    // Add inside existing <application> tag
    if (manifest.includes('</application>')) {
      return manifest.replace('</application>', `${providerXml}\n    </application>`);
    } else {
      // Self-closing or other format — wrap
      return manifest.replace(/<application([^>]*)\/>/, `<application$1>${providerXml}\n    </application>`);
    }
  } else {
    // No application tag — add one
    return manifest.replace('</manifest>', `    <application>${providerXml}\n    </application>\n</manifest>`);
  }
}

/**
 * Cleans up injected files after build.
 * @param {Array} injectedFiles
 */
function cleanupInjectedFiles(injectedFiles) {
  for (const item of injectedFiles.reverse()) {
    try {
      if (typeof item === 'string') {
        if (fs.existsSync(item)) {
          const stat = fs.statSync(item);
          if (stat.isDirectory()) {
            // Only remove if empty or only contains our files
            const files = fs.readdirSync(item);
            if (files.length === 0) {
              fs.rmdirSync(item);
            }
          } else {
            fs.unlinkSync(item);
          }
        }
      } else if (item && item.path && item.original !== undefined) {
        // Restore original file content
        fs.writeFileSync(item.path, item.original);
      }
    } catch {
      // Best effort cleanup
    }
  }

  // Clean up the com/starship directory tree if empty
  const starshipDir = path.resolve('android', 'app', 'src', 'debug', 'java', 'com', 'starship');
  try {
    if (fs.existsSync(starshipDir) && fs.readdirSync(starshipDir).length === 0) {
      fs.rmdirSync(starshipDir);
    }
  } catch {}
}

module.exports = { validateProject, parseApplicationId, isValidApplicationId, buildApk };
