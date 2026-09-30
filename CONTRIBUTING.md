# Contributing

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project.

## Development workflow

To get started with the project, run `yarn` in the root directory to install the required dependencies for each package:

```sh
yarn
```

> While it's possible to use [`npm`](https://github.com/npm/cli), the tooling is built around [`yarn`](https://classic.yarnpkg.com/), so you'll have an easier time if you use `yarn` for development.

While developing, you can run the [example app](/example/) to test your changes. Any changes you make in your library's JavaScript code will be reflected in the example app without a rebuild. If you change any native code, then you'll need to rebuild the example app.

To start the packager:

```sh
yarn example start
```

To run the example app on Android:

```sh
yarn example android
```

To run the example app on iOS:

```sh
yarn example ios
```

Make sure your code passes TypeScript and ESLint. Run the following to verify:

```sh
yarn typescript
yarn lint
```

To fix formatting errors, run the following:

```sh
yarn lint --fix
```

Remember to add tests for your change if possible. Run the unit tests by:

```sh
yarn test
```

To edit the Objective-C files, open `example/ios/GleapsdkExample.xcworkspace` in XCode and find the source files at `Pods > Development Pods > react-native-gleapsdk`.

To edit the Kotlin files, open `example/android` in Android studio and find the source files at `reactnativegleapsdk` under `Android`.

### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix crash due to deprecated method.
- `feat`: new features, e.g. add new method to the module.
- `refactor`: code refactor, e.g. migrate from class components to hooks.
- `docs`: changes into documentation, e.g. add usage example for the module..
- `test`: adding or updating tests, e.g. add integration tests using detox.
- `chore`: tooling changes, e.g. change CI config.

Our pre-commit hooks verify that your commit message matches this format when committing.

### Linting and tests

[ESLint](https://eslint.org/), [Prettier](https://prettier.io/), [TypeScript](https://www.typescriptlang.org/)

We use [TypeScript](https://www.typescriptlang.org/) for type checking, [ESLint](https://eslint.org/) with [Prettier](https://prettier.io/) for linting and formatting the code, and [Jest](https://jestjs.io/) for testing.

Our pre-commit hooks verify that the linter and tests pass when committing.

### Releasing

Releases are published by GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) when a version tag is pushed. The tag is the plain version (`18.2.0`, no `v`), the same across all Gleap SDKs. Nobody runs `npm publish` (or `yarn release`) by hand.

1. In a PR, bump the version:
   - `version` in `package.json` (and `package-lock.json`: `npm install --package-lock-only`)
   - the native pins: `gleap_ios_sdk_version = "X.Y.Z"` at the top of `react-native-gleapsdk.podspec` and `gleap-android-sdk` in `android/build.gradle`
   - a `## X.Y.Z` section at the top of `CHANGELOG.md` (it becomes the GitHub Release notes)
2. Merge the PR into `main`. Tag only after the native SDKs are released: the podspec resolves the iOS SDK as the Swift package tag `X.Y.Z` of [Gleap-iOS-SDK](https://github.com/GleapSDK/Gleap-iOS-SDK) (exact version), so that tag must exist, and `gleap-android-sdk` `X.Y.Z` must be on Maven Central.
3. Tag the merge commit and push the tag:

   ```sh
   git switch main && git pull --ff-only
   git tag X.Y.Z && git push origin X.Y.Z
   ```

The workflow checks that the tag equals `package.json`'s version, runs `npm ci` (which builds with bob), the typecheck, lint and tests, `npm pack --dry-run`, then `npm publish` via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no npm token, provenance attached), and finally creates the GitHub Release. A prerelease tag such as `18.2.0-beta.1` publishes to the `next` dist-tag. [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the same checks on every pull request and push to `main`.

#### The native iOS SDK

The podspec adds the iOS SDK with React Native's `spm_dependency` (React Native 0.75+), not as a pod: CocoaPods trunk is read-only from December 2, 2026. `gleap_ios_sdk_version` is used for both the Swift package requirement (`exactVersion`) and the fallback `s.dependency "Gleap"` on React Native < 0.75, which only resolves versions pushed to trunk before that date. To build against an unreleased iOS SDK, temporarily change the requirement in the installed podspec (`node_modules/react-native-gleapsdk/react-native-gleapsdk.podspec`) to `{ kind: "branch", branch: "main" }` and run `pod install` again; never commit that.

**One-time setup** (npmjs.com → `react-native-gleapsdk` → Settings → Trusted publishing → GitHub Actions):

| Field | Value |
| --- | --- |
| Organization or user | `GleapSDK` |
| Repository | `ReactNative-SDK` |
| Workflow filename | `release.yml` |
| Environment name | _(leave empty)_ |

Optional, once the first automated release succeeded: set Publishing access to "Require two-factor authentication and disallow tokens" (npm's recommendation for trusted publishing).

### Scripts

The `package.json` file contains various scripts for common tasks:

- `yarn bootstrap`: setup project by installing all dependencies and pods.
- `yarn typescript`: type-check files with TypeScript.
- `yarn lint`: lint files with ESLint.
- `yarn test`: run unit tests with Jest.
- `yarn example start`: start the Metro server for the example app.
- `yarn example android`: run the example app on Android.
- `yarn example ios`: run the example app on iOS.

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.

## Code of Conduct

### Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming, diverse, inclusive, and healthy community.

### Our Standards

Examples of behavior that contributes to a positive environment for our community include:

- Demonstrating empathy and kindness toward other people
- Being respectful of differing opinions, viewpoints, and experiences
- Giving and gracefully accepting constructive feedback
- Accepting responsibility and apologizing to those affected by our mistakes, and learning from the experience
- Focusing on what is best not just for us as individuals, but for the overall community

Examples of unacceptable behavior include:

- The use of sexualized language or imagery, and sexual attention or
  advances of any kind
- Trolling, insulting or derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information, such as a physical or email
  address, without their explicit permission
- Other conduct which could reasonably be considered inappropriate in a
  professional setting

### Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of acceptable behavior and will take appropriate and fair corrective action in response to any behavior that they deem inappropriate, threatening, offensive, or harmful.

Community leaders have the right and responsibility to remove, edit, or reject comments, commits, code, wiki edits, issues, and other contributions that are not aligned to this Code of Conduct, and will communicate reasons for moderation decisions when appropriate.

### Scope

This Code of Conduct applies within all community spaces, and also applies when an individual is officially representing the community in public spaces. Examples of representing our community include using an official e-mail address, posting via an official social media account, or acting as an appointed representative at an online or offline event.

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the community leaders responsible for enforcement at [INSERT CONTACT METHOD]. All complaints will be reviewed and investigated promptly and fairly.

All community leaders are obligated to respect the privacy and security of the reporter of any incident.

### Enforcement Guidelines

Community leaders will follow these Community Impact Guidelines in determining the consequences for any action they deem in violation of this Code of Conduct:

#### 1. Correction

**Community Impact**: Use of inappropriate language or other behavior deemed unprofessional or unwelcome in the community.

**Consequence**: A private, written warning from community leaders, providing clarity around the nature of the violation and an explanation of why the behavior was inappropriate. A public apology may be requested.

#### 2. Warning

**Community Impact**: A violation through a single incident or series of actions.

**Consequence**: A warning with consequences for continued behavior. No interaction with the people involved, including unsolicited interaction with those enforcing the Code of Conduct, for a specified period of time. This includes avoiding interactions in community spaces as well as external channels like social media. Violating these terms may lead to a temporary or permanent ban.

#### 3. Temporary Ban

**Community Impact**: A serious violation of community standards, including sustained inappropriate behavior.

**Consequence**: A temporary ban from any sort of interaction or public communication with the community for a specified period of time. No public or private interaction with the people involved, including unsolicited interaction with those enforcing the Code of Conduct, is allowed during this period. Violating these terms may lead to a permanent ban.

#### 4. Permanent Ban

**Community Impact**: Demonstrating a pattern of violation of community standards, including sustained inappropriate behavior, harassment of an individual, or aggression toward or disparagement of classes of individuals.

**Consequence**: A permanent ban from any sort of public interaction within the community.

### Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 2.0,
available at https://www.contributor-covenant.org/version/2/0/code_of_conduct.html.

Community Impact Guidelines were inspired by [Mozilla's code of conduct enforcement ladder](https://github.com/mozilla/diversity).

[homepage]: https://www.contributor-covenant.org

For answers to common questions about this code of conduct, see the FAQ at
https://www.contributor-covenant.org/faq. Translations are available at https://www.contributor-covenant.org/translations.
