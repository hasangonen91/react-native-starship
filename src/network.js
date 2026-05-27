'use strict';

const os = require('os');

/**
 * Detects the local IPv4 address suitable for LAN access.
 * Excludes loopback (127.x.x.x), link-local (169.254.x.x), and internal addresses.
 * @returns {string} IPv4 address
 * @throws {Error} If no valid network address is found
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const addresses = interfaces[name];
    for (const addr of addresses) {
      // Skip internal interfaces
      if (addr.internal) continue;

      // Only consider IPv4 addresses
      if (addr.family !== 'IPv4') continue;

      // Skip loopback addresses (127.x.x.x)
      if (addr.address.startsWith('127.')) continue;

      // Skip link-local addresses (169.254.x.x)
      if (addr.address.startsWith('169.254.')) continue;

      return addr.address;
    }
  }

  throw new Error(
    'Error: No valid network IP address found\n' +
    '  Make sure you are connected to a WiFi network.'
  );
}

module.exports = { getLocalIP };
