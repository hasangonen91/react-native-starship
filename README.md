# 🚀 Starship

[![npm version](https://img.shields.io/npm/v/react-native-starship.svg)](https://npmjs.com/package/react-native-starship)
[![npm downloads](https://img.shields.io/npm/dm/react-native-starship.svg)](https://npmjs.com/package/react-native-starship)
[![license](https://img.shields.io/npm/l/react-native-starship.svg)](https://github.com/hasangonen91/react-native-starship/blob/main/LICENSE)

### Expo Go, but for bare React Native projects with custom native code.

No cables. No Expo. Just scan the QR code and your app is running on your phone.

<p align="center">
  <img src="https://raw.githubusercontent.com/hasangonen91/react-native-starship/main/assets/demo.gif" alt="Starship Demo" width="700">
</p>

## Why?

If you use **bare React Native CLI** (custom native modules, specific SDKs, brownfield apps), you lost the wireless development magic that Expo Go provides. You're stuck with USB cables, manual IP config, and slow iteration cycles.

**Starship brings it back.** One command, and your app is on your phone over WiFi.

## Starship vs Expo Go vs React Native CLI

| Feature | Expo Go | RN CLI | Starship |
|---------|---------|--------|----------|
| Custom native modules | ❌ | ✅ | ✅ |
| Wireless install (QR) | ✅ | ❌ | ✅ |
| Fast Refresh | ✅ | ✅ | ✅ |
| Zero config | ✅ | ❌ | ✅ |
| No USB cable needed | ✅ | ❌ | ✅ |
| Auto Metro connection | ✅ | ❌ | ✅ |
| Multi-device deploy | ❌ | ❌ | ✅ |
| Build caching | ❌ | ❌ | ✅ |
| Device info in terminal | ❌ | ❌ | ✅ |
| Works with any native code | ❌ | ✅ | ✅ |

**TL;DR:** Expo Go convenience + bare RN CLI power = Starship.

## Installation

```bash
yarn add react-native-starship
# or
npm install react-native-starship
```

Auto-registers as a React Native CLI plugin. Zero config needed.

## Usage

```bash
npx react-native starship
```

That's it. One command:
1. Builds your app
2. Shows QR code
3. Phone scans → installs → runs
4. Fast Refresh over WiFi

## Build Commands (NEW in v1.2)

```bash
starship build apk                # Debug APK
starship build apk --release      # Signed release APK
starship build aab                # Android App Bundle (Play Store)
starship build ipa                # iOS IPA
starship build ipa --export ad-hoc -o ./dist
```

| Command | Output | Use case |
|---------|--------|----------|
| `build apk` | Debug APK | Testing |
| `build apk --release` | Signed APK | Direct distribution |
| `build aab` | App Bundle | Google Play Store |
| `build ipa` | IPA archive | TestFlight / Ad-hoc |

Also:
```bash
starship clean                    # Clear build cache
starship devices                  # List connected devices
```

## What happens

### Android (fully wireless — no USB ever)

1. Builds debug APK with your IP embedded (cached if unchanged)
2. Serves APK over local network
3. Shows QR code in terminal
4. Phone scans → downloads → installs → app auto-connects to Metro
5. Edit code → see changes instantly via Fast Refresh

**No manual "Debug server host" setup needed.** Starship embeds your IP directly into the APK.

### iOS (simulator)

1. Builds with `xcodebuild`
2. Installs and launches on simulator automatically
3. Fast Refresh works immediately

### iOS (physical device)

Apple does **not** allow wireless app installation without a developer account. This is a hardware-level restriction — no tool can bypass it.

| Method | Requirement | Wireless after setup? |
|--------|-------------|----------------------|
| Simulator | Xcode (free) | N/A |
| USB + Xcode | Apple Developer (free, 7-day cert) | ✅ |
| TestFlight | Apple Developer ($99/year) | ✅ |

**Workaround:** Connect iPhone via USB once, install with Xcode, disconnect — Fast Refresh works over WiFi from then on.

## Cloud iOS Build (No Mac Needed) — NEW in v1.3

Build and deploy iOS apps from **Windows or Linux**. No Mac required.

```bash
# One-time setup (5 min)
starship cloud init

# Build IPA via GitHub Actions (free)
starship build ipa --cloud

# Submit to App Store
starship build ipa --cloud --export app-store --submit
```

**How it works:**
1. `cloud init` → uploads Apple certs to GitHub Secrets + creates workflow
2. `--cloud` → triggers GitHub Actions macOS runner (free for public repos)
3. IPA is built, downloaded, and served via QR code
4. iPhone scans QR → installs → done

**Requirements:**
- GitHub account (free)
- Apple Developer account ($99/year)
- No Mac, no Xcode, no macOS knowledge needed

**Gate system** — each step unlocks the next:
```
cloud init  →  build ipa --cloud  →  --submit
   [1]              [2]                 [3]
```

## Interactive Shortcuts

| Key | Action |
|-----|--------|
| `a` | Install APK on all connected Android devices |
| `i` | Build and launch on iOS simulator |
| `r` | Reload app |
| `d` | Open Dev Menu |
| `l` | List all connected devices (USB + WiFi) |
| `q` | Quit |

## Options

```bash
starship                        # default
starship --port 8082            # custom Metro port
starship --watch                # auto-rebuild on native changes
starship --no-cache             # force fresh build
starship --ios                  # iOS simulator only
starship --server-port 9999     # custom HTTP server port
```

## Features

- **Zero config** — works in any bare RN CLI project
- **Auto Metro connection** — no manual IP setup on phone
- **APK cache** — instant restart if native code unchanged
- **Multi-device** — deploy to all connected devices at once
- **Device identification** — model + OS shown in terminal
- **Build time tracking** — duration comparison with previous builds
- **Watch mode** — auto-rebuild on .java/.kt/.xml changes
- **QR code distribution** — scan and install, no cables
- **Custom ports** — `--port` for Metro, `--server-port` for HTTP
- **Graceful shutdown** — Ctrl+C cleans up everything

## Security

Development-only tool. Safety measures:

- ContentProvider only runs in debug builds (`FLAG_DEBUGGABLE` guard)
- Injected files cleaned up after build (no project pollution)
- Release builds (`assembleRelease`) never include Starship code
- Input sanitization on all endpoints
- Google Play rejects `debuggable=true` APKs automatically

**Use on trusted networks only** (home/office WiFi).

## How it works

```
npx react-native starship
├── Detect WiFi IP + connected devices
├── Auto adb reverse on all devices
├── Build APK (with IP embedded via ContentProvider)
├── Install on all devices + serve via HTTP
├── Show QR code → phone scans → installs → auto-connects
├── Start Metro (--host 0.0.0.0)
└── Fast Refresh over WiFi — edit and see changes instantly
```

## License

MIT

## Author

**Hasan Gönen** — [@hasangonen91](https://github.com/hasangonen91)

- [LinkedIn](https://www.linkedin.com/in/hasangonen91/)
- [npm](https://www.npmjs.com/~hasangonen91)
