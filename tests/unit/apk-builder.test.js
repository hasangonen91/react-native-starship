'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { validateProject, parseApplicationId, isValidApplicationId, buildApk } = require('../../src/apk-builder');

describe('isValidApplicationId', () => {
  it('accepts a valid two-segment package name', () => {
    assert.strictEqual(isValidApplicationId('com.example'), true);
  });

  it('accepts a valid three-segment package name', () => {
    assert.strictEqual(isValidApplicationId('com.example.myapp'), true);
  });

  it('accepts segments with digits and underscores', () => {
    assert.strictEqual(isValidApplicationId('com.my_app2.test3'), true);
  });

  it('rejects a single segment (no dots)', () => {
    assert.strictEqual(isValidApplicationId('myapp'), false);
  });

  it('rejects segments starting with a digit', () => {
    assert.strictEqual(isValidApplicationId('com.1example'), false);
  });

  it('rejects segments starting with an underscore', () => {
    assert.strictEqual(isValidApplicationId('com._example'), false);
  });

  it('rejects uppercase letters', () => {
    assert.strictEqual(isValidApplicationId('com.Example'), false);
  });

  it('rejects empty string', () => {
    assert.strictEqual(isValidApplicationId(''), false);
  });

  it('rejects non-string input', () => {
    assert.strictEqual(isValidApplicationId(null), false);
    assert.strictEqual(isValidApplicationId(undefined), false);
    assert.strictEqual(isValidApplicationId(123), false);
  });

  it('rejects segments with hyphens', () => {
    assert.strictEqual(isValidApplicationId('com.my-app'), false);
  });

  it('rejects trailing dot', () => {
    assert.strictEqual(isValidApplicationId('com.example.'), false);
  });

  it('rejects leading dot', () => {
    assert.strictEqual(isValidApplicationId('.com.example'), false);
  });

  it('rejects consecutive dots', () => {
    assert.strictEqual(isValidApplicationId('com..example'), false);
  });
});

describe('validateProject', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-dev-qr-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws when android/ directory does not exist', () => {
    assert.throws(
      () => validateProject(),
      (err) => {
        assert(err.message.includes('android/ directory not found'));
        assert(err.message.includes('React Native CLI project'));
        return true;
      }
    );
  });

  it('throws when android/app/build.gradle does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, 'android', 'app'), { recursive: true });
    assert.throws(
      () => validateProject(),
      (err) => {
        assert(err.message.includes('android/app/build.gradle not found'));
        assert(err.message.includes('Gradle build file'));
        return true;
      }
    );
  });

  it('does not throw when both android/ and build.gradle exist', () => {
    fs.mkdirSync(path.join(tmpDir, 'android', 'app'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), '');
    assert.doesNotThrow(() => validateProject());
  });
});

describe('parseApplicationId', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-dev-qr-test-'));
    fs.mkdirSync(path.join(tmpDir, 'android', 'app'), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses applicationId with double quotes', () => {
    const content = `
android {
    defaultConfig {
        applicationId "com.example.myapp"
        minSdkVersion 21
    }
}`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), content);
    assert.strictEqual(parseApplicationId(), 'com.example.myapp');
  });

  it('parses applicationId with single quotes', () => {
    const content = `
android {
    defaultConfig {
        applicationId 'com.example.myapp'
        minSdkVersion 21
    }
}`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), content);
    assert.strictEqual(parseApplicationId(), 'com.example.myapp');
  });

  it('handles extra whitespace between applicationId and value', () => {
    const content = `applicationId   "com.test.app"`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), content);
    assert.strictEqual(parseApplicationId(), 'com.test.app');
  });

  it('uses the first match when multiple applicationId declarations exist', () => {
    const content = `
android {
    defaultConfig {
        applicationId "com.first.app"
    }
    productFlavors {
        staging {
            applicationId "com.second.app"
        }
    }
}`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), content);
    assert.strictEqual(parseApplicationId(), 'com.first.app');
  });

  it('throws when applicationId is not found', () => {
    const content = `
android {
    defaultConfig {
        minSdkVersion 21
    }
}`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), content);
    assert.throws(
      () => parseApplicationId(),
      (err) => {
        assert(err.message.includes('applicationId not found'));
        assert(err.message.includes('defaultConfig block'));
        return true;
      }
    );
  });

  it('throws when applicationId has invalid format', () => {
    const content = `applicationId "InvalidPackage"`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), content);
    assert.throws(
      () => parseApplicationId(),
      (err) => {
        assert(err.message.includes('applicationId not found'));
        return true;
      }
    );
  });
});

describe('buildApk', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-dev-qr-build-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws when gradlew does not exist', async () => {
    fs.mkdirSync(path.join(tmpDir, 'android'), { recursive: true });

    await assert.rejects(
      () => buildApk({ bundlerHost: '192.168.1.100' }),
      (err) => {
        assert(err.message.includes('Gradle wrapper (gradlew) not found or not executable'));
        assert(err.message.includes("chmod +x android/gradlew"));
        return true;
      }
    );
  });

  it('throws when gradlew is not executable', async () => {
    fs.mkdirSync(path.join(tmpDir, 'android'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'android', 'gradlew'), '#!/bin/sh\nexit 0\n');
    // Do NOT set executable permission
    fs.chmodSync(path.join(tmpDir, 'android', 'gradlew'), 0o644);

    await assert.rejects(
      () => buildApk({ bundlerHost: '192.168.1.100' }),
      (err) => {
        assert(err.message.includes('Gradle wrapper (gradlew) not found or not executable'));
        return true;
      }
    );
  });

  it('rejects when gradle build fails with non-zero exit code', async () => {
    fs.mkdirSync(path.join(tmpDir, 'android'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'android', 'gradlew'), '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(tmpDir, 'android', 'gradlew'), 0o755);

    await assert.rejects(
      () => buildApk({ bundlerHost: '192.168.1.100' }),
      (err) => {
        assert(err.message.includes('Gradle build failed'));
        return true;
      }
    );
  });

  it('rejects when APK file is not found after successful build', async () => {
    fs.mkdirSync(path.join(tmpDir, 'android'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'android', 'gradlew'), '#!/bin/sh\nexit 0\n');
    fs.chmodSync(path.join(tmpDir, 'android', 'gradlew'), 0o755);

    await assert.rejects(
      () => buildApk({ bundlerHost: '192.168.1.100' }),
      (err) => {
        assert(err.message.includes('APK file not found at expected path'));
        assert(err.message.includes('different location'));
        return true;
      }
    );
  });

  it('resolves with APK path when build succeeds and APK exists', async () => {
    fs.mkdirSync(path.join(tmpDir, 'android'), { recursive: true });
    // Create a gradlew script that creates the APK file
    const apkDir = path.join(tmpDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
    const script = `#!/bin/sh\nmkdir -p "${apkDir}"\ntouch "${apkDir}/app-debug.apk"\nexit 0\n`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'gradlew'), script);
    fs.chmodSync(path.join(tmpDir, 'android', 'gradlew'), 0o755);

    const result = await buildApk({ bundlerHost: '192.168.1.50' });
    const expectedPath = path.resolve('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    assert.strictEqual(result, expectedPath);
  });

  it('passes REACT_NATIVE_PACKAGER_HOSTNAME to the build process', async () => {
    fs.mkdirSync(path.join(tmpDir, 'android'), { recursive: true });
    const apkDir = path.join(tmpDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
    // Script that writes the env var to a file so we can verify it
    const envFile = path.join(tmpDir, 'env_check.txt');
    const script = `#!/bin/sh\necho "$REACT_NATIVE_PACKAGER_HOSTNAME" > "${envFile}"\nmkdir -p "${apkDir}"\ntouch "${apkDir}/app-debug.apk"\nexit 0\n`;
    fs.writeFileSync(path.join(tmpDir, 'android', 'gradlew'), script);
    fs.chmodSync(path.join(tmpDir, 'android', 'gradlew'), 0o755);

    await buildApk({ bundlerHost: '10.0.0.42' });
    const envValue = fs.readFileSync(envFile, 'utf8').trim();
    assert.strictEqual(envValue, '10.0.0.42');
  });
});
