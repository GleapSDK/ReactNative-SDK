# Gleap ReactNative SDK

![Gleap ReactNative SDK Intro](https://raw.githubusercontent.com/GleapSDK/Gleap-iOS-SDK/main/Resources/GleapHeaderImage.png)

The Gleap SDK for ReactNative is the easiest way to integrate Gleap into your apps!

You have two ways to set up the Gleap SDK for ReactNative. The easiest way ist to use the maven repository to add Gleap SDK to your project.  (it's super easy to get started & worth using 😍)

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

Checkout our full [documentation](https://docs.gleap.io/reactnative) or [contact us](https://gleap.io/) - we are always here to help 👋.
