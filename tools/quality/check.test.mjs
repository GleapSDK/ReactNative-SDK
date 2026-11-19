// node --test tools/quality/*.test.mjs: the shared core cases plus what only this repo's config decides. node:test, not
// Jest: the repo's Jest 26 cannot load ES modules, and the check must not depend on the SDK's test setup.
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { config, LIMITS } from './config.mjs';
import { defineCoreCases } from './core.cases.mjs';
import { checkChange, checkChanges } from './rules.mjs';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));

defineCoreCases({
  describe,
  it,
  afterAll: after,
  config,
  LIMITS,
  checkChange,
  checkChanges,
  toolDir: TOOL_DIR,
  repoRoot: resolve(TOOL_DIR, '../..'),
  toolRelative: 'tools/quality',
  pathFor: (name) => `src/${name}.ts`,
});

// Detection is tested with every rule at full strength. The core cases pin which rules only warn.
const strict = { ...config, warningRules: new Set(), legacySizeGrowthWarns: false };
const report = (change, pathExists = () => true) =>
  checkChange({ change: { isNewPath: change.before == null, newFolders: [], ...change }, config: strict, pathExists });
const rulesOf = (change, pathExists) => report(change, pathExists).violations.map(({ rule }) => rule);

const COMPONENT = "import React from 'react';\nimport { View } from 'react-native';\n\nexport function GleapThing() {\n  return <View />;\n}\n";
const LOGIC = 'export const isOpen = (count: number) => count > 0;\n';

describe('scope', () => {
  for (const path of ['src/index.tsx', 'src/networklogger.ts', 'src/GleapBannerArea.tsx', 'src/bannerHeight.ts']) {
    it(`checks ${path}`, () => assert.equal(config.isInScope(path), true));
  }
  for (const path of [
    'src/__tests__/index.test.tsx',
    'src/__tests__/nativeContract.test.ts',
    'src/__fixtures__/sdk.ts',
    'src/__mocks__/react-native.ts',
    'src/thing.test.ts',
    'src/types.d.ts',
    'lib/commonjs/index.js',
    'example/App.tsx',
    'tools/quality/config.mjs',
    'android/src/main/java/com/reactnativegleapsdk/GleapsdkModule.java',
    'ios/Gleapsdk.m',
  ]) {
    it(`leaves ${path} alone`, () => assert.equal(config.isInScope(path), false));
  }
});

describe('names', () => {
  it('wants a component file in PascalCase', () => {
    assert.deepEqual(rulesOf({ path: 'src/gleapThing.tsx', after: COMPONENT }), ['file-name']);
    assert.deepEqual(rulesOf({ path: 'src/GleapThing.tsx', after: COMPONENT }), []);
  });

  it('wants a module file in camelCase', () => {
    assert.deepEqual(rulesOf({ path: 'src/TicketState.ts', after: LOGIC }), ['file-name']);
    assert.deepEqual(rulesOf({ path: 'src/ticketState.ts', after: LOGIC }), []);
  });

  it('rejects a new generic file name', () => {
    assert.deepEqual(rulesOf({ path: 'src/utils.ts', after: LOGIC }), ['generic-file-name']);
    assert.deepEqual(rulesOf({ path: 'src/constants.ts', after: 'export const A = 1;\n' }), ['generic-file-name']);
  });

  it('wants a new folder in camelCase', () => {
    assert.deepEqual(rulesOf({ path: 'src/Network/requestLog.ts', after: 'export const A = 1;\n', newFolders: ['src/Network'] }), ['folder-name']);
    assert.deepEqual(rulesOf({ path: 'src/network/requestLog.ts', after: 'export const A = 1;\n', newFolders: ['src/network'] }), []);
  });
});

describe('default exports', () => {
  it('lets src/index.tsx keep its default export, the public API', () => {
    const before = 'const GleapSdk = {};\nexport default GleapSdk;\n';
    assert.deepEqual(rulesOf({ path: 'src/index.tsx', before, after: `${before}export const x = 1;\n` }), []);
  });

  it('counts a new default export anywhere else', () => {
    assert.deepEqual(rulesOf({ path: 'src/GleapThing.tsx', after: `${COMPONENT}export default GleapThing;\n` }), ['default-export']);
  });
});

describe('needs-test', () => {
  // The core only knows a test next to the file, and src/x.test.ts would be published. testing.md asks for
  // src/__tests__/x.test.ts instead.
  it('asks for no test file, not even for new logic', () => {
    assert.deepEqual(rulesOf({ path: 'src/ticketState.ts', after: LOGIC }, () => false), []);
  });
});

describe('fixtures', () => {
  it('a .fixtures file in src has no line limit; test fixtures belong in src/__fixtures__, out of scope', () => {
    assert.equal(config.isFixture('src/network/requests.fixtures.ts'), true);
    assert.equal(config.isInScope('src/__fixtures__/requests.ts'), false);
  });
});

describe('string comparisons with values we do not own', () => {
  const compare = (expression) => rulesOf({ path: 'src/thing.ts', after: `export const f = () => ${expression};\n` });

  for (const expression of ["Platform.OS === 'android'", "request.method === 'POST'", "nextAppState === 'active'", "url.protocol === 'https:'"]) {
    it(`leaves ${expression}`, () => {
      assert.deepEqual(compare(expression), []);
    });
  }

  it('counts our own values', () => {
    assert.deepEqual(compare("data.type === 'conversation'"), ['string-compare']);
  });
});
