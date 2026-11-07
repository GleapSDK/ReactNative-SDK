# Changelog

## 19.5.1
Documentation only: README, package description and doc comments name the Project ID (Settings → Project → General) and sign users in with `setUserJwt`. No code changes.

## 19.5.0
The key `Gleap.initialize` takes is now called **Project ID** (formerly "SDK key" / "API key"): `Gleap.initialize('YOUR_PROJECT_ID')`. The value is the same and every existing key keeps working; nothing needs to change in your app. Typings, the native bridge parameter names, the README and the example say Project ID. On iOS the bridge calls the native `initializeWithProjectId:` (and falls back to `initializeWithToken:` on older native SDKs); on Android it calls `Gleap.initialize(String, Application)`, which takes the same value.
`setUserJwtProvider` works when it is set before or after `initialize` (the native SDKs keep the provider across initialize; now covered by tests on both platforms). With the native 19.5.0 SDKs the provider also restores the signed session after an app restart.
Updated native iOS dependency to 19.5.0
Updated native Android dependency to 19.5.0

## 19.4.0
Customer identity: `Gleap.setUserJwt(token)`, `Gleap.setUserJwtProvider(provider)` and `Gleap.setAuthTokens(tokens)` wrap the native SDK methods (iOS `Gleap.setUserJwt` / `setUserJwtProvider` / `setAuthTokens`, Android `Gleap.getInstance().setUserJwt` / `setUserJwtProvider` / `setAuthTokens`). `setUserJwt` identifies the user with one HS256 JWT signed by your backend (the token is the whole identify, kept in memory only); `setAuthTokens` stores per-user tokens for API tools on the signed contact (`null` removes one). Both return a Promise that resolves once the native SDK has the values. The provider runs in JavaScript: the native SDK asks for a token with the `userJwtRequested` event when the token expired or expires within 5 minutes, and keeps the rules (one call at a time, 10 second timeout, 30 second pause after a failure). Needs native SDKs with these methods (the next synchronized native release); JavaScript running on an older native build logs a warning and does nothing. New: `Gleap.setSessionDuration(ms)` shortens the signed session (the project's maximum applies); needs the native SDKs that include it.

Updated native iOS dependency to 19.4.0
Updated native Android dependency to 19.4.0

## 19.3.1
Updated native iOS dependency to 19.3.1
Updated native Android dependency to 19.3.1

## 19.3.0
Inline banners can push the app down instead of covering it, like on the web. Wrap the app in `GleapBannerArea`: while an inline banner is shown, the content moves down by the banner's height (animated) and back up when it closes; floating banners still float. `useGleapBannerHeight()`, `Gleap.getBannerHeight()` and the `bannerHeightChanged` listener give the height (points on iOS, dp on Android, from the top edge; the banner covers the status bar) for custom layouts. See the README for React Navigation / safe-area-context.
Updated native iOS dependency to 19.3.0
Updated native Android dependency to 19.3.0

## 19.2.4
Android: the realtime socket opens and closes far less often (no reconnect on a network change or an unchanged identify, closed with 1001 after 10 s in the background, backoff reset only after a healthy socket); see the Android SDK 19.2.4 notes.
Updated native iOS dependency to 19.2.4
Updated native Android dependency to 19.2.4

## 19.2.3
iOS: the realtime socket opens and closes far less often and closes cleanly (close codes 1000/1001 instead of none, one socket per session start and identify, backoff after errors, closed in the background); see the iOS SDK 19.2.3 notes.
Updated native iOS dependency to 19.2.3
Updated native Android dependency to 19.2.3

## 19.2.2
iOS: sending a form or bug report no longer freezes the app for seconds (no loading state after Submit, late thank-you screen); see the iOS SDK 19.2.2 notes.
Updated native iOS dependency to 19.2.2
Updated native Android dependency to 19.2.2

## 19.2.1
Updated native iOS dependency to 19.2.1
Updated native Android dependency to 19.2.1

## 19.2.0
Updated native iOS dependency to 19.2.0
Updated native Android dependency to 19.2.0
Surveys 2.0: the feedback sent and outbound sent callbacks (and on Android feedback will be sent) now also fire when a Surveys 2.0 survey is completed in the native SDKs, with the survey's answers; server-triggered surveys keep their resume data, and full-screen and card surveys look right on Android (native SDK 19.2.0).

## 19.1.0
Updated native iOS dependency to 19.1.0
Updated native Android dependency to 19.1.0
New `Gleap.setCaptureEnabled(enabled)` and `Gleap.setRemoteLogCollectionEnabled(enabled)` for capture requests: in-app screenshots and screen recordings that workflows, AI agents and teammates ask for in a conversation, and background log collection. On Android the JS network log is handed to the native SDK before it collects logs for a request.

## 19.0.1
Native iOS and Android dependencies stay on 19.0.0
(protected conversation files: new `Gleap.openProtectedFileFromUrl(url)` opens the conversation of a file linked in a Gleap email — emails link attachments to your customer application URL with a `gleapFile` query parameter; pass the URL that opened the app (from `Linking.getInitialURL()` or the `Linking` `url` event); resolves `true` if the URL carries a Gleap file reference, `false` otherwise; the conversation opens once the user is identified with a user hash (`identifyWithUserHash`), the link alone grants no access)

## 19.0.0
Updated native iOS dependency to 19.0.0
(iOS: the native Gleap SDK is now installed with Swift Package Manager instead of the `Gleap` pod from CocoaPods trunk, which is read-only from December 2, 2026 — `pod install` adds the Gleap-iOS-SDK package (exact version 19.0.0) to the Pods project through React Native's `spm_dependency`, nothing to change in your app; requires React Native 0.75 or later (Expo SDK 52 or later); on older React Native versions `pod install` falls back to the `Gleap` pod and prints a warning)
Updated native Android dependency to 19.0.0
(dark mode: new `Gleap.setColorScheme('auto' | 'light' | 'dark', { lightBackgroundColor?, darkBackgroundColor? })` switches the widget between dark and light mode and overrides the color scheme set in the dashboard (only when "Adapt to dark / light mode" is enabled there) — `auto` follows the device appearance; apps with their own in-app theme toggle should pass `light` / `dark` explicitly and call it again when the theme changes; before the first call the dashboard setting applies; in dark mode the widget uses the dark mode colors, logo, header image and composer glow set in the dashboard, and without dark colors it keeps its normal colors; `lightBackgroundColor` / `darkBackgroundColor` override the background; can be called before or after `initialize` and applies live)
(network logs, iOS: now recorded by the native SDK, which logs every request of the app — React Native's `fetch` and `XMLHttpRequest` as well as requests made by native modules — with complete headers, bodies, timing and errors; `startNetworkLogging()` / `stopNetworkLogging()` switch this recording on and off)
(network logs, Android: the JavaScript interceptor was reworked — a `fetch` request is logged once instead of twice, failed, aborted and timed-out requests are logged with their error, response headers are included, dates are ISO timestamps, the app's request headers are always sent unchanged (a repeated header used to be dropped), streaming and binary bodies are skipped and bodies over 150 KB are cut, and the log is handed to the native SDK at most every 500 ms instead of on every network event; a silent crash report sent right after a request now includes it)
(network logs, both platforms: `setNetworkLogPropsToIgnore` removes matching headers, JSON keys at any depth (a dotted name such as `user.password` also works as a path), form fields and query parameters, case-insensitively; `Authorization`, `Proxy-Authorization`, `Cookie` and `Set-Cookie` headers are always masked; each call to `setNetworkLogPropsToIgnore` / `setNetworkLogsBlacklist` replaces the previous list; `stopNetworkLogging()` now also wins over the dashboard setting, and `startNetworkLogging()` after a stop resumes logging)
(Android fixes: `isOpened()`, `isUserIdentified()` and `getIdentity()` no longer leave their promise pending when no activity is available, and `sendSilentCrashReport` now sends the `MEDIUM` / `HIGH` severity instead of always `LOW`)
(Android fix: network logs, the `configLoaded` / `initialized` callbacks and the dashboard's network log redaction lists now also work after a JavaScript reload (dev reload, OTA update) and when the SDK was already initialized natively — `initialize` hands the already loaded config to JavaScript again, like on iOS, and JavaScript handles it once)

## 18.1.0
Updated native iOS dependency to 18.1.0
Updated native Android dependency to 18.1.0
(env data: new `Gleap.setEnvDataPropsToIgnore([...])` drops individual env data fields — exact, case-sensitive keys such as `deviceName` or `batteryLevel` — before a ticket or conversation leaves the device; each call replaces the previous list, an empty list resets it; new `Gleap.setDisableEnvData(true)` stops collecting env data entirely (sent as an empty object), `false` turns it back on; both can be called before or after `initialize` and apply to the next ticket)

## 18.0.0
Updated native iOS dependency to 18.0.0
Updated native Android dependency to 18.0.0
(data regions: new `Gleap.setRegion('eu' | 'us')` points the API, websocket and realtime hosts at the chosen region in one call — `eu` is the default, call it before `initialize`; new host setters `setWSApiUrl`, `setRealtimeHost`, `setBannerUrl` and `setModalUrl` next to the existing `setApiUrl` / `setFrameUrl` — a setter called after `setRegion` overrides that single host; the static widget hosts (frame, banner, modal) are global and not changed by the region)

## 17.0.0
Updated native iOS dependency to 17.0.0
Updated native Android dependency to 17.0.0
(Android: remote images are now downsampled to their destination size and served from a memory-pressure-aware cache, replacing the manual full-size bitmap decodes flagged by Google Play's new Android Vitals bitmap-optimization advisory; both platforms: calling setLanguage() after initialize() now reloads the widget config, so server-translated copy switches language immediately)

## 16.4.5
Updated native iOS dependency to 16.4.5
Updated native Android dependency to 16.4.5
(redesigned in-app notifications: contained cards with the sender and time inside the card, a collapsible notification stack, and the rounded-square bot avatar — matching the JavaScript SDK)

## 16.4.3
Updated native iOS dependency to 16.4.3
(fixes info cards scrolling in two places at once, and flickering in portrait, when the content is taller than the screen)
Native Android dependency stays on 16.4.2 (unaffected)

## 16.4.2
Updated native iOS dependency to 16.4.2
Updated native Android dependency to 16.4.2
(shows the app background while the widget is loading and raises the attachment file size limit)

## 16.4.0
Updated native iOS dependency to 16.4.0
Updated native Android dependency to 16.4.0
(fixes Gleap not responding when the app is launched without an internet connection)

## 15.4.0
Updated native iOS dependency to 15.4.0 (fixes the feedback button disappearing after launch on iOS in apps where the key window changes)
