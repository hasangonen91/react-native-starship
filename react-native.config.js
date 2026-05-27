'use strict';

const path = require('path');

module.exports = {
  commands: [
    {
      name: 'starship',
      description: 'Build APK, serve via QR code, and start Metro with network access',
      func: async (argv, config, options) => {
        const { run } = require(path.join(__dirname, 'src', 'index.js'));
        await run({ watch: options.watch || false, ios: options.ios || false });
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
      ],
      examples: [
        {
          desc: 'Launch Starship — build APK and serve over WiFi',
          cmd: 'npx react-native starship',
        },
        {
          desc: 'Launch with watch mode for native changes',
          cmd: 'npx react-native starship --watch',
        },
      ],
    },
  ],
};
