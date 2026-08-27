# Changelog

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
