'use strict';

const path = require('path');

module.exports = {
  commands: [
    {
      name: 'starship',
      description: 'Build APK, serve via QR code, and start Metro with network access',
      func: async (argv, config, options) => {
        const { run } = require(path.join(__dirname, 'src', 'index.js'));
        await run({
          watch: options.watch || false,
          ios: options.ios || false,
          port: options.port || 8081,
          serverPort: options.serverPort || 8888,
          noCache: options.noCache || false,
          tunnel: options.tunnel || false,
        });
      },
      options: [
        { name: '--watch', description: 'Watch for native source changes and rebuild', default: false },
        { name: '--ios', description: 'Build for iOS simulator', default: false },
        { name: '--port <number>', description: 'Metro bundler port (default: 8081)' },
        { name: '--server-port <number>', description: 'HTTP server port (default: 8888)' },
        { name: '--no-cache', description: 'Skip APK cache, force rebuild', default: false },
        { name: '--tunnel', description: 'Expose over internet (tunnel mode)', default: false },
      ],
    },
    {
      name: 'starship-build',
      description: 'Build APK, AAB, or IPA',
      func: async (argv, config, options) => {
        const { buildApkCommand, buildAabCommand, buildIpaCommand } = require(path.join(__dirname, 'src', 'build-command.js'));
        const target = argv[0] || 'apk';

        switch (target) {
          case 'apk':
            await buildApkCommand({ release: options.release, output: options.output });
            break;
          case 'aab':
            await buildAabCommand({ output: options.output });
            break;
          case 'ipa':
            await buildIpaCommand({ export: options.export, output: options.output });
            break;
          default:
            console.error(`Unknown target: ${target}. Use: apk, aab, ipa`);
            process.exit(1);
        }
      },
      options: [
        { name: '--release', description: 'Build release variant', default: false },
        { name: '--output <path>', description: 'Output directory' },
        { name: '--export <method>', description: 'IPA export method (development, ad-hoc, app-store)' },
      ],
    },
  ],
};
