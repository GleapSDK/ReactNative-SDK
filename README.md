# Gleap React Native SDK

![Gleap ReactNative SDK Intro](https://raw.githubusercontent.com/GleapSDK/Gleap-iOS-SDK/main/Resources/GleapHeaderImage.png)

Add AI-native customer support, live chat, in-app bug reporting, a help center and surveys to your React Native apps with [Gleap](https://www.gleap.ai). Gleap is an Intercom alternative for software teams that connects customer conversations and feedback with product development.

[SDK documentation](https://docs.gleap.ai/documentation/reactnative/README) · [Website](https://www.gleap.ai) · [Plans and pricing](https://www.gleap.ai/pricing)

## Installation

```sh
npm install react-native-gleapsdk
cd ios && pod install
```

### iOS requirements

- iOS 15.0 or later
- React Native 0.75 or later (Expo SDK 52 or later)

The native Gleap iOS SDK is installed with Swift Package Manager: `pod install` adds the [Gleap-iOS-SDK](https://github.com/GleapSDK/Gleap-iOS-SDK) package (product `Gleap`) to the `Pods` project through React Native's `spm_dependency`, and Xcode resolves it on the next build. You don't add the package to your app yourself. Your Podfile must call `react_native_post_install` in its `post_install` hook, as the React Native and Expo templates do.

`pod install` logs a warning that a Swift package with static linking "might cause linker errors". You can ignore it: the SDK builds with the default static linkage as well as with `USE_FRAMEWORKS=dynamic`.

On React Native older than 0.75, `pod install` falls back to the `Gleap` pod from CocoaPods trunk and prints a warning. CocoaPods trunk is read-only from December 2, 2026, so only versions released before then are available this way.

## Usage

```js
// Import the SDK
import Gleap from "react-native-gleapsdk";

// Initialize it
Gleap.initialize('YOUR_API_KEY');
```

## Data regions

Gleap projects are hosted in the EU by default. If your project lives in the US region, set the region **before** calling `initialize`:

```js
Gleap.setRegion("us"); // "eu" (default) | "us"
Gleap.initialize('YOUR_API_KEY');
```

`setRegion` sets the API, websocket and realtime hosts at once. For dedicated servers you can still override a single host afterwards with `setApiUrl`, `setWSApiUrl` or `setRealtimeHost`.

## Env data

With every ticket the SDK sends env data (device model, OS version, screen size, locale, battery state, …), shown under the **Env data** tab in Gleap. Leave out individual keys or stop collecting env data entirely:

```js
Gleap.setEnvDataPropsToIgnore(['deviceName', 'batteryLevel']);
Gleap.setDisableEnvData(true);
```

Both can be called at any time and apply to the next ticket. Each `setEnvDataPropsToIgnore` call replaces the previous list, an empty array resets it. `setDisableEnvData(false)` turns the collection back on.

## Dark mode

Switch the widget between dark and light mode. `auto` follows the device appearance; if your app has its own theme toggle, pass `light` or `dark` explicitly and call it again whenever the theme changes:

```js
Gleap.setColorScheme('auto');
Gleap.setColorScheme(isDarkTheme ? 'dark' : 'light', { darkBackgroundColor: '#121212' });
```

`setColorScheme` only takes effect when "Adapt to dark / light mode" is enabled in the Gleap dashboard; it then overrides the dashboard's color scheme. Before the first call the dashboard setting applies. In dark mode the widget uses the dark mode colors, logo, header image and composer glow set in the Gleap dashboard; without dark colors it keeps its normal colors. `lightBackgroundColor` / `darkBackgroundColor` override the background in light / dark mode. Can be called before or after `initialize`.

## Network logs

Network logs are recorded when they are turned on in the Gleap dashboard, or after you call `Gleap.startNetworkLogging()`. `Gleap.stopNetworkLogging()` turns them off again, also when the dashboard turns them on.

- **iOS:** the native SDK records every request of the app, including requests made by native modules.
- **Android:** the SDK records `fetch` and `XMLHttpRequest` requests (and libraries built on them, such as axios) in JavaScript and hands them to the native SDK.

Leave requests out or remove data before it leaves the device:

```js
Gleap.setNetworkLogsBlacklist(['analytics.example.com']);
Gleap.setNetworkLogPropsToIgnore(['password', 'token', 'user.email']);
```

`setNetworkLogsBlacklist` drops every request whose URL contains one of the strings. `setNetworkLogPropsToIgnore` removes headers, JSON keys (at any depth; a dotted name such as `user.email` also works as a path from the root), form fields and query parameters with these names, case-insensitively. `Authorization`, `Proxy-Authorization`, `Cookie` and `Set-Cookie` headers are always masked, and requests to Gleap itself are never logged. Each call replaces the previous list. Bodies over 150 KB are cut; binary and streaming bodies (images, server-sent events, …) are left out.

## Need help?

Checkout our full [documentation](https://docs.gleap.ai/documentation/reactnative/README) or [contact us](https://www.gleap.ai/) - we are always here to help 👋.
