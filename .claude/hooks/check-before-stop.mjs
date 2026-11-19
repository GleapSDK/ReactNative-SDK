// Before a turn ends: the quality check, the typecheck, ESLint and the tests the change reaches, once per tree. Red means
// the turn is not done. Never the full suite: several sessions share this machine and CI runs it anyway. A change to the
// native modules also runs the native contract test; compiling them needs Xcode and Gradle, which stay with people.
import { join } from 'node:path';

import { projectDirOf, runStopGate } from '../../tools/quality/hooks.mjs';

const TEST_WORKERS = 4;
const TYPECHECK_TIMEOUT_MS = 60_000;
const LINT_TIMEOUT_MS = 120_000;
const TESTS_TIMEOUT_MS = 240_000;

const SOURCE = /^src\/.*\.(ts|tsx|js|jsx)$/;
const NATIVE = /^(android\/src\/.*\.(java|kt)|ios\/.*\.(h|m|mm|swift))$/;
const CONTRACT_TEST = 'src/__tests__/nativeContract.test.ts';

const projectDir = projectDirOf(import.meta.url);

await runStopGate({
  projectDir,
  toolPath: join(projectDir, 'tools/quality/check.mjs'),
  isCode: (file) => SOURCE.test(file) || NATIVE.test(file) || /^tools\/.*\.mjs$/.test(file),
  stepsFor: ({ changed, existing }) => {
    const sources = existing.filter((file) => SOURCE.test(file));
    const touchesNative = changed.some((file) => NATIVE.test(file));
    return [
      {
        // The same project CI and release.yml check. tsconfig.json alone also reaches example/, which does not pass.
        name: 'typecheck (tsc -p tsconfig.build.json)',
        command: 'npx',
        args: ['--no-install', 'tsc', '--noEmit', '-p', 'tsconfig.build.json', '--pretty', 'false'],
        requires: 'node_modules/.bin/tsc',
        timeout: TYPECHECK_TIMEOUT_MS,
      },
      ...(sources.length
        ? [
            {
              // src is free of ESLint errors today, so every error in a changed file is new.
              name: 'eslint',
              command: 'npx',
              args: ['--no-install', 'eslint', ...sources],
              requires: 'node_modules/.bin/eslint',
              timeout: LINT_TIMEOUT_MS,
            },
            {
              name: 'jest related',
              command: 'npx',
              args: ['--no-install', 'jest', '--findRelatedTests', ...sources, '--passWithNoTests', `--maxWorkers=${TEST_WORKERS}`],
              requires: 'node_modules/.bin/jest',
              timeout: TESTS_TIMEOUT_MS,
            },
          ]
        : []),
      ...(touchesNative
        ? [
            {
              name: 'native contract test',
              command: 'npx',
              args: ['--no-install', 'jest', CONTRACT_TEST],
              requires: 'node_modules/.bin/jest',
              timeout: TESTS_TIMEOUT_MS,
            },
          ]
        : []),
    ];
  },
});
