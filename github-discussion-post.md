# 🚀 Introducing Starship v1.1 — Wireless Deploy for Bare React Native

Hey React Native community!

I've been working on **Starship** — a zero-config tool that brings Expo Go's wireless development experience to bare React Native CLI projects.

## What does it do?

```bash
npx react-native starship
```

Builds APK → Shows QR code → Phone scans → App runs. No USB cable, no manual IP setup.

## v1.1 Highlights

- **Auto Metro Connection** — Your IP is embedded in the APK at build time. No more "Unable to load script" → shake → settings → type IP. It just works.
- **APK Caching** — Skips rebuild if native code hasn't changed. First build ~60s, after that it's instant.
- **Multi-Device** — All connected devices get the APK at once.
- **Device Identification** — Shows device model and OS version when it connects.
- **Build Time Tracking** — Compares with previous builds so you spot regressions.

## Coming in v1.2

- `starship build apk/aab/ipa` — Store-ready builds from CLI
- `starship --tunnel` — Works outside your local network
- `starship update` — Free, self-hosted OTA updates (CodePush alternative)

## Feedback Welcome

I'd love to know:
- What's your biggest pain point with the bare RN CLI workflow?
- Would OTA updates (free CodePush alternative) be useful for your team?
- Any edge cases you'd want handled (monorepos, custom metro configs, etc.)?

**Install:** `yarn add react-native-starship`
**Docs:** https://github.com/hasangonen91/react-native-starship

Thanks for checking it out! 🙏
