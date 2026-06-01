#!/usr/bin/env node

'use strict';

const path = require('path');
const pkg = require(path.join(__dirname, '..', 'package.json'));
const { parseArgs } = require(path.join(__dirname, '..', 'src', 'cli-parser.js'));

function printHelp() {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    gray: '\x1b[90m',
  };

  console.log('');
  console.log(`  ${c.bold}${c.cyan}🚀 Starship${c.reset} v${pkg.version}`);
  console.log(`  ${c.dim}Launch your React Native app to any phone over WiFi${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}USAGE${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship ${c.dim}[options]${c.reset}`);
  console.log(`    ${c.green}$${c.reset} npx react-native starship ${c.dim}[options]${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}OPTIONS${c.reset}`);
  console.log(`    ${c.yellow}--port, -p <port>${c.reset}   Metro bundler port ${c.dim}(default: 8081)${c.reset}`);
  console.log(`    ${c.yellow}--server-port <port>${c.reset} HTTP server port ${c.dim}(default: 8888)${c.reset}`);
  console.log(`    ${c.yellow}--ios, -i${c.reset}           Build for iOS simulator instead of Android`);
  console.log(`    ${c.yellow}--watch, -w${c.reset}         Watch native source changes and auto-rebuild`);
  console.log(`    ${c.yellow}--no-cache${c.reset}          Skip APK cache, force rebuild`);
  console.log(`    ${c.yellow}--help, -h${c.reset}          Show this help message`);
  console.log(`    ${c.yellow}--version, -v${c.reset}       Show version number`);
  console.log('');
  console.log(`  ${c.bold}WHAT IT DOES${c.reset}`);
  console.log(`    ${c.dim}1.${c.reset} Detects connected devices (physical + emulators)`);
  console.log(`    ${c.dim}2.${c.reset} Auto-runs adb reverse on all devices`);
  console.log(`    ${c.dim}3.${c.reset} Builds debug APK (cached if source unchanged)`);
  console.log(`    ${c.dim}4.${c.reset} Installs APK on all connected devices`);
  console.log(`    ${c.dim}5.${c.reset} Serves APK on http://<your-ip>:<port>`);
  console.log(`    ${c.dim}6.${c.reset} Shows QR code — scan to install APK on phone`);
  console.log(`    ${c.dim}7.${c.reset} Starts Metro bundler with network access`);
  console.log(`    ${c.dim}8.${c.reset} Tracks build times for performance monitoring`);
  console.log('');
  console.log(`  ${c.bold}PREREQUISITES${c.reset}`);
  console.log(`    ${c.dim}•${c.reset} React Native CLI project with android/ directory`);
  console.log(`    ${c.dim}•${c.reset} Android SDK + JDK installed`);
  console.log(`    ${c.dim}•${c.reset} Phone and computer on same WiFi network`);
  console.log('');
  console.log(`  ${c.bold}EXAMPLES${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship                    ${c.dim}# default, port 8081${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship --port 8082        ${c.dim}# custom Metro port${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship --watch --no-cache ${c.dim}# watch + force rebuild${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship --ios              ${c.dim}# iOS simulator${c.reset}`);
  console.log('');
}

function printVersion() {
  console.log(pkg.version);
}

function main() {
  const { options, unknown } = parseArgs(process.argv);

  if (unknown.length > 0) {
    const c = { reset: '\x1b[0m', red: '\x1b[31m', dim: '\x1b[2m' };
    console.error('');
    console.error(`  ${c.red}Error:${c.reset} Unknown flag "${unknown[0]}"`);
    console.error(`  ${c.dim}Run "starship --help" to see available options${c.reset}`);
    console.error('');
    process.exit(1);
  }

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  const { run } = require(path.join(__dirname, '..', 'src', 'index.js'));
  run({
    watch: options.watch,
    ios: options.ios,
    port: options.port,
    serverPort: options.serverPort,
    noCache: options.noCache,
  }).catch((err) => {
    const c = { reset: '\x1b[0m', red: '\x1b[31m', dim: '\x1b[2m' };
    console.error('');
    console.error(`  ${c.red}Error:${c.reset} ${err.message}`);
    console.error('');
    process.exit(1);
  });
}

// Export for testing
module.exports = { parseArgs, printHelp, printVersion };

main();
