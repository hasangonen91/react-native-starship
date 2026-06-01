'use strict';

const { spawn } = require('child_process');
const { getLastDevice, formatDevice } = require('./device-tracker');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
};

/**
 * Starts Metro bundler with network access enabled.
 * Parses Metro output to show meaningful real-time info:
 * - Bundle progress
 * - Fast Refresh / HMR updates
 * - Errors with file/line info
 * - Warnings
 * - Device connections
 *
 * @param {number} [port=8081] - Metro port
 * @returns {import('child_process').ChildProcess} The Metro child process
 */
function startMetro(port) {
  const metroPort = port || 8081;
  const child = spawn('npx', ['react-native', 'start', '--host', '0.0.0.0', '--port', String(metroPort)], {
    stdio: 'pipe',
  });

  let bundleStartTime = null;
  let lastBundlePath = '';
  let bundleTimeout = null;

  child.stdout.on('data', (data) => {
    const raw = data.toString();
    // Split by both \n and \r to handle Metro's progress output
    const lines = raw.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip ASCII art banner
      if (trimmed.match(/^[▒▓░\s]+$/) || trimmed.includes('Welcome to Metro') ||
          trimmed.includes('Fast - Scalable - Integrated') ||
          trimmed.includes('Welcome to React Native')) {
        continue;
      }

      // Dev server ready
      if (trimmed.includes('Dev server ready') || trimmed.includes('dev server running')) {
        console.log(`  ${c.green}✔${c.reset}  Metro ready — Fast Refresh enabled`);
        console.log(`  ${c.dim}  Waiting for device connection...${c.reset}`);
        continue;
      }

      // Bundle start — "BUNDLE  ./index.js ..."
      if ((trimmed.includes('BUNDLE') || trimmed.includes('bundle')) && trimmed.includes('./')) {
        if (!trimmed.includes('done')) {
          bundleStartTime = Date.now();
          const fileMatch = trimmed.match(/\.\/([^\s]+)/);
          lastBundlePath = fileMatch ? fileMatch[1] : '';
          process.stdout.write(`\r  ${c.cyan}⟳${c.reset}  Bundling${lastBundlePath ? ` ${c.dim}${lastBundlePath}${c.reset}` : ''}...`);

          // Auto-complete after timeout if "done" message is missed
          if (bundleTimeout) clearTimeout(bundleTimeout);
          bundleTimeout = setTimeout(() => {
            if (bundleStartTime) {
              const duration = Date.now() - bundleStartTime;
              const device = getLastDevice();
              const deviceStr = formatDevice(device);
              process.stdout.write(`\r  ${c.green}✔${c.reset}  Bundled in ${c.bold}${duration}ms${c.reset}${' '.repeat(30)}\n`);
              if (device) {
                console.log(`  ${c.green}📱${c.reset} ${c.bold}${device.model}${c.reset} ${c.dim}(${device.os})${c.reset} connected — app is running`);
              } else {
                console.log(`  ${c.green}📱${c.reset} Device connected — app is running`);
              }
              bundleStartTime = null;
            }
          }, 5000);
          continue;
        }
      }

      // Bundle done — "done in Xms" or "BUNDLE ... done" or "200 ... ms"
      if ((trimmed.includes('done') || trimmed.match(/\b\d+ms\b/) || trimmed.includes('200')) && bundleStartTime) {
        const duration = Date.now() - bundleStartTime;
        const timeMatch = trimmed.match(/(\d+)\s*ms/);
        const ms = timeMatch ? timeMatch[1] : duration;
        if (bundleTimeout) { clearTimeout(bundleTimeout); bundleTimeout = null; }
        const device = getLastDevice();
        process.stdout.write(`\r  ${c.green}✔${c.reset}  Bundled in ${c.bold}${ms}ms${c.reset}${' '.repeat(30)}\n`);
        if (device) {
          console.log(`  ${c.green}📱${c.reset} ${c.bold}${device.model}${c.reset} ${c.dim}(${device.os})${c.reset} connected — app is running`);
        } else {
          console.log(`  ${c.green}📱${c.reset} Device connected — app is running`);
        }
        bundleStartTime = null;
        continue;
      }

      // HMR / Fast Refresh update
      if (trimmed.includes('HMR') || trimmed.includes('hot update') || trimmed.includes('Fast Refresh')) {
        console.log(`  ${c.magenta}⚡${c.reset} Fast Refresh — component updated`);
        continue;
      }

      // Device connected / app running
      if (trimmed.includes('client connected') || trimmed.includes('device connected') ||
          trimmed.includes('Running "')) {
        if (trimmed.includes('connected')) {
          console.log(`  ${c.green}📱${c.reset} Device connected to Metro`);
        }
        if (trimmed.includes('Running "')) {
          const appMatch = trimmed.match(/Running "([^"]+)"/);
          const appName = appMatch ? appMatch[1] : 'app';
          console.log(`  ${c.green}📱${c.reset} ${c.bold}${appName}${c.reset} is running on device`);
        }
        continue;
      }

      // Syntax/compile errors
      if (trimmed.includes('error') || trimmed.includes('Error') || trimmed.includes('ERROR')) {
        // Skip known non-critical errors
        if (trimmed.includes('Unauthorized request') || trimmed.includes('securityHeadersMiddleware')) {
          continue;
        }

        // "Unable to load script" — common when phone can't reach Metro
        if (trimmed.includes('Unable to load script') || trimmed.includes('Could not connect to development server')) {
          console.log('');
          console.log(`  ${c.bgRed}${c.white}${c.bold} CONNECTION ERROR ${c.reset}`);
          console.log(`  ${c.red}Phone cannot reach Metro bundler${c.reset}`);
          console.log(`  ${c.dim}  Fix: Open app → Shake → Settings → set "Debug server host & port" to:${c.reset}`);
          console.log(`  ${c.green}${c.bold}  <your-ip>:8081${c.reset}`);
          console.log(`  ${c.dim}  Then shake → Reload${c.reset}`);
          console.log('');
          continue;
        }

        // Multi-line error — show with context
        if (trimmed.includes('SyntaxError') || trimmed.includes('TypeError') || trimmed.includes('Cannot find')) {
          console.log('');
          console.log(`  ${c.bgRed}${c.white}${c.bold} ERROR ${c.reset} ${c.red}${trimmed}${c.reset}`);
        } else {
          console.log(`  ${c.red}✖${c.reset}  ${trimmed}`);
        }
        continue;
      }

      // File path in error stack (shows where the error is)
      if (trimmed.match(/^\s*(at |>?\s*\d+\s*\|)/)) {
        // Skip stack traces from security middleware
        if (trimmed.includes('securityHeaders') || trimmed.includes('connect/index')) {
          continue;
        }
        console.log(`  ${c.dim}    ${trimmed}${c.reset}`);
        continue;
      }

      // Warning
      if (trimmed.includes('WARN') || trimmed.includes('warn')) {
        console.log(`  ${c.yellow}⚠${c.reset}  ${trimmed.replace(/^(WARN|warn)\s*/, '')}`);
        continue;
      }

      // Log from app (console.log in RN app shows here)
      if (trimmed.startsWith('LOG') || trimmed.startsWith('INFO')) {
        const msg = trimmed.replace(/^(LOG|INFO)\s*/, '');
        console.log(`  ${c.dim}│${c.reset} ${msg}`);
        continue;
      }

      // Starting dev server
      if (trimmed.includes('Starting dev server')) {
        console.log(`  ${c.dim}${trimmed}${c.reset}`);
        continue;
      }

      // Interactive mode not supported — skip
      if (trimmed.includes('Interactive mode')) {
        continue;
      }
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip security middleware noise
      if (trimmed.includes('Unauthorized request') || trimmed.includes('securityHeaders') || trimmed.includes('connect/index')) {
        continue;
      }

      if (trimmed.includes('ERROR') || trimmed.includes('error')) {
        console.log(`  ${c.red}✖${c.reset}  ${trimmed}`);
      } else if (trimmed.includes('WARN') || trimmed.includes('warn')) {
        console.log(`  ${c.yellow}⚠${c.reset}  ${trimmed.replace(/^(WARN|warn)\s*/, '')}`);
      } else if (trimmed.includes('deprecated')) {
        // Skip
      } else {
        console.log(`  ${c.dim}${trimmed}${c.reset}`);
      }
    }
  });

  return child;
}

module.exports = { startMetro };
