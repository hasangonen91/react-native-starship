# 🚀 Starship

Launch your React Native app to any phone over WiFi. No cables, no Expo — just scan and fly.

## What it does

1. Builds Android debug APK
2. Serves it on your local network
3. Shows QR code in terminal
4. Phone scans QR → installs APK (one time)
5. Starts Metro with network access
6. Edit code → instant update via Fast Refresh

## Installation

```bash
yarn add react-native-starship
# or
npm install react-native-starship
```

Auto-registers as a React Native CLI plugin. No config needed.

## Usage

```bash
npx react-native starship
```

That's it. Scan the QR, install once, start coding.

```bash
# With watch mode (auto-rebuild on native changes)
npx react-native starship --watch

# Or use directly
npx starship
```

## Options

| Flag | Description |
|------|-------------|
| `--watch, -w` | Auto-rebuild APK on native source changes |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## Prerequisites

- React Native CLI (bare) project with `android/` directory
- Android SDK + JDK
- Phone and computer on same WiFi

## How it works

```
┌──────────────────────────────────────────────┐
│  npx react-native starship                   │
├──────────────────────────────────────────────┤
│  1. Validate project structure               │
│  2. Detect local WiFi IP                     │
│  3. Build debug APK                          │
│  4. Serve APK on http://<ip>:8888            │
│  5. Show QR code                             │
│  6. Start Metro on 0.0.0.0:8081              │
├──────────────────────────────────────────────┤
│  Phone → scan QR → install → shake → set IP │
│  Then just code. Fast Refresh does the rest. │
└──────────────────────────────────────────────┘
```

## First time phone setup

After installing the APK:
1. Open the app
2. Shake phone → "Settings"
3. Set "Debug server host & port" to your IP (shown in terminal)
4. Shake → "Reload"

You only do this once. After that, it just works.

## License

MIT
