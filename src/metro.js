'use strict';

const { spawn } = require('child_process');

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
 * @returns {import('child_process').ChildProcess} The Metro child process
 */
function startMetro() {
  const child = spawn('npx', ['react-native', 'start', '--host', '0.0.0.0'], {
    stdio: 'pipe',
  });

  let bundleStartTime = null;
  let lastBundlePath = '';

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
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
      if (trimmed.includes('Dev server ready')) {
        console.log(`  ${c.green}✔${c.reset}  Metro ready — Fast Refresh enabled`);
        console.log(`  ${c.dim}  Waiting for device connection...${c.reset}`);
        continue;
      }

      // Bundle start — "BUNDLE  ./index.js ..."
      if (trimmed.includes('BUNDLE') && trimmed.includes('./')) {
        bundleStartTime = Date.now();
        const fileMatch = trimmed.match(/\.\/([^\s]+)/);
        lastBundlePath = fileMatch ? fileMatch[1] : '';
        process.stdout.write(`\r  ${c.cyan}⟳${c.reset}  Bundling${lastBundlePath ? ` ${c.dim}${lastBundlePath}${c.reset}` : ''}...`);
        continue;
      }

      // Bundle done — "done in Xms" or "BUNDLE ... done"
      if (trimmed.includes('done') && bundleStartTime) {
        const duration = Date.now() - bundleStartTime;
        const timeMatch = trimmed.match(/(\d+)ms/);
        const ms = timeMatch ? timeMatch[1] : duration;
        process.stdout.write(`\r  ${c.green}✔${c.reset}  Bundled in ${c.bold}${ms}ms${c.reset}${' '.repeat(30)}\n`);
        bundleStartTime = null;
        continue;
      }

      // HMR / Fast Refresh update
      if (trimmed.includes('HMR') || trimmed.includes('hot update') || trimmed.includes('Fast Refresh')) {
        console.log(`  ${c.magenta}⚡${c.reset} Fast Refresh — component updated`);
        continue;
      }

      // Device connected
      if (trimmed.includes('client connected') || trimmed.includes('device connected') || trimmed.includes('WebSocket')) {
        if (trimmed.includes('connected')) {
          console.log(`  ${c.green}📱${c.reset} Device connected`);
        }
        continue;
      }

      // Syntax/compile errors
      if (trimmed.includes('error') || trimmed.includes('Error') || trimmed.includes('ERROR')) {
        // Skip known non-critical errors
        if (trimmed.includes('Unauthorized request') || trimmed.includes('securityHeadersMiddleware')) {
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
