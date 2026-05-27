'use strict';

const qrcode = require('qrcode-terminal');

/**
 * Renders a QR code in the terminal encoding the download URL.
 * Falls back to plain text URL if qrcode-terminal fails.
 * @param {string} url - The URL to encode (http://<ip>:8888)
 */
function displayQR(url) {
  try {
    qrcode.generate(url, { small: true }, (qr) => {
      // Indent the QR code for better visual alignment
      const indented = qr.split('\n').map(line => '    ' + line).join('\n');
      console.log(indented);
    });
  } catch (err) {
    // QR code rendering failed — URL is shown in the ready section anyway
    console.log(`    [QR code unavailable — use URL below]`);
  }
}

module.exports = { displayQR };
