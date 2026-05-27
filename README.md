# 🚀 Starship

[![npm version](https://img.shields.io/npm/v/react-native-starship.svg)](https://npmjs.com/package/react-native-starship)
[![npm downloads](https://img.shields.io/npm/dm/react-native-starship.svg)](https://npmjs.com/package/react-native-starship)
[![license](https://img.shields.io/npm/l/react-native-starship.svg)](https://github.com/hasangonen91/react-native-starship/blob/main/LICENSE)

Launch your React Native app to any device over WiFi. No cables, no Expo — just scan and fly.

> **The missing wireless development tool for React Native CLI projects.**
> Like Expo Go, but for bare CLI apps with custom native code.

## Installation

```bash
yarn add react-native-starship
# or
npm install react-native-starship
```

Auto-registers as a React Native CLI plugin. Zero config.

## Usage

```bash
npx react-native starship
```

One command does everything — detects both platforms, builds, serves, and starts Metro.

## What happens

### Android (real device via QR)
1. Builds debug APK
2. Serves it on your local network (port 8888)
3. Shows QR code in terminal
4. Phone scans QR → installs APK (one time)
5. Fast Refresh over WiFi — edit code, see changes instantly

### iOS (simulator)
1. Builds for iOS simulator
2. Installs and launches automatically
3. Fast Refresh works immediately

### Both platforms
- Metro bundler starts with `--host 0.0.0.0` (network accessible)
- Single Metro instance serves both Android and iOS
- Interactive keyboard shortcuts for quick actions

## Interactive Shortcuts

While Starship is running, press these keys:

| Key | Action |
|-----|--------|
| `a` | Run on Android — launches emulator, installs APK, opens app |
| `i` | Run on iOS — builds and launches on simulator |
| `j` | Open DevTools — triggers Dev Menu on both platforms |
| `r` | Reload — sends reload command to Metro |
| `d` | Dev Menu — opens React Native Dev Menu |
| `h` | Help — show shortcuts again |
| `q` | Quit — graceful shutdown |

## Options

| Flag | Description |
|------|-------------|
| `--watch, -w` | Auto-rebuild on native source changes (.java/.kt/.xml) |
| `--ios, -i` | Build only for iOS simulator |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

## First time setup (Android real device)

After installing the APK on your phone:
1. Open the app
2. Shake phone → "Settings"
3. Set "Debug server host & port" to the IP shown in terminal (e.g. `192.168.1.108:8081`)
4. Shake → "Reload"

You only do this once. After that, Fast Refresh works automatically.

## Features

- **Zero config** — just run it in any RN CLI project
- **Auto-detect platforms** — builds Android and iOS if both exist
- **QR code APK distribution** — no USB cable needed for Android
- **iOS simulator support** — auto build + install + launch
- **Interactive mode** — keyboard shortcuts for common actions
- **Fast Refresh** — edit JS, see changes instantly (no app restart)
- **Watch mode** — auto-rebuild APK on native code changes
- **Beautiful terminal UI** — progress, errors, and status at a glance
- **App icon on download page** — shows your app's actual icon
- **Graceful shutdown** — Ctrl+C cleans up all processes

## Prerequisites

- React Native CLI (bare) project
- Android SDK + JDK (for Android)
- Xcode (for iOS)
- Phone and computer on same WiFi (for real device)

## How it works

```
npx react-native starship
├── Detect platforms (android/, ios/)
├── Detect WiFi IP
├── Android: build APK → serve on :8888 → show QR
├── iOS: build → install on simulator
├── Start Metro (--host 0.0.0.0)
└── Interactive mode (a/i/j/r/d/q)
```

- Reads `applicationId` from `build.gradle`
- Uses `adb reverse tcp:8081` for emulator connectivity
- Doesn't modify `metro.config.js` or any source files
- Single dependency: `qrcode-terminal`

## License

MIT

## Author

**Hasan Gönen** — [@hasangonen91](https://www.linkedin.com/in/hasangonen91/)

- LinkedIn: [linkedin.com/in/hasangonen91](https://www.linkedin.com/in/hasangonen91/)
- GitHub: [github.com/hasangonen91](https://github.com/hasangonen91)
- npm: [npmjs.com/~hasangonen91](https://www.npmjs.com/~hasangonen91)
