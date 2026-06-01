'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs } = require('../../src/cli-parser');

describe('CLI argument parsing', () => {
  it('parses default options', () => {
    const { options, unknown } = parseArgs(['node', 'starship']);
    assert.strictEqual(options.port, 8081);
    assert.strictEqual(options.serverPort, 8888);
    assert.strictEqual(options.watch, false);
    assert.strictEqual(options.ios, false);
    assert.strictEqual(options.noCache, false);
    assert.strictEqual(unknown.length, 0);
  });

  it('parses --port with space', () => {
    const { options } = parseArgs(['node', 'starship', '--port', '9090']);
    assert.strictEqual(options.port, 9090);
  });

  it('parses -p shorthand', () => {
    const { options } = parseArgs(['node', 'starship', '-p', '3000']);
    assert.strictEqual(options.port, 3000);
  });

  it('parses --port=VALUE format', () => {
    const { options } = parseArgs(['node', 'starship', '--port=4000']);
    assert.strictEqual(options.port, 4000);
  });

  it('parses --server-port', () => {
    const { options } = parseArgs(['node', 'starship', '--server-port', '9999']);
    assert.strictEqual(options.serverPort, 9999);
  });

  it('parses --server-port=VALUE format', () => {
    const { options } = parseArgs(['node', 'starship', '--server-port=7777']);
    assert.strictEqual(options.serverPort, 7777);
  });

  it('parses --no-cache', () => {
    const { options } = parseArgs(['node', 'starship', '--no-cache']);
    assert.strictEqual(options.noCache, true);
  });

  it('parses --watch', () => {
    const { options } = parseArgs(['node', 'starship', '--watch']);
    assert.strictEqual(options.watch, true);
  });

  it('parses -w shorthand', () => {
    const { options } = parseArgs(['node', 'starship', '-w']);
    assert.strictEqual(options.watch, true);
  });

  it('parses --ios', () => {
    const { options } = parseArgs(['node', 'starship', '--ios']);
    assert.strictEqual(options.ios, true);
  });

  it('parses -i shorthand', () => {
    const { options } = parseArgs(['node', 'starship', '-i']);
    assert.strictEqual(options.ios, true);
  });

  it('parses combined flags', () => {
    const { options } = parseArgs(['node', 'starship', '--port', '8082', '--watch', '--no-cache', '--ios']);
    assert.strictEqual(options.port, 8082);
    assert.strictEqual(options.watch, true);
    assert.strictEqual(options.noCache, true);
    assert.strictEqual(options.ios, true);
  });

  it('reports unknown flags', () => {
    const { unknown } = parseArgs(['node', 'starship', '--banana']);
    assert.strictEqual(unknown.length, 1);
    assert.strictEqual(unknown[0], '--banana');
  });

  it('rejects invalid port values', () => {
    const { unknown } = parseArgs(['node', 'starship', '--port', 'abc']);
    assert(unknown.length >= 1);
    assert.strictEqual(unknown[0], '--port');
  });

  it('rejects port out of range', () => {
    const { unknown } = parseArgs(['node', 'starship', '--port', '99999']);
    assert(unknown.length >= 1);
    assert.strictEqual(unknown[0], '--port');
  });

  it('handles --port without value at end of args', () => {
    const { unknown } = parseArgs(['node', 'starship', '--port']);
    assert.strictEqual(unknown.length, 1);
    assert.strictEqual(unknown[0], '--port');
  });

  it('handles --port followed by another flag', () => {
    const { options, unknown } = parseArgs(['node', 'starship', '--port', '--watch']);
    assert.strictEqual(unknown[0], '--port');
    assert.strictEqual(options.watch, true);
  });
});
