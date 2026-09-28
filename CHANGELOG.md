# Changelog

## 18.2.0
Updated native iOS dependency to 18.2.0
Updated native Android dependency to 18.2.0
(dark mode: new `Gleap.setColorScheme('auto' | 'light' | 'dark' | 'default', { lightBackgroundColor?, darkBackgroundColor? })` switches the widget between dark and light mode and overrides the color scheme set in the dashboard — `auto` follows the device appearance; apps with their own in-app theme toggle should pass `light` / `dark` explicitly and call it again when the theme changes; `default` removes the override; only the widget background is swapped: the dashboard background is kept when it already matches the active scheme, otherwise `lightBackgroundColor` (default `#ffffff`) or `darkBackgroundColor` (default `#18181b`) is used; can be called before or after `initialize` and applies live)
(network logs, iOS: now recorded by the native SDK, which logs every request of the app — React Native's `fetch` and `XMLHttpRequest` as well as requests made by native modules — with complete headers, bodies, timing and errors; `startNetworkLogging()` / `stopNetworkLogging()` switch this recording on and off)
(network logs, Android: the JavaScript interceptor was reworked — a `fetch` request is logged once instead of twice, failed, aborted and timed-out requests are logged with their error, response headers are included, dates are ISO timestamps, the app's request headers are always sent unchanged (a repeated header used to be dropped), streaming and binary bodies are skipped and bodies over 150 KB are cut, and the log is handed to the native SDK at most every 500 ms instead of on every network event; a silent crash report sent right after a request now includes it)
(network logs, both platforms: `setNetworkLogPropsToIgnore` removes matching headers, JSON keys at any depth (a dotted name such as `user.password` also works as a path), form fields and query parameters, case-insensitively; `Authorization`, `Proxy-Authorization`, `Cookie` and `Set-Cookie` headers are always masked; each call to `setNetworkLogPropsToIgnore` / `setNetworkLogsBlacklist` replaces the previous list; `stopNetworkLogging()` now also wins over the dashboard setting, and `startNetworkLogging()` after a stop resumes logging)

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
