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
  };

  console.log('');
  console.log(`  ${c.bold}${c.cyan}🚀 Starship${c.reset} v${pkg.version}`);
  console.log(`  ${c.dim}Launch your React Native app to any phone over WiFi${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}USAGE${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship ${c.dim}[options]${c.reset}             Launch (default)`);
  console.log(`    ${c.green}$${c.reset} starship build apk ${c.dim}[options]${c.reset}   Build debug APK`);
  console.log(`    ${c.green}$${c.reset} starship build aab              Build AAB for Play Store`);
  console.log(`    ${c.green}$${c.reset} starship build ipa ${c.dim}[options]${c.reset}   Build IPA for iOS`);
  console.log(`    ${c.green}$${c.reset} starship build ipa --cloud      Build IPA via GitHub Actions`);
  console.log(`    ${c.green}$${c.reset} starship cloud init             Setup cloud iOS builds`);
  console.log(`    ${c.green}$${c.reset} starship clean                  Clear cache`);
  console.log(`    ${c.green}$${c.reset} starship devices                List devices`);
  console.log('');
  console.log(`  ${c.bold}LAUNCH OPTIONS${c.reset}`);
  console.log(`    ${c.yellow}--port, -p <port>${c.reset}   Metro bundler port ${c.dim}(default: 8081)${c.reset}`);
  console.log(`    ${c.yellow}--server-port <port>${c.reset} HTTP server port ${c.dim}(default: 8888)${c.reset}`);
  console.log(`    ${c.yellow}--ios, -i${c.reset}           Build for iOS simulator`);
  console.log(`    ${c.yellow}--watch, -w${c.reset}         Watch native source changes`);
  console.log(`    ${c.yellow}--no-cache${c.reset}          Force rebuild`);
  console.log(`    ${c.yellow}--tunnel${c.reset}            Expose over internet`);
  console.log('');
  console.log(`  ${c.bold}BUILD OPTIONS${c.reset}`);
  console.log(`    ${c.yellow}--release${c.reset}           Release variant (APK)`);
  console.log(`    ${c.yellow}--output, -o <dir>${c.reset}  Output directory`);
  console.log(`    ${c.yellow}--export <method>${c.reset}   IPA export: development, ad-hoc, app-store`);
  console.log(`    ${c.yellow}--cloud${c.reset}             Build via GitHub Actions (no Mac needed)`);
  console.log(`    ${c.yellow}--submit${c.reset}            Upload to App Store Connect`);
  console.log('');
  console.log(`  ${c.bold}EXAMPLES${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship                         ${c.dim}# wireless deploy${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship build apk               ${c.dim}# debug APK${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship build apk --release     ${c.dim}# release APK${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship build aab               ${c.dim}# Play Store bundle${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship build ipa --export ad-hoc  ${c.dim}# Ad-hoc IPA${c.reset}`);
  console.log(`    ${c.green}$${c.reset} starship build ipa -o ./dist     ${c.dim}# IPA to custom dir${c.reset}`);
  console.log('');
}

function printVersion() {
  console.log(pkg.version);
}

function main() {
  const { command, options, unknown } = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  if (unknown.length > 0 && command === 'launch') {
    const c = { reset: '\x1b[0m', red: '\x1b[31m', dim: '\x1b[2m' };
    console.error('');
    console.error(`  ${c.red}Error:${c.reset} Unknown flag "${unknown[0]}"`);
    console.error(`  ${c.dim}Run "starship --help" to see available options${c.reset}`);
    console.error('');
    process.exit(1);
  }

  const c = { reset: '\x1b[0m', red: '\x1b[31m', dim: '\x1b[2m' };

  switch (command) {
    case 'launch': {
      const { run } = require(path.join(__dirname, '..', 'src', 'index.js'));
      run({
        watch: options.watch,
        ios: options.ios,
        port: options.port,
        serverPort: options.serverPort,
        noCache: options.noCache,
        tunnel: options.tunnel,
      }).catch((err) => {
        console.error(`\n  ${c.red}Error:${c.reset} ${err.message}\n`);
        process.exit(1);
      });
      break;
    }

    case 'build': {
      const { buildApkCommand, buildAabCommand, buildIpaCommand } = require(path.join(__dirname, '..', 'src', 'build-command.js'));

      // Cloud build for iOS
      if (options.cloud && options.buildTarget === 'ipa') {
        const { cloudBuild } = require(path.join(__dirname, '..', 'src', 'cloud-build.js'));
        cloudBuild({ export: options.export, submit: options.submit }).catch((err) => {
          console.error(`\n  ${c.red}Error:${c.reset} ${err.message}\n`);
          process.exit(1);
        });
        break;
      }

      let buildFn;
      switch (options.buildTarget) {
        case 'apk':
          buildFn = () => buildApkCommand({ release: options.release, output: options.output });
          break;
        case 'aab':
          buildFn = () => buildAabCommand({ output: options.output });
          break;
        case 'ipa':
          buildFn = () => buildIpaCommand({ export: options.export, output: options.output });
          break;
        default:
          console.error(`\n  ${c.red}Error:${c.reset} Unknown build target "${options.buildTarget}"`);
          console.error(`  ${c.dim}Available: apk, aab, ipa${c.reset}\n`);
          process.exit(1);
      }

      buildFn().catch((err) => {
        console.error(`\n  ${c.red}Error:${c.reset} ${err.message}\n`);
        process.exit(1);
      });
      break;
    }

    case 'cloud-init': {
      const { cloudInit } = require(path.join(__dirname, '..', 'src', 'cloud-init.js'));
      cloudInit().catch((err) => {
        console.error(`\n  ${c.red}Error:${c.reset} ${err.message}\n`);
        process.exit(1);
      });
      break;
    }

    case 'doctor': {
      const { runDoctor } = require(path.join(__dirname, '..', 'src', 'doctor.js'));
      runDoctor().catch((err) => {
        console.error(`\n  ${c.red}Error:${c.reset} ${err.message}\n`);
        process.exit(1);
      });
      break;
    }

    case 'clean': {
      const fs = require('fs');
      const cachePath = path.resolve('.starship-cache');
      if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true, force: true });
        console.log('\n  ✔ Cache cleared\n');
      } else {
        console.log('\n  Nothing to clean\n');
      }
      break;
    }

    case 'devices': {
      const { listConnectedDevices, displayDevices } = require(path.join(__dirname, '..', 'src', 'device-manager.js'));
      const devices = listConnectedDevices();
      displayDevices(devices);
      break;
    }

    default:
      printHelp();
      break;
  }
}

// Export for testing
module.exports = { parseArgs };

main();
