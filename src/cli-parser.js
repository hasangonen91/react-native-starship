'use strict';

/**
 * Parses CLI arguments for the starship command.
 * @param {string[]} argv - process.argv or equivalent
 * @returns {{options: Object, unknown: string[]}}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { watch: false, help: false, version: false, ios: false, port: 8081, serverPort: 8888, noCache: false };
  const unknown = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      case '--ios':
      case '-i':
        options.ios = true;
        break;
      case '--no-cache':
        options.noCache = true;
        break;
      case '--port':
      case '-p': {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          const parsed = parseInt(next, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
            options.port = parsed;
            i++;
          } else {
            unknown.push(arg);
          }
        } else {
          unknown.push(arg);
        }
        break;
      }
      case '--server-port': {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          const parsed = parseInt(next, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
            options.serverPort = parsed;
            i++;
          } else {
            unknown.push(arg);
          }
        } else {
          unknown.push(arg);
        }
        break;
      }
      default:
        // Check for --port=XXXX format
        if (arg.startsWith('--port=')) {
          const val = parseInt(arg.split('=')[1], 10);
          if (!isNaN(val) && val > 0 && val < 65536) {
            options.port = val;
          } else {
            unknown.push(arg);
          }
        } else if (arg.startsWith('--server-port=')) {
          const val = parseInt(arg.split('=')[1], 10);
          if (!isNaN(val) && val > 0 && val < 65536) {
            options.serverPort = val;
          } else {
            unknown.push(arg);
          }
        } else {
          unknown.push(arg);
        }
        break;
    }
  }

  return { options, unknown };
}

module.exports = { parseArgs };
