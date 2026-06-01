# 🚀 Starship

[![npm version](https://img.shields.io/npm/v/react-native-starship.svg)](https://npmjs.com/package/react-native-starship)
[![npm downloads](https://img.shields.io/npm/dm/react-native-starship.svg)](https://npmjs.com/package/react-native-starship)
[![license](https://img.shields.io/npm/l/react-native-starship.svg)](https://github.com/hasangonen91/react-native-starship/blob/main/LICENSE)

Launch your React Native app to any device over WiFi. No cables, no Expo — just scan and fly.

<p align="center">
  <img src="https://raw.githubusercontent.com/hasangonen91/react-native-starship/main/assets/demo.gif" alt="Starship Demo" width="700">
</p>

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

### Android (real device via QR — fully wireless)

1. Scans connected devices (physical + emulators)
2. Auto-runs `adb reverse` on all devices
3. Builds debug APK with Metro IP embedded (uses cache if source unchanged)
4. Installs APK on **all** connected devices
5. Serves APK on your local network
6. Shows QR code in terminal — scan with phone camera
7. Phone downloads & installs APK, app auto-connects to Metro
8. Fast Refresh over WiFi — edit code, see changes instantly
9. Device model + OS shown in terminal on connection

**No manual "Debug server host" setup needed** — Starship embeds your IP directly into the APK.

### iOS (simulator — automatic)

1. Detects `.xcworkspace` and scheme
2. Finds or boots an iPhone simulator
3. Builds with `xcodebuild` for simulator
4. Installs and launches automatically
5. Fast Refresh works immediately

### iOS (physical device — Apple limitation)

Apple does **not** allow wireless app installation on physical iPhones/iPads without:
- An Apple Developer account ($99/year)
- A provisioning profile with the device's UDID registered
- Code signing with a valid certificate

This is a hardware-level restriction enforced by iOS — no third-party tool or intermediary app can bypass it. Unlike Android, there is no "Install from unknown sources" option on iOS.

**Workaround for physical iPhone testing:**
1. Connect iPhone via USB once
2. Run `npx react-native run-ios --device` (requires Apple Developer account, free tier works for 7 days)
3. After first install, disconnect USB — Fast Refresh works over WiFi from that point on

| Method | Requirement | Wireless after setup? |
|--------|-------------|----------------------|
| Simulator | Xcode (free) | N/A (runs on Mac) |
| USB + Xcode | Apple Developer (free, 7-day cert) | ✅ Yes |
| TestFlight | Apple Developer ($99/year) | ✅ Yes |
| Ad-hoc | Developer + UDID registration | ✅ Yes |

### Both platforms

- Metro bundler starts with `--host 0.0.0.0` (network accessible)
- Single Metro instance serves both Android and iOS
- Interactive keyboard shortcuts for quick actions
- Build time tracking with history comparison
- Device identification (model, OS version) shown in terminal

## Interactive Shortcuts

While Starship is running, press these keys:

| Key | Action |
|-----|--------|
| `a` | Run on Android — installs APK on **all** connected devices |
| `i` | Run on iOS — builds and launches on simulator |
| `j` | Open DevTools — triggers Dev Menu on both platforms |
| `r` | Reload — sends reload command to Metro |
| `d` | Dev Menu — opens React Native Dev Menu |
| `l` | List devices — show USB + WiFi connected devices |
| `h` | Help — show shortcuts again |
| `q` | Quit — graceful shutdown |

## Options

| Flag | Description |
|------|-------------|
| `--port, -p <port>` | Metro bundler port (default: 8081) |
| `--server-port <port>` | HTTP server port for APK download (default: 8888) |
| `--watch, -w` | Auto-rebuild on native source changes (.java/.kt/.xml) |
| `--ios, -i` | Build only for iOS simulator |
| `--no-cache` | Skip APK cache, force a fresh build |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

### Examples

```bash
# Default — Metro on 8081, HTTP on 8888
starship

# Custom Metro port
starship --port 8082

# Watch mode + force rebuild
starship --watch --no-cache

# iOS simulator only
starship --ios
```

## Features

- **Zero config** — just run it in any RN CLI project
- **Auto-detect platforms** — builds Android and iOS if both exist
- **Auto Metro connection** — IP embedded in APK, no manual setup needed
- **APK cache** — skips rebuild if native source hasn't changed (instant restart)
- **Multi-device support** — installs and launches on all connected devices at once
- **Device identification** — shows device model, OS version, and IP in terminal
- **Connected device display** — shows all physical devices, emulators, and WiFi devices
- **Automatic adb reverse** — runs `adb reverse` on all devices for Metro + HTTP ports
- **Custom port** — `--port` flag for Metro, `--server-port` for HTTP server
- **Build time tracking** — tracks build duration, shows comparison with previous builds
- **QR code APK distribution** — no USB cable needed for Android
- **iOS simulator support** — auto build + install + launch
- **Interactive mode** — keyboard shortcuts for common actions
- **Fast Refresh** — edit JS, see changes instantly (no app restart)
- **Watch mode** — auto-rebuild APK on native code changes
- **Beautiful terminal UI** — progress, errors, and status at a glance
- **Download notifications** — see when a device downloads the APK in real-time
- **App icon on download page** — shows your app's actual icon
- **Graceful shutdown** — Ctrl+C cleans up all processes

## Prerequisites

- React Native CLI (bare) project
- Android SDK + JDK (for Android)
- Xcode (for iOS simulator)
- Phone and computer on same WiFi (for real device)

## How it works

```
npx react-native starship
├── Detect platforms (android/, ios/)
├── Detect WiFi IP
├── Scan connected devices
├── Auto adb reverse (all devices, all ports)
├── Android: check cache → inject IP → build APK → install → serve → QR
├── iOS: find simulator → build → install → launch
├── Start Metro (--host 0.0.0.0 --port <port>)
├── Track build time + compare with history
├── Show device info on connection (model, OS)
└── Interactive mode (a/i/j/r/d/l/q)
```

**Android wireless flow:**
- Injects a `ContentProvider` at build time that auto-sets Metro host in SharedPreferences
- App reports device model (`Build.MODEL` + `Build.BRAND`) back to Starship on launch
- No manual "Debug server host & port" configuration needed

**Technical details:**
- Reads `applicationId` from `build.gradle`
- Uses `adb reverse` on all USB-connected devices for Metro + HTTP ports
- APK cache stored in `.starship-cache/` (add to `.gitignore`)
- Build history tracked for performance monitoring
- Injected files are cleaned up after build (no project pollution)
- Doesn't modify `metro.config.js` or any permanent source files
- Single dependency: `qrcode-terminal`

## Security

Starship is a **development-only** tool. Keep these in mind:

- The HTTP server binds to `0.0.0.0` — anyone on your local network can access the download page
- Debug APKs are inherently insecure (`debuggable=true`, no code obfuscation)
- Metro bundler is network-accessible by design (required for wireless development)
- The embedded IP in the APK is only valid for your current network session
- Input from devices is sanitized (size-limited, special characters stripped)
- Never use Starship in production or on untrusted networks (public WiFi, coffee shops, etc.)

**Best practice**: Use on your home/office WiFi only. The tool is designed for local development, not deployment.

## Android vs iOS — Platform Comparison

| Feature | Android | iOS |
|---------|---------|-----|
| Wireless install (no USB ever) | ✅ QR scan | ❌ Apple restriction |
| Simulator/Emulator | ✅ | ✅ |
| Fast Refresh over WiFi | ✅ | ✅ (after first USB install) |
| Multi-device deploy | ✅ | Simulator only |
| Auto Metro connection | ✅ (IP embedded) | ✅ (localhost) |
| Device model in terminal | ✅ | Simulator name |
| Build caching | ✅ | ❌ (xcodebuild manages own cache) |

## Why not Expo?

Starship is for projects that **can't use Expo** — custom native modules, specific native SDKs, brownfield apps, or teams that prefer the bare React Native CLI workflow. If Expo works for you, use Expo. If it doesn't, Starship gives you the same wireless development experience without ejecting or compromising on native code.

## License

MIT

## Author

**Hasan Gönen** — [@hasangonen91](https://www.linkedin.com/in/hasangonen91/)

- LinkedIn: [linkedin.com/in/hasangonen91](https://www.linkedin.com/in/hasangonen91/)
- GitHub: [github.com/hasangonen91](https://github.com/hasangonen91)
- npm: [npmjs.com/~hasangonen91](https://www.npmjs.com/~hasangonen91)
