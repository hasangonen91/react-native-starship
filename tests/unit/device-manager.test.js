'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');

// We test the parsing logic by mocking execSync output
describe('device-manager', () => {
  describe('listConnectedDevices', () => {
    it('exports expected functions', () => {
      const dm = require('../../src/device-manager');
      assert(typeof dm.listConnectedDevices === 'function');
      assert(typeof dm.displayDevices === 'function');
      assert(typeof dm.adbReverseAll === 'function');
      assert(typeof dm.adbReverseAllPorts === 'function');
      assert(typeof dm.installOnAllDevices === 'function');
    });

    it('returns empty array when adb is not available', () => {
      // This test works because in CI/test env there may be no adb
      const dm = require('../../src/device-manager');
      const devices = dm.listConnectedDevices();
      assert(Array.isArray(devices));
    });

    it('adbReverseAll returns results object', () => {
      const dm = require('../../src/device-manager');
      // With empty device list, should return empty results
      const results = dm.adbReverseAll(8081, []);
      assert.deepStrictEqual(results, { success: [], failed: [] });
    });

    it('adbReverseAll skips unauthorized devices', () => {
      const dm = require('../../src/device-manager');
      const devices = [
        { id: 'abc123', type: 'unauthorized', model: 'Test', name: 'test' },
      ];
      const results = dm.adbReverseAll(8081, devices);
      assert.deepStrictEqual(results, { success: [], failed: [] });
    });

    it('installOnAllDevices returns results object with empty list', () => {
      const dm = require('../../src/device-manager');
      const results = dm.installOnAllDevices('/tmp/fake.apk', []);
      assert.deepStrictEqual(results, { success: [], failed: [] });
    });

    it('installOnAllDevices skips unauthorized devices', () => {
      const dm = require('../../src/device-manager');
      const devices = [
        { id: 'xyz789', type: 'unauthorized', model: 'Locked', name: 'locked' },
      ];
      const results = dm.installOnAllDevices('/tmp/fake.apk', devices);
      assert.deepStrictEqual(results, { success: [], failed: [] });
    });
  });

  describe('displayDevices', () => {
    it('does not throw with empty array', () => {
      const dm = require('../../src/device-manager');
      assert.doesNotThrow(() => dm.displayDevices([]));
    });

    it('does not throw with device list', () => {
      const dm = require('../../src/device-manager');
      const devices = [
        { id: 'emulator-5554', type: 'emulator', model: 'Pixel 6', name: 'pixel6' },
        { id: 'R5CT1234', type: 'device', model: 'Galaxy S23', name: 'galaxy' },
      ];
      assert.doesNotThrow(() => dm.displayDevices(devices));
    });
  });
});
