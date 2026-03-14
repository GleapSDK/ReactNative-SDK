# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Commands

```bash
yarn test          # Jest tests
yarn typescript    # Type check
yarn lint          # ESLint
yarn prepare       # Build with react-native-builder-bob
yarn bootstrap     # Full setup (example app + deps + pods)
```

Release: `release-it` with conventional-changelog. Husky pre-commit hooks + commitlint enforced.

## Architecture

**Gleap React Native SDK** — thin TypeScript bridge to native iOS/Android modules via `NativeModules` + `NativeEventEmitter`.

### Key Patterns

- **Entry point:** `src/index.tsx` — exports typed `GleapSdkType` interface
- **Native bridge:** All SDK methods delegate to platform-native implementations
- **Network interceptor:** `GleapNetworkIntercepter` logs network requests from JS layer
- Uses **yarn**, not npm
