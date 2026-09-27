# Gleap React Native SDK

![Gleap ReactNative SDK Intro](https://raw.githubusercontent.com/GleapSDK/Gleap-iOS-SDK/main/Resources/GleapHeaderImage.png)

Add AI-native customer support, live chat, in-app bug reporting, a help center and surveys to your React Native apps with [Gleap](https://www.gleap.ai). Gleap is an Intercom alternative for software teams that connects customer conversations and feedback with product development.

[SDK documentation](https://docs.gleap.ai/documentation/reactnative/README) · [Website](https://www.gleap.ai) · [Plans and pricing](https://www.gleap.ai/pricing)

## Installation

```sh
npm install react-native-gleapsdk
```

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
