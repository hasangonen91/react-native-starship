# I built "Expo Go" for bare React Native CLI projects — wireless install via QR, zero config

Hey everyone,

I was frustrated with the bare RN CLI workflow — USB cables, manual IP config, slow iteration. Expo Go solves this beautifully, but it doesn't work with custom native modules.

So I built **Starship** — one command, and your app is on your phone over WiFi:

```
npx react-native starship
```

It builds your APK, shows a QR code, you scan it, and the app auto-connects to Metro. No "Debug server host" setup, no cables.

## How it compares:

| Feature | Expo Go | RN CLI | Starship |
|---------|---------|--------|----------|
| Custom native modules | ❌ | ✅ | ✅ |
| Wireless install (QR) | ✅ | ❌ | ✅ |
| Zero config | ✅ | ❌ | ✅ |
| No USB needed | ✅ | ❌ | ✅ |
| Multi-device deploy | ❌ | ❌ | ✅ |
| Build caching | ❌ | ❌ | ✅ |
| Device info in terminal | ❌ | ❌ | ✅ |

## What it does:

- Builds debug APK with your IP embedded (auto Metro connection — no manual setup)
- Serves via QR code — scan and install
- APK caching (skip rebuild if native code unchanged — instant restart)
- Deploys to all connected devices at once
- Shows device model + OS in terminal when connected
- iOS simulator support (auto build + launch)
- Build time tracking with history comparison
- Fast Refresh over WiFi
- Interactive shortcuts (r = reload, d = dev menu, l = list devices)

## Install:

```
yarn add react-native-starship
npx react-native starship
```

Single dependency (qrcode-terminal). Works with any bare RN CLI project. Zero config.

## Links:

- GitHub: https://github.com/hasangonen91/react-native-starship
- npm: https://www.npmjs.com/package/react-native-starship

Would love feedback — what features would make this more useful for your workflow?
