---
paths:
  - "src/index.tsx"
  - "android/**"
  - "ios/**"
  - "react-native-gleapsdk.podspec"
---

# The native bridge

Three hand-written sides describe one API: `GleapSdkType` and the listeners in `src/index.tsx`, `@ReactMethod`s in `android/src/main/java/com/reactnativegleapsdk/GleapsdkModule.java`, and `RCT_EXPORT_METHOD`s in `ios/Gleapsdk.m`. Nothing compiles them against each other, and native code is compiled only in customers' apps. `src/__tests__/nativeContract.test.ts` compares the three sources; keep it green. For new code and the code you change; do not rewrite old code to match.

## Methods

- **Same name on both platforms.** A new method is a `@ReactMethod` in `GleapsdkModule.java` and an `RCT_EXPORT_METHOD` (first selector part = the JS name) in `Gleapsdk.m`, plus its line in `GleapSdkType` with a doc comment. A method that can exist on one platform only is listed in `nativeContract.test.ts` with the reason, and the JS side checks for it before calling (`typeof GleapSdk.x === 'function'`).
- **Arguments the bridge can carry:** strings, numbers, booleans, `ReadableMap`/`ReadableArray` on Android and `NSDictionary`/`NSArray` on iOS for objects. Null is possible on both: handle it natively instead of crashing.
- **A promise settles exactly once,** on every path, errors included: `promise.resolve`/`promise.reject` on Android, the `RCTPromiseResolveBlock`/`RCTPromiseRejectBlock` on iOS. A method that returns nothing does not take a promise.
- **Threads:** the native Gleap SDKs expect the main thread for anything UI. Android: `getActivitySafe().runOnUiThread(…)` as the neighbours do; iOS: `dispatch_async(dispatch_get_main_queue(), …)`. Never block the JS thread.
- **Never crash the app.** A native exception is caught at the bridge and logged once; JS gets a rejection or nothing. The Android activity may be missing (`getActivitySafe`).
- **Thin bridge:** a bridge method converts arguments and calls the native SDK. Logic belongs in the native SDKs or in TypeScript, where it can be tested.

## Events

- An event the native side sends is listed in iOS `supportedEvents` (iOS throws on any other), sent on Android through `emitToJs` or the device event emitter, and has a listener on `gleapEmitter` in `src/index.tsx`, which hands it on through `registerListener`. Event names and payload shapes are public API.
- Payloads are a string (JSON) or a plain map, the same shape on both platforms. JS parses defensively (`isJsonString` in `src/index.tsx`) and ignores what it does not know.

## Versions

- The native SDK versions are pinned exactly: `gleap_ios_sdk_version` in the podspec and `gleap-android-sdk` in `android/build.gradle`, released together with this package (`AGENTS.md` → Traps). Changing them, the podspec or `build.gradle` is a release step: stop and ask.
- JS may run against an older native build (an app updated the package without a native rebuild, or over-the-air JS). A new call checks that the native method exists and otherwise warns once with `missingNative`.
- No TurboModule spec, codegen config or Fabric component in passing: moving the bridge changes the minimum React Native version. Stop and ask.
