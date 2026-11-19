# Gleap React Native SDK

`react-native-gleapsdk`, the package apps install to get Gleap: AI customer support, live chat, bug reports, surveys, news, checklists and the help center. A thin TypeScript layer (`src/`) over the native Gleap iOS SDK (Swift package `Gleap-iOS-SDK`, added by `react-native-gleapsdk.podspec`) and Android SDK (`io.gleap:gleap-android-sdk`, `android/build.gradle`). The bridge is the classic native module: `NativeModules.Gleapsdk` and `NativeEventEmitter` in `src/index.tsx`, `GleapsdkModule.java` (`@ReactMethod`) and `ios/Gleapsdk.m` (`RCT_EXPORT_METHOD`). There is no codegen spec; on the New Architecture it runs through React Native's interop layer. Old toolchain on purpose (TypeScript 4.9, Jest 26, ESLint 7, react-native-builder-bob 0.20): it builds what ships. npm, Node 24 in CI. This repository is public.

Terms, as in the other Gleap repos: a conversation is a ticket, the app's user is a contact (session), the project's key is the Project ID (formerly SDK key or API key).

How it ships:

- **npm:** a pushed version tag `X.Y.Z` runs `.github/workflows/release.yml`, which runs the same checks as CI and publishes with npm trusted publishing. `package.json` `files` decides the tarball: `src/`, `lib/`, `android/`, `ios/`, the podspec, and always `package.json`, `README.md`, `LICENSE`.
- **Metro compiles `src/` itself** (`"react-native": "src/index"`), with the app's Babel. `lib/` (bob: commonjs, module, typescript) serves everything else, the typings included. Both must behave the same.
- **Native code ships as source** and is compiled inside each customer's app, against their React Native version. Nothing in this repo compiles it.
- Apps pin versions, so every published version stays in use for years. An npm version cannot be republished: a broken release is fixed by a new version.

## Commands

```bash
npm ci                                            # installs and builds lib/ (prepare runs bob)
npx jest <file>                                   # one test file; CI runs npx jest src
npx jest --findRelatedTests <files> --passWithNoTests   # the tests that reach the files you changed
npx tsc --noEmit -p tsconfig.build.json           # the typecheck CI and the release run
npx eslint <files>                                # ESLint and Prettier on the files you changed
node tools/quality/check.mjs --base origin/main   # the quality check on what this branch adds
node --test "tools/quality/*.test.mjs"            # the quality check's own tests (about 45 s)
npm pack --dry-run                                # what would be published, and its shasum
```

Not `yarn`: there is no `yarn.lock`, and CI and the release use `npm ci` with `package-lock.json` (`CONTRIBUTING.md` and `.yarnrc` are older than that). Not `npm run typescript` or `npm run lint` either: they also reach `example/`, which has old failures and is not published. Several sessions share this machine, so locally run only what you touched.

New worktree: run `./scripts/setup-worktree.sh` first (installs the push hook, runs `npm ci` and `npm ci --prefix tools/quality`). The SDK reads no `.env`; never copy one from another checkout.

CI (`.github/workflows/ci.yml`) runs the typecheck, ESLint, Jest, the quality check's tests and `npm pack --dry-run` on every PR and push to `main`; `.github/workflows/quality.yml` runs the quality check on PRs. `git push` runs the quality check on your branch (`.githooks/pre-push`). Agents fix what it reports and push again; they do not use `--no-verify`.

Done means the typecheck, ESLint on your files, the tests that reach your change and the quality check pass, and CI is green. A change to `android/` or `ios/` also runs `npx jest src/__tests__/nativeContract.test.ts`, and your report says that it was not compiled: native code is verified by people building an app on both platforms. Say which commands you ran and what they printed.

## Traps

- **Tests live in `src/__tests__/`, fixtures and helpers in `src/__fixtures__/`.** bob skips `__tests__`, `__fixtures__` and `__mocks__`, and `files` leaves them out. A `src/x.test.ts` would be published and built into `lib/`. Jest runs every file in `__tests__` as a test, so a helper there fails as an empty suite.
- **No `.ts` or `.tsx` outside `src/`.** bob's typescript target runs `tsc -p tsconfig.build.json`, which takes every TypeScript file in the repo except `example/`. One more root moves the declarations to `lib/typescript/src/` and breaks `types` for every customer. Tooling is `.mjs`.
- **`src/` syntax must compile with old Babel:** customers on React Native 0.75 build it with their own preset. TypeScript 4.9 here is the ceiling; do not raise it to get newer syntax.
- **`npm ci` prints "Failed to locate 'tsc' … falling back to the globally installed version".** It is harmless: npm 9 removed `npm bin`, and bob then finds `node_modules/.bin/tsc` on npm's PATH, as in CI. Do not "fix" it in the bob config: that is a build change.
- **The quality check has its own TypeScript** in `tools/quality/package.json` (5.9.3; the root's 4.9 cannot run it). That `package.json` has no `name` on purpose: Jest 26 registers every named `package.json` as a module.
- **A version lives in four places:** `package.json` (and `package-lock.json`), `gleap_ios_sdk_version` in the podspec, `gleap-android-sdk` in `android/build.gradle`, and a `## X.Y.Z` section in `CHANGELOG.md`. The native SDK tags must exist before the tag here is pushed (`CONTRIBUTING.md` → Releasing).
- **iOS installs the native SDK as a Swift package** through React Native's `spm_dependency` (0.75+); older apps fall back to the CocoaPods pod, which gets no new versions from 2026-12-02.
- **`release.yml` runs whatever the root `devDependencies` and the `jest` and `eslintConfig` keys say** at tag time. Changing them changes the release, and the published `package.json`.
- `.husky/` is not installed (no `husky install`), `.circleci/` (Node 10, yarn) reports no check on this repo's commits, and `example/` (React Native 0.71) is not built in CI. Do not rely on any of them.

## Code

New files and the code you change follow `.claude/rules/code-conventions.md`, the bridge follows `.claude/rules/native-bridge.md`, and tests follow `.claude/rules/testing.md`. Read them before your first edit: old code here is no precedent.

## Public API

Everything a customer can call or rely on is public: the default export and every `Gleap.*` method in `GleapSdkType`, their parameters, return types and defaults, `GleapBannerArea`, `useGleapBannerHeight`, the exported types, the names and payloads of the events `registerListener` delivers, `main`/`module`/`types`/`react-native` in `package.json`, and the native minimums (iOS 15, Android minSdk 21, React Native 0.75 for the Swift package).

- **Never remove, rename or change the meaning of any of it in a minor or patch version.** Add instead: a new optional parameter, a method, an option. From the third parameter on, take an options object.
- **A method works on both platforms or says why not.** Calling into a native SDK that is too old logs one `Gleap:` warning and does nothing (`missingNative` in `src/index.tsx`); it never throws into the app.
- **Deprecate, don't delete:** keep the behaviour, mark it `@deprecated` in the doc comment with what to use instead, and say so in `CHANGELOG.md`. Removal needs a major version: stop and ask.
- **An API change updates `GleapSdkType`, `README.md` and `CHANGELOG.md` in the same PR.**
- **New behaviour is opted into** by a dashboard setting or a new call, never because the SDK was updated.

## Customer requests

A ticket is one customer's view, a bug report too. Before changing anything for it:

- **A feature or a change:** decide whether it is right for the product. Would most customers want it, or does it belong behind a setting every customer can use?
- **A bug report:** first check whether the code does something other than intended, from its tests, comments, docs and history, and whether the cause is in the native SDKs or the app's own setup (pods, Gradle, Expo prebuild) rather than here. If it works as designed, change nothing and say so in your report, with what the customer can do instead. Changing intended behaviour is a product decision: stop and ask.
- **Never special-case one customer in code:** no project ids, customer names or domains in conditions. Stop and ask.

## Security and privacy

- No secret belongs in this repo, a test or a log. The Project ID in examples is a placeholder.
- Identity tokens (`setUserJwt`), auth tokens (`setAuthTokens`) and the JWT provider stay in memory: never in storage, a log, an event payload or a URL.
- The JS network log redacts through `src/networkLogSanitizer.ts` before anything reaches the native SDK. A new capture path reuses it.
- The SDK runs inside customers' apps: no new global, no patched prototype, and a wrapper of `fetch` or `XMLHttpRequest` calls the original with its `this` and arguments and never throws.

## Stop and ask

Keep going while a step needs no input. Stop and ask before merging, releasing (a version bump, a tag, `npm publish`), adding or upgrading a dependency (root or `tools/quality`), changing any key of `package.json` (it is published), the build (`tsconfig*.json`, `babel.config.js`, the bob config), `react-native-gleapsdk.podspec`, `android/build.gradle`, `.github/workflows/release.yml`, a native minimum, a public API removal, or moving the bridge to TurboModules or codegen.
