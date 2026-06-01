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
        });
      },
      options: [
        {
          name: '--watch',
          description: 'Watch for native source changes and rebuild automatically',
          default: false,
        },
        {
          name: '--ios',
          description: 'Build for iOS simulator instead of Android',
          default: false,
        },
        {
          name: '--port <number>',
          description: 'Metro bundler port (default: 8081)',
        },
        {
          name: '--server-port <number>',
          description: 'HTTP server port for APK download (default: 8888)',
        },
        {
          name: '--no-cache',
          description: 'Skip APK cache and force a fresh build',
          default: false,
        },
      ],
      examples: [
        {
          desc: 'Launch Starship — build APK and serve over WiFi',
          cmd: 'npx react-native starship',
        },
        {
          desc: 'Launch with custom Metro port',
          cmd: 'npx react-native starship --port 8082',
        },
        {
          desc: 'Launch with watch mode for native changes',
          cmd: 'npx react-native starship --watch',
        },
        {
          desc: 'Force rebuild without cache',
          cmd: 'npx react-native starship --no-cache',
        },
      ],
    },
  ],
};
