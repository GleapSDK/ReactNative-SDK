---
paths:
  - "src/**"
  - "android/**"
  - "ios/**"
---

# Testing

Tests come first and stay fixed while the code is written: an agent that may change a test will change it to get green.

- **New behaviour or a bug fix:** write the test first, from the requirement and not from the code. Use the `test-writer` subagent if you can start one. See it fail for the expected reason and commit it on its own, then write the code without touching it. Use `npx jest --findRelatedTests <file> --passWithNoTests` to see which tests already cover what you change.
- **Refactor without a behaviour change:** tests stay unchanged. A move may change a test's import path, never its assertions. Nothing covers the code? Pin today's behaviour with a test first.
- **Never edit, skip or delete an existing test to make a change pass,** and never detect test inputs or hardcode answers. No `.skip`, `.only`, retries or sleeps. If a test looks wrong, stop and report `BLOCKED` with the reason. A test changes only when the required behaviour changed; say so in the PR.

## Where tests go

Jest 26 with the `react-native` preset, in Node. Tests import nothing from Jest: `describe`, `it`, `expect` and `jest` are globals.

| Code | Test |
|---|---|
| Logic in a module (`src/<name>.ts`) | `src/__tests__/<name>.test.ts` |
| What `src/index.tsx` does with the native module: arguments, fallbacks, events | `src/__tests__/index.test.tsx` style: a fake native module, see below |
| A new native method or event | `src/__tests__/nativeContract.test.ts` must stay green; update its lists only for a method that is one-platform on purpose, with the reason |
| A component (`GleapBannerArea`) | nothing yet: no renderer is installed, and adding one is a dependency (stop and ask) |
| Native code (`android/`, `ios/`) | nothing runs it here; say in your report that it was not compiled |

Never put a test next to the code (`src/x.test.ts`): it would be published. Shared helpers and data go in `src/__fixtures__/`, not in `__tests__`, where Jest would run them as a suite.

## Faking the native side

- **Fake only the edges:** the native module, the event emitter, `fetch` and `XMLHttpRequest`, and time. `loadSdk` in `src/__tests__/index.test.tsx` shows the way: `jest.doMock('react-native', …)` with a module whose methods are `jest.fn()`, an emitter whose listeners the test calls, `Platform.OS` per test, and `jest.isolateModules` to load `../index` fresh. Do not mock the module under test or its helpers.
- **Both platforms:** code that branches on `Platform.OS` gets a test for `ios` and for `android`.
- **A native SDK that is too old:** leave the method off the fake module and assert the warning and that nothing throws.
- Timers: `jest.useFakeTimers()` and `jest.useRealTimers()` in `afterEach`. Globals you replace (`fetch`, `XMLHttpRequest`) are restored in `afterEach` or `afterAll`.
- Assert behaviour: what the native module received and what a listener got, not that code ran.

## What to run

- While you work: `npx jest <file>`.
- Before you finish: `npx jest --findRelatedTests <changed files> --passWithNoTests`, and `npx jest src/__tests__/nativeContract.test.ts` when `android/`, `ios/` or the API in `src/index.tsx` changed.
- Never the full suite locally. CI runs it on every PR.

`--findRelatedTests` runs nothing for a file no test reaches, and the stop hook, which passes `--passWithNoTests`, stays green. That is not a pass: say in your report what no test covered.
