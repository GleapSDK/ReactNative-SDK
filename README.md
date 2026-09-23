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

## Need help?

Checkout our full [documentation](https://docs.gleap.ai/documentation/reactnative/README) or [contact us](https://www.gleap.ai/) - we are always here to help 👋.
