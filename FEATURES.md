# Starship — Feature Roadmap

## v1.1.0 (Current) ✅

### Core
- [x] Zero-config React Native CLI plugin
- [x] Auto-detect platforms (android/, ios/)
- [x] WiFi IP detection
- [x] Interactive keyboard shortcuts (a/i/j/r/d/l/q)
- [x] Beautiful terminal UI with progress spinners
- [x] Graceful shutdown (Ctrl+C)

### Android
- [x] Debug APK build (`assembleDebug`)
- [x] QR code APK distribution over WiFi
- [x] Auto Metro connection (IP embedded via ContentProvider)
- [x] Multi-device install (all USB devices at once)
- [x] Automatic `adb reverse` on all devices
- [x] APK cache (skip rebuild if source unchanged)
- [x] Device identification (model, OS) in terminal
- [x] Download/connection notifications
- [x] Watch mode (auto-rebuild on native changes)

### iOS
- [x] Simulator auto-detect + boot
- [x] `xcodebuild` build for simulator
- [x] Auto install + launch on simulator
- [x] Fast Refresh over localhost

### Infrastructure
- [x] Build time tracking + history comparison
- [x] `--port` flag (custom Metro port)
- [x] `--server-port` flag (custom HTTP port)
- [x] `--no-cache` flag (force rebuild)
- [x] `--watch` flag (native file watcher)
- [x] Input sanitization on device-info endpoint
- [x] Runtime safety check (FLAG_DEBUGGABLE guard)

---

## v1.2.0 (Next) 🚧

### Build Variants
- [ ] `starship build apk` — Generate signed/unsigned debug APK
- [ ] `starship build aab` — Generate Android App Bundle (Play Store format)
- [ ] `starship build ipa` — Generate IPA for TestFlight/Ad-hoc distribution
- [ ] Build output directory (`--output ./builds/`)
- [ ] Keystore configuration for signed builds
- [ ] Build variant selection (`--variant release/debug/staging`)

### Remote Access (Outside Local Network)
- [ ] Tunnel mode (`--tunnel`) — expose Metro + HTTP server via secure tunnel
- [ ] Auto-generate public URL (no ngrok account needed)
- [ ] QR code with tunnel URL (works from anywhere)
- [ ] Tunnel authentication (token-based access)
- [ ] Tunnel status indicator in terminal
- [ ] Fallback to local mode if tunnel fails

---

## v1.3.0 (Planned) 📋

### Expo-Parity Features
- [ ] OTA updates — push JS bundle updates without rebuild
- [ ] Shake menu replacement — custom dev menu overlay
- [ ] Error overlay — better crash reporting in terminal
- [ ] Environment variables — `.env` support in builds
- [ ] Build profiles — named configurations (dev/staging/prod)
- [ ] Asset bundling — optimize images/fonts during build
- [ ] EAS-like build commands — `starship build --profile production`

### Developer Experience
- [ ] `starship init` — setup wizard for new projects
- [ ] `starship doctor` — diagnose common issues (SDK, JDK, Xcode, etc.)
- [ ] `starship clean` — clear all caches + build artifacts
- [ ] `starship devices` — standalone device listing command
- [ ] `starship log` — stream device logs (adb logcat filtered)
- [ ] Config file (`.starshiprc`) — persist options per project

### Advanced
- [ ] Flipper integration — auto-connect debugger
- [ ] Performance monitoring — bundle size tracking
- [ ] Multiple app variant support (flavors/schemes)
- [ ] CI/CD mode (`--ci`) — non-interactive, exit codes
- [ ] Plugin system — extend with custom commands

---

## Feature Comparison: Starship vs Expo

| Feature | Expo | Starship | Status |
|---------|------|----------|--------|
| Wireless Android install | ✅ Expo Go | ✅ QR + APK | Done |
| Wireless iOS install | ✅ Expo Go | ❌ Apple restriction | N/A |
| iOS simulator | ✅ | ✅ | Done |
| Custom native code | ❌ (needs dev client) | ✅ | Done |
| Fast Refresh | ✅ | ✅ | Done |
| Zero config | ✅ | ✅ | Done |
| OTA updates | ✅ EAS Update | ⬜ | v1.3 |
| Build APK | ✅ EAS Build | ⬜ | v1.2 |
| Build AAB | ✅ EAS Build | ⬜ | v1.2 |
| Build IPA | ✅ EAS Build | ⬜ | v1.2 |
| Tunnel (remote access) | ✅ `--tunnel` | ⬜ | v1.2 |
| Error overlay | ✅ | ⬜ | v1.3 |
| Environment variables | ✅ | ⬜ | v1.3 |
| Build profiles | ✅ eas.json | ⬜ | v1.3 |
| Doctor/diagnostics | ✅ `expo doctor` | ⬜ | v1.3 |
| Cloud builds | ✅ EAS Build | ❌ | Not planned |
| App Store submit | ✅ EAS Submit | ❌ | Not planned |
| Push notifications | ✅ Expo Push | ❌ | Not planned |
| Managed workflow | ✅ | ❌ | Not planned |

---

## v1.2.0 Implementation Details

### `starship build apk`

```bash
starship build apk                    # debug APK
starship build apk --release          # release APK (needs keystore)
starship build apk --output ./dist    # custom output path
```

- Runs `./gradlew assembleDebug` or `assembleRelease`
- Copies APK to output directory with timestamp
- Shows file size + build time
- Opens output folder

### `starship build aab`

```bash
starship build aab                    # release AAB for Play Store
starship build aab --output ./dist
```

- Runs `./gradlew bundleRelease`
- Requires signing config in `build.gradle`
- Validates AAB with `bundletool` if available
- Shows upload-ready path

### `starship build ipa`

```bash
starship build ipa                    # archive + export IPA
starship build ipa --export-method ad-hoc
starship build ipa --export-method app-store
```

- Runs `xcodebuild archive` + `xcodebuild -exportArchive`
- Requires valid provisioning profile + signing identity
- Export methods: `development`, `ad-hoc`, `app-store`, `enterprise`
- Shows IPA path + size

### `starship --tunnel` (Remote Access)

```bash
starship --tunnel                     # start with tunnel
starship --tunnel --tunnel-port 443   # custom tunnel port
```

- Uses `localtunnel` or built-in TCP tunnel
- Generates random subdomain: `https://abc123.starship.dev`
- Secures with auto-generated token (shown in terminal)
- QR code points to tunnel URL instead of local IP
- Works across different networks (office → home, etc.)
- Metro + HTTP server both tunneled
- Token required for APK download (prevents unauthorized access)

---

## Not Planned (Out of Scope)

These features are intentionally excluded:

- **Cloud builds** — Use EAS Build, Bitrise, or GitHub Actions
- **App Store submission** — Use EAS Submit or Fastlane
- **Push notifications** — Use Firebase, OneSignal, or Expo Push
- **Managed workflow** — Starship is for bare RN CLI projects only
- **Code signing management** — Use Fastlane Match or manual setup
- **Analytics/crash reporting** — Use Sentry, Bugsnag, or Firebase
