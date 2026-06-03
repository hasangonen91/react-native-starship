'use strict';

/**
 * Parses CLI arguments for the starship command.
 * @param {string[]} argv - process.argv or equivalent
 * @returns {{command: string, options: Object, unknown: string[]}}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    watch: false, help: false, version: false, ios: false,
    port: 8081, serverPort: 8888, noCache: false, tunnel: false,
    // Build options
    release: false, output: null, export: 'development',
  };
  const unknown = [];
  let command = 'launch'; // default command

  // Check for subcommand
  if (args[0] && !args[0].startsWith('-')) {
    if (args[0] === 'build') {
      command = 'build';
      // Next arg is the build target
      if (args[1] && !args[1].startsWith('-')) {
        options.buildTarget = args[1]; // apk, aab, ipa
        args.splice(0, 2);
      } else {
        options.buildTarget = 'apk'; // default
        args.splice(0, 1);
      }
    } else if (args[0] === 'cloud' && args[1] === 'init') {
      command = 'cloud-init';
      args.splice(0, 2);
    } else if (args[0] === 'doctor') {
      command = 'doctor';
      args.splice(0, 1);
    } else if (args[0] === 'clean') {
      command = 'clean';
      args.splice(0, 1);
    } else if (args[0] === 'devices') {
      command = 'devices';
      args.splice(0, 1);
    }
  }

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
      case '--tunnel':
        options.tunnel = true;
        break;
      case '--release':
        options.release = true;
        break;
      case '--cloud':
        options.cloud = true;
        break;
      case '--submit':
        options.submit = true;
        break;
      case '--output':
      case '-o': {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          options.output = next;
          i++;
        }
        break;
      }
      case '--export': {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          options.export = next;
          i++;
        }
        break;
      }
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
        } else if (arg.startsWith('--output=')) {
          options.output = arg.split('=')[1];
        } else if (arg.startsWith('--export=')) {
          options.export = arg.split('=')[1];
        } else {
          unknown.push(arg);
        }
        break;
    }
  }

  return { command, options, unknown };
}

module.exports = { parseArgs };
