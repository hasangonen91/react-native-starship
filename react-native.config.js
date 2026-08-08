'use strict';

// Lazy-loaded commands — nothing is require()'d at module load time.
// React Native CLI scans this file on every `npx react-native` invocation,
// so keeping this file side-effect free avoids startup overhead.

module.exports = {
  commands: [
    {
      name: 'starship',
      description: 'Wireless React Native dev — builds APK/iOS, shows QR, starts Metro',
      func: (argv, config, options) => {
        const path = require('path');
        const { run } = require(path.join(__dirname, 'src', 'index.js'));
        return run({
          watch: options.watch || false,
          ios: options.ios || false,
          port: options.port ? parseInt(options.port, 10) : 8081,
          serverPort: options.serverPort ? parseInt(options.serverPort, 10) : 8888,
          noCache: options.noCache || false,
          tunnel: options.tunnel || false,
        });
      },
      options: [
        { name: '--watch', description: 'Watch native source changes and rebuild', default: false },
        { name: '--ios', description: 'Build for iOS simulator', default: false },
        { name: '--port <number>', description: 'Metro bundler port (default: 8081)' },
        { name: '--server-port <number>', description: 'HTTP server port (default: 8888)' },
        { name: '--no-cache', description: 'Skip cache, force rebuild', default: false },
        { name: '--tunnel', description: 'Expose over internet', default: false },
      ],
    },
    {
      name: 'starship-build',
      description: 'Build APK, AAB, or IPA',
      func: (argv, config, options) => {
        const path = require('path');
        const { buildApkCommand, buildAabCommand, buildIpaCommand } = require(path.join(__dirname, 'src', 'build-command.js'));
        const target = argv[0] || 'apk';
        switch (target) {
          case 'apk': return buildApkCommand({ release: options.release, output: options.output });
          case 'aab': return buildAabCommand({ output: options.output });
          case 'ipa': return buildIpaCommand({ export: options.export, output: options.output });
          default:
            console.error(`Unknown target: ${target}. Use: apk, aab, ipa`);
            process.exit(1);
        }
      },
      options: [
        { name: '--release', description: 'Build release variant', default: false },
        { name: '--output <path>', description: 'Output directory' },
        { name: '--export <method>', description: 'IPA export method' },
      ],
    },
  ],
};
