# Starship — Feature Roadmap

## v1.1.1 (Current) ✅

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

## v1.2.0 — Build & Distribute 🚧

### Cloud iOS Build (No Mac Required)
- [ ] `starship build ios --cloud` — Build IPA via GitHub Actions (free macOS runner)
- [ ] `starship cloud init` — Generate `.github/workflows/ios-build.yml`
- [ ] Interactive setup wizard (Apple Developer certs → GitHub Secrets)
- [ ] Auto-upload to TestFlight on success
- [ ] Download IPA artifact link in terminal
- [ ] Support for GitHub Actions, GitLab CI, Bitrise runners
- [ ] Document: "iOS build without owning a Mac" guide

### iOS Wireless Deploy (QR Install on iPhone)
- [ ] `starship ios setup` — One-time Apple ID login + 2FA
- [ ] Auto-generate development certificate via Apple API
- [ ] UDID collection via Safari config profile (no USB needed)
- [ ] Auto-create provisioning profile (cert + UDID + bundle ID)
- [ ] IPA build + code sign (local Mac or cloud)
- [ ] HTTPS server with self-signed cert (auto trust prompt)
- [ ] `itms-services://` manifest plist generation
- [ ] QR code for iOS install (same flow as Android)
- [ ] Auto-renew expired certificates (7-day free / 1-year paid)
- [ ] Store signing credentials in `.starship/ios-signing/`
- [ ] EU sideloading support (iOS 17.4+ DMA direct install)
- [ ] SideStore source integration for sideload users

### Build Commands
- [ ] `starship build apk` — Debug/Release APK
- [ ] `starship build aab` — Android App Bundle (Play Store)
- [ ] `starship build ipa` — IPA (TestFlight/Ad-hoc)
- [ ] `--output <path>` — Custom output directory
- [ ] `--variant <name>` — Build variant (debug/release/staging)
- [ ] Keystore configuration (interactive setup wizard)
- [ ] Auto-increment version code/build number
- [ ] Build size report (before/after comparison)

### Remote Access (Tunnel)
- [ ] `--tunnel` flag — Expose over internet (no same WiFi needed)
- [ ] Auto-generate secure public URL
- [ ] Token-based authentication for tunnel access
- [ ] QR code with tunnel URL
- [ ] Works across different networks (office ↔ home ↔ client)
- [ ] Tunnel status + bandwidth indicator in terminal
- [ ] Auto-fallback to local mode on tunnel failure

### Preview Sharing
- [ ] `starship share` — Generate shareable link for QA/PM
- [ ] Expiring links (1h, 24h, 7d)
- [ ] Download count tracking
- [ ] Password-protected downloads
- [ ] Slack/Teams webhook notification on download

---

## v1.3.0 — Developer Experience 📋

### OTA Updates (Over-The-Air)
- [ ] `starship update` — Push JS bundle without rebuild
- [ ] Channel-based updates (dev/staging/production)
- [ ] Rollback support (`starship update --rollback`)
- [ ] Update size shown before push
- [ ] Device receives update on next app open
- [ ] Version pinning (update only specific app versions)

### Environment & Configuration
- [ ] `.env` support — auto-inject env vars into build
- [ ] `.starshiprc` — project-level config file
- [ ] Build profiles (dev/staging/prod in one config)
- [ ] Per-profile env variables
- [ ] Secret management (encrypted local vault)

### Diagnostics & Tooling
- [ ] `starship doctor` — Check environment (SDK, JDK, Xcode, adb)
- [ ] `starship clean` — Clear all caches + build artifacts
- [ ] `starship devices` — Standalone device list command
- [ ] `starship log` — Stream device logs (filtered logcat/console)
- [ ] `starship log --crash` — Show only crash logs
- [ ] `starship info` — Show project config, versions, paths

---

## v1.4.0 — Team & CI 📋

### Team Collaboration
- [ ] QR code on web dashboard (team members scan from browser)
- [ ] Device registration (track who tested on what)
- [ ] Build history web view
- [ ] Comment/feedback from device (shake → send screenshot + note)
- [ ] Tester groups (send different builds to different teams)

### CI/CD Integration
- [ ] `--ci` flag — Non-interactive mode, proper exit codes
- [ ] JSON output mode (`--json`) for pipeline parsing
- [ ] GitHub Actions template (`starship-action`)
- [ ] GitLab CI template
- [ ] Bitrise step
- [ ] Build artifact upload (S3, GCS, Azure Blob)
- [ ] Webhook on build complete (Slack, Discord, Teams)

### Performance Monitoring
- [ ] Bundle size tracking per build
- [ ] Bundle size diff on PR (via CI)
- [ ] Startup time measurement on device
- [ ] Build speed regression alerts
- [ ] Native module size impact report

---

## v1.5.0 — Advanced 📋

### Smart Builds
- [ ] Incremental native builds (only rebuild changed modules)
- [ ] Parallel iOS + Android builds with shared Metro
- [ ] Build artifact sharing between team members (download teammate's APK)
- [ ] Gradle daemon keep-alive between builds
- [ ] Prebuild cache for node_modules native deps

### Developer Ergonomics
- [ ] `starship init` — Setup wizard for new projects
- [ ] `starship eject` — Remove Starship cleanly from project
- [ ] Plugin system — extend with custom commands
- [ ] Custom keyboard shortcuts config
- [ ] Terminal dashboard mode (split pane: Metro + device logs)
- [ ] Push notification testing tool (send test push from terminal)

### Platform Extensions
- [ ] macOS app support (React Native macOS)
- [ ] Windows app support (React Native Windows)
- [ ] Web build support (`react-native-web` → serve)
- [ ] TV app support (tvOS, Android TV)

---

## Feature Comparison: Starship vs Expo vs Others

| Feature | Expo | Starship | Fastlane | RN CLI |
|---------|------|----------|----------|--------|
| Wireless install (QR) | ✅ | ✅ | ❌ | ❌ |
| Custom native code | ❌* | ✅ | ✅ | ✅ |
| Zero config | ✅ | ✅ | ❌ | ❌ |
| Build APK/AAB | ✅ (cloud) | ⬜ v1.2 | ✅ | ✅ |
| Build IPA | ✅ (cloud) | ⬜ v1.2 | ✅ | ✅ |
| OTA updates | ✅ | ⬜ v1.3 | ❌ | ❌ |
| Tunnel (remote) | ✅ | ⬜ v1.2 | ❌ | ❌ |
| Multi-device | ❌ | ✅ | ❌ | ❌ |
| Build cache | ❌ | ✅ | ❌ | ❌ |
| Device info | ❌ | ✅ | ❌ | ❌ |
| Preview sharing | ✅ | ⬜ v1.2 | ✅ | ❌ |
| Env variables | ✅ | ⬜ v1.3 | ✅ | ❌ |
| Build profiles | ✅ | ⬜ v1.3 | ✅ | ❌ |
| Doctor/diagnostics | ✅ | ⬜ v1.3 | ❌ | ✅ |
| CI/CD mode | ✅ | ⬜ v1.4 | ✅ | ❌ |
| Bundle size tracking | ❌ | ⬜ v1.4 | ❌ | ❌ |
| Local builds (free) | ❌** | ✅ | ✅ | ✅ |
| No account needed | ❌ | ✅ | ✅ | ✅ |

\* Expo requires Dev Client for native modules
\** EAS Build requires paid plan for priority; local builds possible with `expo prebuild`

---

## Implementation Priority (v1.2.0)

### Phase 1: Build Commands (Week 1)
```
starship build apk                    # debug APK
starship build apk --release          # signed release APK
starship build apk --output ./dist    # custom output
starship build aab                    # Play Store bundle
starship build ipa                    # iOS archive
starship build ipa --export ad-hoc    # Ad-hoc distribution
```

### Phase 2: Tunnel (Week 1-2)
```
starship --tunnel                     # local + tunnel
starship --tunnel-only                # tunnel only (no local)
```

### Phase 3: Preview Sharing (Week 2)
```
starship share                        # generate link
starship share --expires 24h          # expiring link
starship share --password secret123   # protected link
```

---

### Expo Dev Client Compatibility
- [ ] Test with `expo-dev-client` projects (`expo prebuild`)
- [ ] Handle Expo's dev launcher Metro resolution
- [ ] Document Expo + Starship hybrid workflow
- [ ] `starship --expo` flag for Expo-aware mode

### Monorepo Support
- [ ] Test with yarn workspaces / npm workspaces / pnpm
- [ ] Test with turborepo and nx
- [ ] `--root <path>` flag for custom project root
- [ ] Auto-detect monorepo structure (look for workspace config)
- [ ] Respect existing `metro.config.js` watchFolders
- [ ] Document monorepo setup guide

---

## Not Planned (Out of Scope)

- **Cloud builds** — Use EAS Build, Bitrise, GitHub Actions
- **App Store submission** — Use EAS Submit, Fastlane, or manual
- **Push notification service** — Use Firebase, OneSignal, Expo Push
- **Managed workflow** — Starship is bare RN CLI only (but works with `expo prebuild`)
- **Analytics** — Use Sentry, Bugsnag, Firebase Analytics
- **Monetization tools** — Use RevenueCat, Adapty
- **Backend/API** — Out of scope entirely
