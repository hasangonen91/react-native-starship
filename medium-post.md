# I Built Expo Go for Bare React Native — No Cables, No Expo Account, Just QR

If you use bare React Native CLI with custom native modules, you know the pain: USB cables, manual IP configuration, `adb reverse`, shaking your phone to set debug host...

Meanwhile, Expo Go users just scan a QR code and they're running.

I wanted that same experience — but for projects with custom native code. So I built **Starship**.

## The Problem

Every time you want to test on a physical Android device with bare React Native:

1. Plug in USB cable
2. Run `adb reverse tcp:8081 tcp:8081`
3. Build APK
4. Install APK
5. Open app → "Unable to load script"
6. Shake phone → Settings → Type your IP manually
7. Shake → Reload
8. Repeat when your IP changes

With Expo Go, you just scan a QR code. But Expo Go doesn't support custom native modules.

## The Solution

```bash
yarn add react-native-starship
npx react-native starship
```

One command. It:
- Builds your debug APK with your local IP **embedded** (no manual setup)
- Shows a QR code in terminal
- You scan with your phone camera
- Phone downloads APK, installs it, app opens
- App **auto-connects to Metro** — Fast Refresh works immediately

No USB. No IP typing. No shake-settings-reload dance.

## How It Compares

| Feature | Expo Go | RN CLI | Starship |
|---------|---------|--------|----------|
| Custom native modules | ❌ | ✅ | ✅ |
| Wireless install (QR) | ✅ | ❌ | ✅ |
| Zero config | ✅ | ❌ | ✅ |
| No USB needed | ✅ | ❌ | ✅ |
| Multi-device deploy | ❌ | ❌ | ✅ |
| Build caching | ❌ | ❌ | ✅ |

## Features That Save Real Time

**APK Caching** — First build takes ~60 seconds. After that, if you only changed JavaScript, it skips the native build entirely. Instant restart.

**Multi-Device** — Have 3 test phones? They all get the APK at once. `adb reverse` runs on all of them automatically.

**Device Identification** — Terminal shows which device connected:
```
📱 Xiaomi Mi 9 SE (Android 11) connected — app is running
```

**Build Time Tracking** — Shows how long each build took and compares with previous builds. You know instantly if something slowed down your native build.

## How the Auto-Connect Works

The biggest pain point with bare RN is the "Unable to load script" screen. The app doesn't know where Metro is running.

Starship solves this by injecting a tiny `ContentProvider` at build time that:
1. Writes your computer's IP to SharedPreferences on first app launch
2. React Native reads this and connects to Metro automatically
3. The ContentProvider only exists in debug builds (runtime safety check included)

Release builds are never affected. Google Play would reject a `debuggable=true` APK anyway.

## What's Coming

- `starship build apk/aab/ipa` — Store-ready builds
- `starship --tunnel` — Access from outside your local network
- `starship update` — OTA updates (free CodePush alternative)
- `starship doctor` — Environment diagnostics

## Try It

```bash
yarn add react-native-starship
npx react-native starship
```

Works with any bare React Native CLI project. Single dependency. Zero config.

**GitHub:** https://github.com/hasangonen91/react-native-starship
**npm:** https://www.npmjs.com/package/react-native-starship
**LinkedIn:** https://www.linkedin.com/in/hasangonen91/

---

*If you've been stuck with USB cables and manual IP config, give it a try. It takes 30 seconds to install and the first build is the only slow one — after that it's instant.*
