---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Code conventions

For new files and the code you change; do not rewrite other code to match. The code around you is full of patterns new code must not copy, so copy the examples below, not your neighbours. `node tools/quality/check.mjs` checks the rules it can see; it judges only what your branch adds.

- **Size:** aim for files under 400 lines and never write a new one over 700. Functions 80 lines, components 150, counted without blanks and comments. These are working values, not proven limits. Tests and fixtures have none. A file or function already too big must not grow (`src/networklogger.ts`, `src/index.tsx`, `src/networkLogSanitizer.ts`): put the new part in its own module and call it from there. Split by responsibility; never squeeze code onto fewer lines.
- **Parameters:** at most 2 positional, from 3 on one object with named fields. Existing public methods keep their signatures (`AGENTS.md` → Public API).
- **Modules:** one responsibility per file in `src/`, camelCase and named after what it holds (`networkLogSanitizer.ts`), components in PascalCase (`GleapBannerArea.tsx`); no new `index`, `utils`, `helpers` or `constants`. Named exports only: a default export has no canonical name, so agents cannot find or rename it reliably. `src/index.tsx` keeps its default export, the package's API.
- **Types:** no `any`, no `as` casts and no `!` in new code: use `unknown` with a type guard, or fix the type where it comes from. No `@ts-ignore`; `@ts-expect-error` only with the reason on the same line. TypeScript 4.9 syntax at most (`AGENTS.md` → Traps).
- **Values:** a closed set of values is one frozen object of named constants (`Object.freeze({ CONVERSATION: 'conversation' })`) next to the code that owns it, with no string literals in comparisons or `case`. The values are what the native SDKs and the Gleap backend send: add members, never rename a value, and handle a value a newer native SDK may add. `Platform.OS === 'ios'` and `typeof x === 'string'` are fine.
- **One definition:** before adding a helper, constant or event name, search for an existing one and extend it if it covers most of the need. A native method or event name keeps exactly the spelling both native modules use.
- **Noise:** no `console.log`. `console.warn` and `console.error` only for what the app's developer must act on, starting with `Gleap:`, at most once per cause. No commented-out code. A comment says why, in English, in one or two lines, and only where the code cannot. No ticket or PR numbers, people's names, dates or decision histories: those belong in the PR.
- **Doc comments** on every new public method in `GleapSdkType`: what it does, what it needs from the native SDK, and what happens when that is too old. Customers read them in their editor.

## One job, one system

Where the code has a helper for a job, new code uses it.

| Job | Use | Not in new code |
|---|---|---|
| Calling native code | the module object in `src/index.tsx` (`GleapSdk`) | `NativeModules` or `TurboModuleRegistry` in another file |
| Receiving native events | `gleapEmitter` in `src/index.tsx`, handed on through `registerListener` | a second `NativeEventEmitter` |
| A native method that may be missing | `typeof GleapSdk.x === 'function'`, else `missingNative('x')` | calling it unguarded |
| Network requests in the log | `src/networklogger.ts` (wrapping) and `src/networkLogSanitizer.ts` (redaction) | a second wrapper of `fetch` or `XMLHttpRequest`, unredacted headers or bodies |
| The banner inset | `src/bannerHeight.ts`, `GleapBannerArea`, `useGleapBannerHeight` | reading the height natively a second time |

## Examples to copy

The closest we have today, so copy only what each line names.

- A small module of exported functions with its test: `src/networkLogSanitizer.ts`, `src/__tests__/networkLogSanitizer.test.ts`.
- A component and its hook: `src/GleapBannerArea.tsx`.
- A guarded call into a newer native method: `setUserJwt` in `src/index.tsx`.
