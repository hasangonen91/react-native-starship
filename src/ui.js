'use strict';

/**
 * Terminal UI utilities for rn-dev-qr.
 * Beautiful, informative terminal output without external dependencies.
 * Uses ANSI escape codes for colors and formatting.
 */

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Backgrounds
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

const DIVIDER = `${c.gray}${'─'.repeat(56)}${c.reset}`;
const DIVIDER_DOUBLE = `${c.gray}${'═'.repeat(56)}${c.reset}`;

/**
 * Prints the startup banner.
 */
function banner() {
  console.log('');
  console.log(DIVIDER_DOUBLE);
  console.log(`${c.bold}${c.magenta}  🚀 Starship${c.reset}${c.gray}  — Launch your app to any phone over WiFi${c.reset}`);
  console.log(DIVIDER_DOUBLE);
  console.log('');
}

/**
 * Prints a step header during the pipeline.
 * @param {number} step - Step number
 * @param {string} text - Step description
 */
function step(num, text) {
  console.log(`  ${c.bold}${c.blue}[${num}]${c.reset} ${text}`);
}

/**
 * Prints a success message.
 * @param {string} text
 */
function success(text) {
  console.log(`  ${c.green}✔${c.reset}  ${text}`);
}

/**
 * Prints an error message.
 * @param {string} title
 * @param {string} [detail]
 */
function error(title, detail) {
  console.log('');
  console.log(`  ${c.bgRed}${c.white}${c.bold} ERROR ${c.reset} ${c.red}${title}${c.reset}`);
  if (detail) {
    console.log(`         ${c.dim}${detail}${c.reset}`);
  }
  console.log('');
}

/**
 * Prints a warning message.
 * @param {string} text
 */
function warn(text) {
  console.log(`  ${c.yellow}⚠${c.reset}  ${c.yellow}${text}${c.reset}`);
}

/**
 * Prints an info line.
 * @param {string} label
 * @param {string} value
 */
function info(label, value) {
  console.log(`  ${c.gray}${label}:${c.reset} ${c.white}${value}${c.reset}`);
}

/**
 * Prints the project info section.
 * @param {Object} opts
 * @param {string} opts.applicationId
 * @param {string} opts.ip
 */
function projectInfo(opts) {
  console.log('');
  console.log(`  ${c.bold}Project${c.reset}`);
  info('  App ID     ', opts.applicationId);
  info('  Network IP ', opts.ip);
  info('  APK Server ', `http://${opts.ip}:8888`);
  info('  Metro      ', `http://${opts.ip}:8081`);
  console.log('');
  console.log(DIVIDER);
}

/**
 * Prints the build progress header.
 * @param {string} ip
 */
function buildStart(ip) {
  console.log('');
  console.log(`  ${c.bold}${c.yellow}⏳ Building APK...${c.reset}`);
  console.log(`  ${c.dim}Running ./gradlew assembleDebug with REACT_NATIVE_PACKAGER_HOSTNAME=${ip}${c.reset}`);
  console.log(DIVIDER);
}

/**
 * Prints build success.
 * @param {string} apkPath
 * @param {number} durationMs
 */
function buildSuccess(apkPath, durationMs) {
  const seconds = (durationMs / 1000).toFixed(1);
  const sizeMB = (() => {
    try {
      const stats = require('fs').statSync(apkPath);
      return (stats.size / (1024 * 1024)).toFixed(1);
    } catch {
      return '?';
    }
  })();

  console.log(DIVIDER);
  console.log(`  ${c.green}${c.bold}✔ APK built successfully${c.reset}`);
  console.log(`  ${c.dim}Time: ${seconds}s | Size: ${sizeMB} MB${c.reset}`);
  console.log('');
}

/**
 * Prints build failure.
 * @param {string} message
 */
function buildFailed(message) {
  console.log(DIVIDER);
  error('APK build failed', message);
}

/**
 * Prints the QR code section with instructions.
 * @param {string} url
 */
function qrSection(url) {
  console.log('');
  console.log(DIVIDER);
  console.log(`  ${c.bold}${c.magenta}📱 Scan QR code to install APK on your phone${c.reset}`);
  console.log(DIVIDER);
  console.log('');
}

/**
 * Prints the ready section after QR code.
 * @param {string} url
 * @param {boolean} watchMode
 */
function ready(url, watchMode, metroHost) {
  // Easter eggs — subliminal messages hidden in the flow
  const eggs = [
    { icon: '🌹', msg: 'küçükçekmece kanaryaya selam olsun' },
    { icon: '🍓', msg: 'çilekli sütlaç sevenlere selamlar' },
    { icon: '🌷', msg: '' },
  ];
  const egg = eggs[Math.floor(Math.random() * eggs.length)];

  console.log('');
  console.log(DIVIDER);
  console.log(`  ${c.bold}${c.green}🚀 Launched!${c.reset}`);
  if (egg.msg) {
    console.log(`  ${c.dim}${egg.icon} ${egg.msg}${c.reset}`);
  }
  console.log('');
  console.log(`  ${c.bold}Download URL:${c.reset}  ${c.cyan}${c.underline}${url}${c.reset}`);
  console.log('');
  console.log(`  ${c.bold}First time setup on phone:${c.reset}`);
  console.log(`  ${c.white}1.${c.reset} Scan QR → download & install APK`);
  console.log(`  ${c.white}2.${c.reset} Open app → ${c.yellow}"Unable to load script" is normal!${c.reset}`);
  console.log(`  ${c.white}3.${c.reset} Shake phone → "Settings"`);
  console.log(`  ${c.white}4.${c.reset} Set "Debug server host & port" to: ${c.green}${c.bold}${metroHost}${c.reset}`);
  console.log(`  ${c.white}5.${c.reset} Go back → shake → "Reload" — done!`);
  console.log('');
  console.log(`  ${c.dim}After first setup, just edit code — Fast Refresh handles the rest.${c.reset}`);
  if (watchMode) {
    console.log(`  ${c.yellow}👀 Watch mode active${c.reset} — native changes auto-rebuild APK`);
  }
  console.log('');
  console.log(`  ${c.dim}Press ${c.bold}Ctrl+C${c.reset}${c.dim} to stop${c.reset}`);
  console.log(DIVIDER);
  console.log('');
}

/**
 * Prints watch mode rebuild notification.
 * @param {number} durationMs
 */
function watchRebuildSuccess(durationMs) {
  const seconds = (durationMs / 1000).toFixed(1);
  const time = new Date().toLocaleTimeString();
  console.log(`  ${c.green}✔${c.reset} APK rebuilt ${c.dim}(${seconds}s)${c.reset} at ${c.white}${time}${c.reset}`);
  console.log(`  ${c.dim}Phone will download new APK on next QR scan${c.reset}`);
}

/**
 * Prints watch mode rebuild failure.
 * @param {string} message
 */
function watchRebuildFailed(message) {
  console.log(`  ${c.red}✖${c.reset} Rebuild failed: ${c.dim}${message}${c.reset}`);
  console.log(`  ${c.dim}Watching for changes...${c.reset}`);
}

/**
 * Prints shutdown message.
 */
function shutdownMsg() {
  console.log('');
  console.log(`  ${c.yellow}⏹${c.reset}  Shutting down...`);
}

/**
 * Prints Metro start message.
 * @param {number} [port]
 */
function metroStart(port) {
  const portStr = port ? `:${port}` : '';
  console.log(`  ${c.bold}${c.cyan}▶ Metro bundler starting${c.reset} ${c.dim}(--host 0.0.0.0${portStr})${c.reset}`);
  console.log(DIVIDER);
}

/**
 * Prints cache hit message.
 * @param {string} apkPath
 */
function cacheHit(apkPath) {
  console.log(`  ${c.green}⚡${c.reset} APK cache hit — ${c.dim}skipping build${c.reset}`);
  console.log(`  ${c.dim}  ${apkPath}${c.reset}`);
}

/**
 * Prints server start message.
 */
function serverStart() {
  success('HTTP server listening on port 8888');
}

module.exports = {
  c,
  banner,
  step,
  success,
  error,
  warn,
  info,
  projectInfo,
  buildStart,
  buildSuccess,
  buildFailed,
  qrSection,
  ready,
  watchRebuildSuccess,
  watchRebuildFailed,
  shutdownMsg,
  metroStart,
  serverStart,
  cacheHit,
};
