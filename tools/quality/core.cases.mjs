// Test cases of the shared core, byte-identical in Frontend and Server. Each repo runs them through its own test
// runner and config: nothing here knows about Vitest or node:test.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CORE_FILES = ['analyze.mjs', 'changes.mjs', 'check.mjs', 'core.cases.mjs', 'hooks.mjs', 'measure.mjs', 'moves.mjs', 'rules.mjs'];

const statements = (count, name = 'step') => Array.from({ length: count }, (_, i) => `  ${name}${i}();`).join('\n');
const moduleOf = (count) => Array.from({ length: count }, (_, i) => `export const v${i} = ${i};`).join('\n');
const plainFunction = (name, lines, bodyName = name) => `export const ${name} = () => {\n${statements(lines - 2, bodyName)}\n};`;
const dataTable = (count) =>
  `export const table = {\n${Array.from({ length: count }, (_, i) => `  key${i}: 'value ${i}',`).join('\n')}\n};`;
// Still fails with the levels for the start: a size overrun only warns there.
const broken = (lines) => `${plainFunction('run', lines)}\nconsole.log('x');`;
const rulesIn = (items) => items.map((item) => item.rule).sort();
const STUB = '#!/bin/sh\necho "$(basename "$0") $*" >> "$PWD/.stub-log"\n[ -f "$PWD/.stub-fail-$(basename "$0")" ] && { echo "$(basename "$0") is red"; exit 1; }\nexit 0\n';
const RUNNER_STUB =
  "const fs=require('node:fs');fs.appendFileSync('.stub-log','runner '+process.argv.slice(2).join(' ')+'\\n');process.exit(fs.existsSync('.stub-fail-runner')?1:0);\n";

export const defineCoreCases = ({ describe, it, afterAll, config, LIMITS, checkChange, checkChanges, toolDir, repoRoot, toolRelative, pathFor }) => {
  const LOGIC = pathFor('thing');
  // Detection is tested with every rule at full strength. Which rules only warn is pinned once, below.
  const strict = { ...config, warningRules: new Set(), legacySizeGrowthWarns: false };
  const report = (change, pathExists = () => true) =>
    checkChange({ change: { isNewPath: change.before == null, newFolders: [], ...change }, config: strict, pathExists });
  const rulesOf = (change, pathExists) => rulesIn(report(change, pathExists).violations);
  const reportAll = (changes, pathExists = () => true) =>
    checkChanges({
      changes: changes.map((change) => ({ isNewPath: change.before == null, newFolders: [], ...change })),
      config: strict,
      pathExists,
    });

  describe('the shared core', () => {
    it('is pinned, so the two copies cannot drift apart unnoticed', () => {
      const hash = createHash('sha256');
      for (const file of CORE_FILES) hash.update(readFileSync(join(toolDir, file)));
      const actual = hash.digest('hex');
      const pinned = readFileSync(join(toolDir, 'core.sha256'), 'utf8').trim();
      assert.equal(actual, pinned, `Core changed. Make the same change in the other repo, then put ${actual} in core.sha256 in both.`);
    });
  });

  describe('a ban that only the config knows', () => {
    const banned = {
      ...strict,
      extraCounters: [...strict.extraCounters, 'test-import'],
      bannedImports: [...strict.bannedImports, { rule: 'test-import', module: /^banned-package$/ }],
      fixes: { ...strict.fixes, 'test-import': 'Use the other package.' },
    };
    const before = 'export const v = 1;';
    const line = "import thing from 'banned-package';";
    const check = (change) => checkChange({ change: { isNewPath: false, newFolders: [], ...change }, config: banned, pathExists: () => true });
    it('names the fix from the config and reads like the others', () => {
      const [problem] = check({ path: LOGIC, before, after: `${line}\n${before}` }).violations;
      assert.equal(problem.rule, 'test-import');
      assert.equal(problem.fix, 'Use the other package.');
      assert.match(problem.subject, /^banned imports in this file, new at line 1$/);
    });
    it('leaves an import that was already there', () => {
      const old = `${line}\n${before}`;
      assert.deepEqual(check({ path: LOGIC, before: old, after: `${old}\nexport const w = 2;` }).violations, []);
    });
    for (const other of [
      "export { thing } from 'banned-package';",
      "export * from 'banned-package';",
      "const thing = require('banned-package');",
      "export const load = () => import('banned-package');",
    ]) {
      it(`counts ${other}`, () => {
        assert.equal(rulesIn(check({ path: LOGIC, before, after: `${other}\n${before}` }).violations).includes('test-import'), true);
      });
    }
    for (const typeOnly of [
      "import type { Thing } from 'banned-package';",
      "import { type Thing } from 'banned-package';",
      "export type { Thing } from 'banned-package';",
    ]) {
      it(`leaves ${typeOnly}: a type brings no second system`, () => {
        assert.deepEqual(check({ path: LOGIC, before, after: `${typeOnly}\n${before}` }).violations, []);
      });
    }
  });

  describe('a moved lazy require', () => {
    // Counted with the rule on, whether or not this repo's config counts lazy requires.
    const lazy = { ...strict, extraCounters: [...new Set([...strict.extraCounters, 'local-require'])] };
    const reportMoves = (changes) =>
      checkChanges({ changes: changes.map((change) => ({ isNewPath: change.before == null, newFolders: [], ...change })), config: lazy, pathExists: () => true });
    // Only this rule: a repo may also ban the `../` paths these use (the Frontend does).
    const lazyRules = (result) => rulesIn(result.violations).filter((rule) => rule === 'local-require');
    const lazyLoad = (specifier) => `export const moved = async () => {\n  const { thing } = require('${specifier}');\n  return thing();\n};`;
    const source = pathFor('source');
    // One folder further down: the same module is one more `../` away.
    const deeper = pathFor('deeper/target');

    it('stays old when it moves with its code to another folder and still loads the same module', () => {
      const result = reportMoves([
        { path: source, before: `${lazyLoad('./lib/thing')}\n${moduleOf(1)}`, after: moduleOf(1) },
        { path: deeper, after: lazyLoad('../lib/thing') },
      ]);
      assert.deepEqual(lazyRules(result), []);
    });
    it('is new when the moved code loads another module', () => {
      const result = reportMoves([
        { path: source, before: `${lazyLoad('./lib/thing')}\n${moduleOf(1)}`, after: moduleOf(1) },
        { path: deeper, after: lazyLoad('../lib/other') },
      ]);
      assert.deepEqual(lazyRules(result), ['local-require']);
    });
    it('is new when nothing that loads it moved', () => {
      const result = reportMoves([{ path: deeper, after: lazyLoad('../lib/thing') }]);
      assert.deepEqual(lazyRules(result), ['local-require']);
    });
  });

  describe('moved code', () => {
    const big = plainFunction('moved', 90);
    const dirty = (extra = '') =>
      `export const moved = (a: any, b: string, c: string) => {\n  console.log(a);\n  if (b === 'OPEN') c.trim();\n${statements(90, 'moved')}\n${extra}};`;

    it('is old when a function moves to a new file', () => {
      const result = reportAll([
        { path: pathFor('source'), before: `${dirty()}\n${moduleOf(3)}`, after: moduleOf(3) },
        { path: pathFor('target'), after: dirty() },
      ]);
      assert.deepEqual(rulesIn(result.violations), []);
    });
    it('is old when a deleted file moves into two new files', () => {
      const one = plainFunction('one', 90);
      const two = plainFunction('two', 90);
      const result = reportAll([
        { path: pathFor('source'), before: `${one}\n${two}`, after: null },
        { path: pathFor('first'), after: one },
        { path: pathFor('second'), after: two },
      ]);
      assert.deepEqual(rulesIn(result.violations), []);
    });
    it('stays old when the move adds export', () => {
      const line = 'const moved = (x: any) => x;';
      const result = reportAll([
        { path: pathFor('source'), before: `${line}\nexport const kept = moved;`, after: 'export const kept = 1;' },
        { path: pathFor('target'), after: `export ${line}` },
      ]);
      assert.deepEqual(rulesIn(result.violations), []);
    });
    it('is new again when the moved function grew', () => {
      const result = reportAll([
        { path: pathFor('source'), before: big, after: moduleOf(1) },
        { path: pathFor('target'), after: plainFunction('moved', 120) },
      ]);
      assert.deepEqual(rulesIn(result.violations), ['function-lines']);
      assert.equal(result.violations[0].before, 90);
    });
    it('does not hide new problems in the new file', () => {
      const result = reportAll([
        { path: pathFor('source'), before: big, after: moduleOf(1) },
        { path: pathFor('target'), after: `${big}\nexport const fresh = (x: any, y: any, z: any) => [x, y, z];` },
      ]);
      assert.deepEqual(rulesIn(result.violations), ['any', 'params']);
    });
    it('renames in a file by the hash of the body', () => {
      const before = 'export const oldName = (a, b, c) => a + b + c;';
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: 'export const newName = (a, b, c) => a + b + c;' }), []);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: 'export const newName = (a, b, c) => a - b - c;' }), ['params']);
    });
    it('does not count moved lines against a new file over the limit', () => {
      const body = moduleOf(450);
      assert.deepEqual(
        rulesIn(reportAll([{ path: pathFor('source'), before: body, after: null }, { path: pathFor('target'), after: body }]).violations),
        []
      );
      const fresh = (count) => Array.from({ length: count }, (_, i) => `export const fresh${i} = ${i};`).join('\n');
      const withFresh = (count) =>
        reportAll([{ path: pathFor('source'), before: body, after: null }, { path: pathFor('target'), after: `${body}\n${fresh(count)}` }]);
      assert.deepEqual(rulesIn(withFresh(450).violations), []);
      assert.deepEqual(rulesIn(withFresh(450).notes), ['file-lines']);
      assert.deepEqual(rulesIn(withFresh(750).violations), ['file-lines']);
    });
    it('still fails an existing file that takes in moved code over its limit', () => {
      const moved = Array.from({ length: 30 }, (_, i) => `export const moved${i} = ${i};`).join('\n');
      const result = reportAll([
        { path: pathFor('source'), before: moved, after: moduleOf(1) },
        { path: pathFor('target'), before: moduleOf(500), after: `${moduleOf(500)}\n${moved}` },
      ]);
      assert.deepEqual(rulesIn(result.violations), ['file-lines']);
    });
    it('drops needs-test only when nearly all of a new file is moved code', () => {
      const logic = 'logic';
      const stem = pathFor(logic);
      const source = plainFunction('moved', 50);
      const noTest = (candidate) => !candidate.startsWith(stem.replace(/\.tsx?$/, ''));
      const movedOnly = reportAll(
        [{ path: pathFor('source'), before: source, after: moduleOf(1) }, { path: stem, after: source }],
        noTest
      );
      assert.ok(!rulesIn(movedOnly.violations).includes('needs-test'));
      if (!config.testCandidates({ path: stem, facts: { functions: new Map([['x', {}]]), definesComponent: false } })) return;
      const mostlyNew = reportAll(
        [{ path: pathFor('source'), before: source, after: moduleOf(1) }, { path: stem, after: `${source}\n${plainFunction('fresh', 30)}` }],
        noTest
      );
      assert.ok(rulesIn(mostlyNew.violations).includes('needs-test'));
    });
    it('does not count the imports of a new file against the moved share', () => {
      const stem = pathFor('logic');
      const source = plainFunction('moved', 20);
      const imports = Array.from({ length: 5 }, (_, i) => `import { a${i} } from './a${i}';`).join('\n');
      const noTest = (candidate) => !candidate.startsWith(stem.replace(/\.tsx?$/, ''));
      const result = reportAll(
        [{ path: pathFor('source'), before: source, after: moduleOf(1) }, { path: stem, after: `${imports}\n${source}` }],
        noTest
      );
      assert.ok(!rulesIn(result.violations).includes('needs-test'));
    });
    it('keeps honest name problems on moved code', () => {
      const result = reportAll([
        { path: pathFor('source'), before: moduleOf(5), after: null },
        { path: 'src/helper/bad_name.ts', after: moduleOf(5) },
      ]);
      assert.deepEqual(rulesIn(result.violations), ['file-name']);
    });
  });

  describe('small growth', () => {
    it('has one number, in the config', () => assert.equal(LIMITS.smallGrowthLines, 10));
    it('of a file already over its limit is a note up to the number, then a failure', () => {
      const at = (growth) => report({ path: LOGIC, before: moduleOf(410), after: moduleOf(410 + growth) });
      assert.deepEqual(rulesIn(at(10).violations), []);
      assert.deepEqual(rulesIn(at(10).notes), ['file-lines']);
      assert.deepEqual(rulesIn(at(11).violations), ['file-lines']);
      assert.deepEqual(rulesIn(at(11).notes), []);
    });
    it('of a function already over its limit is a note up to the number, then a failure', () => {
      const at = (growth) => report({ path: LOGIC, before: plainFunction('run', 90), after: plainFunction('run', 90 + growth) });
      assert.deepEqual(rulesIn(at(10).violations), []);
      assert.deepEqual(rulesIn(at(10).notes), ['function-lines']);
      assert.deepEqual(rulesIn(at(11).violations), ['function-lines']);
    });
    it('crossing a limit is a warning, because nothing was too big before', () => {
      const file = report({ path: LOGIC, before: moduleOf(399), after: moduleOf(401) });
      assert.deepEqual(rulesIn(file.violations), []);
      assert.deepEqual(rulesIn(file.notes), ['file-lines']);
      const fn = report({ path: LOGIC, before: plainFunction('run', 79), after: plainFunction('run', 81) });
      assert.deepEqual(rulesIn(fn.violations), []);
      assert.deepEqual(rulesIn(fn.notes), ['function-lines']);
    });
    it('crossing the maximum for a new file is an error', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: moduleOf(399), after: moduleOf(701) }), ['file-lines']);
    });
  });

  describe('quality-allow over time', () => {
    const fn = (lines, comment = '') => `${comment}${plainFunction('run', lines)}`;
    const old = '// quality-allow function-lines: one state machine\n';
    it('an old size allow does not cover further growth', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: fn(90, old), after: fn(120, old) }), ['function-lines']);
    });
    it('an old size allow still stands while nothing grows', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: fn(90, old), after: fn(90, old) }), []);
    });
    it('a new reason covers the growth and is reported', () => {
      const result = report({ path: LOGIC, before: fn(90, old), after: fn(120, '// quality-allow function-lines: a new reason\n') });
      assert.deepEqual(rulesIn(result.violations), []);
      assert.deepEqual(result.allows.map((allow) => allow.reason), ['a new reason']);
    });
    it('reports every new allow per line, also with a repeated reason', () => {
      const allow = '// quality-allow any: untyped library\n';
      const line = (name) => `export const ${name} = (x) => x as any;\n`;
      const before = `${allow}${line('a')}`;
      const result = report({ path: LOGIC, before, after: `${before}${allow}${line('b')}${allow}${line('c')}` });
      assert.deepEqual(rulesIn(result.violations), []);
      assert.deepEqual(result.allows.map((item) => item.line), [3, 5]);
    });
  });

  describe('parameter growth', () => {
    it('fails when an existing function over the limit gains parameters', () => {
      const result = report({ path: LOGIC, before: 'export const f = (a, b, c) => a;', after: 'export const f = (a, b, c, d) => a;' });
      assert.deepEqual(rulesIn(result.violations), ['params']);
      assert.deepEqual([result.violations[0].before, result.violations[0].after], [3, 4]);
    });
    it('fails when an existing function crosses the limit', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: 'export const f = (a, b) => a;', after: 'export const f = (a, b, c) => a;' }), ['params']);
    });
    it('passes when the count stays or falls', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: 'export const f = (a, b, c, d) => a;', after: 'export const f = (a, b, c) => a;' }), []);
    });
  });

  describe('string comparisons that hide', () => {
    const body = (line) => `export const run = (x) => {\n  ${line}\n};`;
    const before = body('x();');
    for (const line of [
      "if (x.status === ('OPEN')) x();",
      "if (x.status === 'OPEN' as Status) x();",
      "if (x.status === ('OPEN' satisfies Status)) x();",
      "if ((x.status as string) === 'OPEN') x();",
      "switch (x.status) {\n    case ('OPEN'):\n      x();\n  }",
      "if (task.origin === 'schedule') x();",
      "if (task.host === 'kai') x();",
      "if (x === 'Enter') x();",
    ]) {
      it(`red: ${line.split('\n')[0]}`, () => assert.ok(rulesOf({ path: LOGIC, before, after: body(line) }).includes('string-compare')));
    }
    for (const line of ["if (url.origin === 'https://a.b') x();", "if (window.location.pathname === '/x') x();", "if (new URL(x).hostname === 'a.b') x();"]) {
      it(`green: ${line}`, () => assert.deepEqual(rulesOf({ path: LOGIC, before, after: body(line) }), []));
    }
  });

  describe('scope', () => {
    const bad = `// @ts-ignore\nexport const f = (a: any) => a;`;
    it('takes in .mts, .cts, .js and .mjs under src', () => {
      for (const extension of ['mts', 'cts', 'js', 'mjs', 'cjs', 'jsx']) {
        const path = `src/helper/thing.${extension}`;
        assert.ok(config.isInScope(path), path);
      }
    });
    it('takes in real code under a templates or test folder', () => {
      assert.ok(rulesOf({ path: 'src/foo/templates/real.ts', after: bad }).includes('any'));
      assert.ok(rulesOf({ path: 'src/foo/test/real.ts', after: bad }).includes('any'));
    });
    it('a fixture name lifts the line limit, not the other rules', () => {
      const big = `${moduleOf(500)}\n${plainFunction('factory', 120)}`;
      assert.deepEqual(rulesOf({ path: 'src/foo/thing.fixtures.ts', after: big }), []);
      assert.deepEqual(rulesOf({ path: 'src/foo/thing.fixtures.ts', after: bad }), ['any', 'ts-ignore']);
    });
    it('leaves out generated files', () => assert.ok(!config.isInScope('src/services/gleapKnowledge/dashboardMap.generated.ts')));
    it('a file of plain data has no line limit, whatever its name', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: dataTable(500), after: dataTable(600) }), []);
      assert.deepEqual(rulesOf({ path: pathFor('fresh'), after: dataTable(600) }), []);
    });
    it('data does not hide logic', () => {
      const withLogic = `${dataTable(300)}\n${Array.from({ length: 500 }, (_, i) => `export const f${i} = () => ${i};`).join('\n')}`;
      assert.deepEqual(rulesOf({ path: pathFor('fresh'), after: withLogic }), ['file-lines']);
    });
  });

  describe('size levels', () => {
    it('has the numbers in the config', () => {
      assert.equal(LIMITS.fileLines, 400);
      assert.equal(LIMITS.newFileLines, 700);
    });
    it('a new file: warning over 400, error over 700', () => {
      const at = (lines) => report({ path: LOGIC, after: moduleOf(lines) });
      assert.deepEqual([rulesIn(at(400).violations), rulesIn(at(400).notes)], [[], []]);
      assert.deepEqual([rulesIn(at(401).violations), rulesIn(at(401).notes)], [[], ['file-lines']]);
      assert.deepEqual([rulesIn(at(700).violations), rulesIn(at(700).notes)], [[], ['file-lines']]);
      assert.deepEqual([rulesIn(at(701).violations), rulesIn(at(701).notes)], [['file-lines'], []]);
    });
    it('a new function over its limit is a warning', () => {
      const result = report({ path: LOGIC, after: plainFunction('fresh', 81) });
      assert.deepEqual([rulesIn(result.violations), rulesIn(result.notes)], [[], ['function-lines']]);
    });
    it('the ratchet stays: an existing function or file over its limit may not grow', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: plainFunction('run', 90), after: plainFunction('run', 101) }), ['function-lines']);
      assert.deepEqual(rulesOf({ path: LOGIC, before: moduleOf(450), after: moduleOf(461) }), ['file-lines']);
    });
  });

  describe('assertions', () => {
    const before = 'export const v = 1;';
    const added = (line) => `${before}\n${line}`;
    it('red: as', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('export const a = (x: unknown) => x as Thing;') }), ['type-assertion']);
    });
    it('red: !', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('export const a = (x: Thing) => x.y!.z;') }), ['non-null-assertion']);
    });
    it('green: as const, satisfies, renamed imports, !x and a declared field', () => {
      for (const line of [
        "export const a = ['x'] as const;",
        'export const a = { x: 1 } satisfies Thing;',
        "import { x as y } from './x';",
        'export const a = (x: boolean) => !x;',
        'export class A {\n  x!: string;\n}',
      ]) {
        assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(line) }), [], line);
      }
    });
    it('as unknown as T counts as any, or agents move there', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('export const a = (x: Other) => x as unknown as Thing;') }), ['any']);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('export const a = (x: Other) => (x as unknown) as Thing;') }), ['any']);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('export const a = (x: Other) => x as unknown;') }), ['type-assertion']);
    });
    it('as any counts once, as any', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('export const a = (x: unknown) => x as any;') }), ['any']);
    });
    it('only on new lines: an old one stays', () => {
      const old = added('export const a = (x: unknown) => x as Thing;');
      assert.deepEqual(rulesOf({ path: LOGIC, before: old, after: `${old}\nexport const z = 1;` }), []);
    });
    it('red and green: const enum', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added("export const enum K {\n  A = 'A',\n}") }), ['const-enum']);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added("export enum K {\n  A = 'A',\n}") }), []);
    });
  });

  describe('ts-expect-error', () => {
    const before = 'export const run = (x) => {\n  x();\n};';
    const added = (comment) => `export const run = (x) => {\n  ${comment}\n  x();\n};`;
    it('is fine with a reason', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('// @ts-expect-error the library has the wrong type') }), []);
    });
    it('is not without one', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('// @ts-expect-error') }), ['ts-ignore']);
    });
    it('@ts-ignore never is', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added('// @ts-ignore the library has the wrong type') }), ['ts-ignore']);
    });
  });

  describe('a rule that is too loud', () => {
    it('as and string comparisons only warn: too many hits cannot be avoided', () => {
      const before = 'export const v = 1;';
      const after = `${before}\nexport const a = (x: unknown) => x as Thing;\nexport const b = (x) => x === 'OPEN';`;
      const change = { path: LOGIC, before, after, isNewPath: false, newFolders: [] };
      const result = checkChange({ change, config, pathExists: () => true });
      assert.deepEqual([rulesIn(result.violations), rulesIn(result.notes)], [[], ['string-compare', 'type-assertion']]);
    });
    it('while the check is not required: long lines, missing tests and growth of old code only warn', () => {
      const real = (change, pathExists = () => true) =>
        checkChange({ change: { isNewPath: change.before == null, newFolders: [], ...change }, config, pathExists });
      const width = `export const a${'b'.repeat(170)} = 1;`;
      const levels = (result) => [rulesIn(result.violations), rulesIn(result.notes)];
      assert.deepEqual(levels(real({ path: LOGIC, before: moduleOf(1), after: `${moduleOf(1)}\n${width}` })), [[], ['long-line']]);
      assert.deepEqual(levels(real({ path: LOGIC, before: moduleOf(500), after: moduleOf(600) })), [[], ['file-lines']]);
      assert.deepEqual(levels(real({ path: LOGIC, before: moduleOf(399), after: moduleOf(800) })), [[], ['file-lines']]);
      assert.deepEqual(levels(real({ path: LOGIC, before: plainFunction('run', 90), after: plainFunction('run', 150) })), [[], ['function-lines']]);
      assert.equal(config.warningRules.has('needs-test'), true);
    });
    it('a new file over the maximum still fails', () => {
      const change = { path: LOGIC, after: moduleOf(701), isNewPath: true, newFolders: [] };
      assert.deepEqual(rulesIn(checkChange({ change, config, pathExists: () => true }).violations), ['file-lines']);
    });
    it('can be a warning through the config, without touching the core', () => {
      const before = 'export const v = 1;';
      const after = `${before}\nexport const a = (x: any) => x;`;
      const quiet = { ...config, warningRules: new Set(['any']) };
      const change = { path: LOGIC, before, after, isNewPath: false, newFolders: [] };
      const result = checkChange({ change, config: quiet, pathExists: () => true });
      assert.deepEqual([rulesIn(result.violations), rulesIn(result.notes)], [[], ['any']]);
    });
  });

  describe('comment-reference', () => {
    const before = 'export const v = 1;';
    const added = (comment) => `${before}\n${comment}\nexport const w = 2;`;
    for (const comment of [
      '// see #12345',
      '// fixed in PR 123',
      '// PR #2752 moved this',
      '// ticket 12345',
      '// Ticket #148144 asked for this',
      '// the view (Server#2271) needs it',
      '// a customer hit this (Gleap #227529)',
      '// the "Pass to Flow" step was skipped (#227518)',
      '// tickets #129850 and #129851',
      '/* comes from #2752 */',
      '/**\n * A block comment.\n * It names #148144 on a later line.\n */',
    ]) {
      it(`red: ${comment.split('\n')[0]}`, () => {
        assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), ['comment-reference']);
      });
    }
    for (const comment of [
      '// step #1 of the list',
      '// #12 is not a ticket yet',
      '// PR 12',
      '// the #fff background',
      '// #0000ff on white',
      '// `#333` on white, and #000 for text',
      '// #000000 is black',
      '// color: #00000080 beats the utility',
      '// https://github.com/acme/lib/issues/12345 explains the workaround',
      '// see https://example.com/page#12345',
      '// the number 12345 is the limit',
      '// #121212 is the dark background',
      '// #808080 grey',
      '// #123 is short for a colour',
      '// the entity &#233; in a name',
      '// tickets 100 per page',
      '// a page holds 100 tickets 250 at most',
      '// the footer reads "Server #2641 · started by Kai"',
      '// the title says `Review PR #2387`',
    ]) {
      it(`green: ${comment}`, () => {
        assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), []);
      });
    }
    it('green: a number in a string is no comment', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `${before}\nexport const s = 'see #12345';` }), []);
    });
    it('green: an old comment stays while the file changes', () => {
      const old = added('// see #12345');
      assert.deepEqual(rulesOf({ path: LOGIC, before: old, after: `${old}\nexport const z = 1;` }), []);
    });
    it('green: a comment that only moved', () => {
      const comment = '// see #12345';
      const result = reportAll([
        { path: pathFor('source'), before: added(comment), after: before },
        { path: pathFor('target'), after: `${comment}\nexport const w = 2;` },
      ]);
      assert.ok(!rulesIn(result.violations).includes('comment-reference'));
    });
    it('red: a new number is not paid for by removing an old one', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: added('// see #12345'), after: added('// see #54321') }), ['comment-reference']);
    });
    it('a block comment is reported where it starts, and can be allowed above that', () => {
      const block = '/**\n * A block comment.\n * It names #148144 on a later line.\n */';
      const [violation] = report({ path: LOGIC, before, after: added(block) }).violations;
      assert.equal(violation.line, 2);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(`// quality-allow comment-reference: the name of a customer's incident\n${block}`) }), []);
    });
    it('says where the number belongs', () => {
      const [violation] = report({ path: LOGIC, before, after: added('// see #12345') }).violations;
      assert.equal(violation.line, 2);
      assert.match(violation.fix, /belongs in the PR/);
    });
  });

  describe('comment-attribution and comment-date', () => {
    const before = 'export const v = 1;';
    const added = (comment) => `${before}\n${comment}\nexport const w = 2;`;
    const levels = (result) => [rulesIn(result.violations), rulesIn(result.notes)];
    for (const comment of [
      '// 24px under the header (Lukas)',
      '// the list fades out (Lukas 10-27)',
      '// one row per agent (Luca, 2026-10-07)',
      "// the rail's icons, picked by Florian",
      '// per Tobias: no email for this',
      '// Florian wanted the old order',
      '// Lukas said the badge reads as noise',
      '// Lukas: no Free plan without a card',
      "// Lukas' restructure keeps the tabs",
      '// Push and in-app only (10-27)',
      '// the dialog frame (2026-10-21): an 18px title',
      '// one card (review 10-31): no gap between them',
      '// the setup card (Kai PM folded in, 10-27)',
      '/**\n * One card for both.\n * (Lukas 10-25)\n */',
      '/**\n * The order stays (decided in the\n * review 10-31) for every board.\n */',
      '// The order stays (decided in the\n// review 10-31) for every board.',
      '// one card (the list (left) and the pane, 10-31)',
    ]) {
      it(`red: ${comment.split('\n').join(' ')}`, () => {
        assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), ['comment-attribution']);
      });
    }
    for (const comment of [
      '// Kai answers first, Kai Support drafts',
      '// the thread in Claude Code style',
      '// Simonyi notation for the handles',
      '// Alias of the old name',
      '// the line reads "Florian drives · Kai Support"',
      '/**\n * The pane folds it: "Not sent: the reply to Sam, Florian\n * answered first".\n */',
      '// a scrape takes 10-20 s',
      '// waits (10-15 s) for the scrape',
      '// keeps 2026-01-01 → 2026-12-31 as the year',
      '// semver 1.10-12 is no date',
      '// the key is report-2026-10-21-eu',
      '// the fixture holds `2026-10-21`',
      '// a share of (10-20%) of the rows',
      '// (10-20 %) of the rows',
      '// 10-12× faster than before',
      '// a summary (10-12 words) per ticket',
      '// a budget (10-30 tokens) per step',
      '// the poll waits (10-15 sec)',
      '// the label size (12-14 pt)',
      '// the retention offer ends (2026-12-03 + 2 months)',
      '// the window (2026-10-01..2026-10-31)',
      '// the batch covers 2026-07-15…08-14',
      '// the Twilio API (the 2010-04-01 paths)',
      '// the header anthropic-version (2023-06-01)',
      '// the expiry (an ISO date, e.g. 2026-10-27 at noon)',
      "// @example formatDate('2026-10-21')",
      '// the label reads “Florian drives”',
      '// see https://example.com/2026-10-21/notes',
      '// the job runs (10-20 seconds)',
      '// a pause (10-15 minutes) between runs',
      '// a drop (10-20 percent) in replies',
      '// a page (10-12 rows) at a time',
      '// a burst (10-12 requests) per user',
      '// the budget (10-12 calls) per run',
      '// gives up (01-05 retries) later',
      '// the window (10-01 - 10-31) of the report',
    ]) {
      it(`green: ${comment.split('\n').join(' ')}`, () => {
        assert.deepEqual(levels(report({ path: LOGIC, before, after: added(comment) })), [[], []]);
      });
    }
    for (const comment of [
      '// Removed with the 07-29 rebuild and restored 08-07',
      '// the stall on 09-28 went unnoticed',
      '// agents created before 2026-10-21 have no avatar',
      '// a fallback (agents created before 2026-10-21 have no avatar)',
    ]) {
      it(`date only: ${comment}`, () => {
        assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), ['comment-date']);
      });
    }
    it('green: a name in a string is no comment', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `${before}\nexport const s = '(Lukas 10-27)';` }), []);
    });
    it('green: an old stamp stays while the file changes', () => {
      const old = added('// the list fades out (Lukas 10-27)');
      assert.deepEqual(rulesOf({ path: LOGIC, before: old, after: `${old}\nexport const z = 1;` }), []);
    });
    it('green: a stamped comment that only moved', () => {
      const comment = '// the list fades out (Lukas 10-27)';
      const result = reportAll([
        { path: pathFor('source'), before: added(comment), after: before },
        { path: pathFor('target'), after: `${comment}\nexport const w = 2;` },
      ]);
      assert.ok(!rulesIn(result.violations).includes('comment-attribution'));
    });
    it('red: an edited comment that keeps its stamp', () => {
      const after = added('// the whole list fades out (Lukas 10-27)');
      assert.deepEqual(rulesOf({ path: LOGIC, before: added('// the list fades out (Lukas 10-27)'), after }), ['comment-attribution']);
    });
    it('a stamp can be allowed on the line above', () => {
      const comment = '// quality-allow comment-attribution: names the customer the format comes from\n// the format of Florian Ltd (Florian)';
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), []);
    });
    it('a stamp inside a run of line comments is allowed on the line right above it', () => {
      const comment = '// the format of\n// quality-allow comment-attribution: names the customer the format comes from\n// Florian Ltd (Florian)';
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), []);
    });
    it('an allow above a run of line comments covers the whole run', () => {
      const comment = '// quality-allow comment-attribution: names the customer the format comes from\n// the format of\n// Florian Ltd (Florian)';
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), []);
    });
    it('an allow above a run covers only its own rule', () => {
      const comment = '// quality-allow comment-date: the cutoff the import depends on\n// the format of\n// Florian Ltd (Florian)';
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), ['comment-attribution']);
    });
    it('red: an allow for another rule inside a block comment does not hide its stamp', () => {
      const comment = '/**\n * quality-allow function-lines: one table of all the plans\n * fades out (Lukas 10-27)\n */';
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(comment) }), ['comment-attribution']);
    });
    it('an allow comment that names a teammate or a date is not a stamp itself', () => {
      const name = "// quality-allow comment-attribution: Florian Ltd's export format\n// the format of Florian Ltd (Florian)";
      const date = '// quality-allow comment-date: the cutoff 2026-10-21 is when the field arrived\n// agents created before 2026-10-21 have no avatar';
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(name) }), []);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: added(date) }), []);
    });
    it('green: an old stamp stays old when the lines around it change', () => {
      const run = (rest) => added(`// The list fades out (Lukas 10-27)\n${rest}`);
      const block = (rest) => added(`/**\n * The list fades out.\n * (Lukas 10-25)\n * ${rest}\n */`);
      const levelsOf = (beforeText, afterText) => levels(report({ path: LOGIC, before: beforeText, after: afterText }));
      assert.deepEqual(levelsOf(run('// over 200 ms.'), run('// over 300 ms.')), [[], []]);
      assert.deepEqual(levelsOf(run('// over 200 ms.'), run('// over 200 ms.\n// and then stops.')), [[], []]);
      assert.deepEqual(levelsOf(block('Over 200 ms.'), block('Over 300 ms.')), [[], []]);
    });
    it('green: an old stamp in a trailing comment stays old when the next line changes', () => {
      const code = (gap) => `export const a = 1; // fades (Lukas 10-27)\nexport const c = 2; // ${gap}`;
      assert.deepEqual(rulesOf({ path: LOGIC, before: code('the gap'), after: code('the wider gap') }), []);
    });
    it('green: a stamped comment that moved under another comment', () => {
      const comment = '// the list fades out (Lukas 10-27)';
      const result = reportAll([
        { path: pathFor('source'), before: added(comment), after: before },
        { path: pathFor('target'), after: `// ---- helpers\n${comment}\nexport const w = 2;` },
      ]);
      assert.ok(!rulesIn([...result.violations, ...result.notes]).includes('comment-attribution'));
    });
    it('reports the line of a stamp that wraps over line comments', () => {
      const comment = '// The order stays (decided in the\n// review 10-31) for every board.';
      const [violation] = report({ path: LOGIC, before, after: added(comment) }).violations;
      assert.equal(violation.line, 3);
    });
    it('reads a comment full of dates in linear time', () => {
      const dates = Array.from({ length: 20000 }, () => '10-27').join(' and ');
      const started = performance.now();
      report({ path: LOGIC, before, after: added(`/* ${dates} */`) });
      assert.ok(performance.now() - started < 2000);
    });
    it('says to keep the reason and move the rest to the PR', () => {
      const [violation] = report({ path: LOGIC, before, after: added('// fades out (Lukas 10-27)') }).violations;
      assert.equal(violation.line, 2);
      assert.match(violation.fix, /Remove the name or date and keep the reason/);
      assert.match(violation.fix, /PR/);
      const [note] = report({ path: LOGIC, before, after: added('// the stall on 09-28 went unnoticed') }).violations;
      assert.match(note.fix, /PR/);
    });
    it('only warn, a name and a date in parentheses too', () => {
      const real = (comment) => checkChange({ change: { path: LOGIC, before, after: added(comment), isNewPath: false, newFolders: [] }, config, pathExists: () => true });
      assert.deepEqual(levels(real('// fades out (Lukas 10-27)')), [[], ['comment-attribution']]);
      assert.deepEqual(levels(real('// the stall on 09-28 went unnoticed')), [[], ['comment-date']]);
    });
  });

  describe('@Request() request: any', () => {
    const method = (signature) => `export class ThingController {\n  public run(${signature}) {\n    return 1;\n  }\n}`;
    const before = 'export class ThingController {}';
    it('is exempt, exactly this decorated parameter', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: method('@Request() request: any') }), []);
    });
    it('does not cover another parameter or decorator', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: method('@Body() body: any') }), ['any']);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: method('@Request() request: any, other: any') }), ['any']);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: method('request: any') }), ['any']);
    });
  });

  describe('long lines', () => {
    const before = 'export const v = 1;';
    const code = (width) => `export const a${'b'.repeat(width - 'export const a = 1;'.length)} = 1;`;
    it('has its limit in the config', () => assert.equal(LIMITS.lineChars, 160));
    it('red and green at the limit', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `${before}\n${code(161)}` }), ['long-line']);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `${before}\n${code(160)}` }), []);
    });
    it('red: many statements squeezed onto one line', () => {
      const squeezed = Array.from({ length: 200 }, (_, i) => `step${i}();`).join(' ');
      assert.deepEqual(rulesOf({ path: LOGIC, before: 'export const v = () => {};', after: `export const v = () => { ${squeezed} };` }), ['long-line']);
    });
    it('strings, templates and comments do not count', () => {
      const text = 'x'.repeat(300);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `export const s = '${text}';` }), []);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `export const s = \`${text}\`;` }), []);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `export const s = 1; // ${text}` }), []);
    });
    it('a regular expression cannot be broken up', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `export const r = /${'a|'.repeat(150)}b/;` }), []);
    });
    it('import and re-export lists are no squeezed code', () => {
      const names = Array.from({ length: 40 }, (_, i) => `name${i}`).join(', ');
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `import { ${names} } from './other';\n${before}` }), []);
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `export { ${names} } from './other';\n${before}` }), []);
    });
    it('green: a long line that got shorter, red: one that grew', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: code(216), after: code(201) }), []);
      assert.deepEqual(rulesOf({ path: LOGIC, before: code(216), after: code(230) }), ['long-line']);
    });
    it('red: a shortened line does not pay for a second new one', () => {
      const other = code(180).replace('export const a', 'export const c');
      assert.deepEqual(rulesOf({ path: LOGIC, before: code(216), after: `${code(201)}\n${other}` }), ['long-line']);
    });
    it('an old long line that did not change passes', () => {
      const old = code(200);
      assert.deepEqual(rulesOf({ path: LOGIC, before: old, after: `${old}\nexport const z = 1;` }), []);
    });
    it('a moved long line is old', () => {
      const old = code(200);
      const result = reportAll([
        { path: pathFor('source'), before: old, after: moduleOf(1) },
        { path: pathFor('target'), after: old },
      ]);
      assert.deepEqual(rulesIn(result.violations), []);
    });
  });

  describe('syntax errors', () => {
    it('fail, because nothing else can be measured on them', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: moduleOf(1), after: 'export const x = (;' }), ['parse-error']);
    });
    it('in the old version do not count', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before: 'export const x = (;', after: moduleOf(1) }), []);
    });
  });

  describe('console', () => {
    const before = 'export const run = (x) => x;';
    for (const line of [
      'console.info(1);',
      'console.debug(1);',
      'console.table(1);',
      'window.console.log(1);',
      'globalThis.console.log(1);',
      "console['log'](1);",
      'const { log } = console;',
    ]) {
      it(`red: ${line}`, () => assert.deepEqual(rulesOf({ path: LOGIC, before, after: `${before}\n${line}` }), ['console-log']));
    }
    it('green: error and warn', () => {
      assert.deepEqual(rulesOf({ path: LOGIC, before, after: `${before}\nconsole.error(1);\nconsole.warn(1);` }), []);
    });
  });

  describe('generic-file-name', () => {
    for (const name of ['index.ts', 'index.tsx', 'types.ts', 'utils.ts', 'helpers.ts', 'controller.ts', 'model.ts']) {
      it(`red: a new ${name}`, () => {
        assert.deepEqual(rulesOf({ path: `src/helper/${name}`, after: moduleOf(1) }), ['generic-file-name']);
      });
    }
    it('green: an existing one, also moved with its folder', () => {
      assert.deepEqual(rulesOf({ path: 'src/helper/index.ts', before: moduleOf(1), after: moduleOf(2) }), []);
      assert.deepEqual(
        rulesOf({ path: 'src/other/index.ts', previousPath: 'src/helper/index.ts', before: moduleOf(1), after: moduleOf(1), isNewPath: true }),
        []
      );
    });
    it('red: a rename into one', () => {
      assert.deepEqual(
        rulesOf({ path: 'src/helper/index.ts', previousPath: pathFor('thing'), before: moduleOf(1), after: moduleOf(1), isNewPath: true }),
        ['generic-file-name']
      );
    });
  });

  const repos = [];
  afterAll(() => {
    for (const repo of repos) rmSync(repo, { recursive: true, force: true });
  });
  const git = (repo, ...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
      cwd: repo,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  const put = (repo, path, content) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  };
  const makeRepo = (files = {}) => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), 'quality-core-')));
    repos.push(repo);
    cpSync(toolDir, join(repo, toolRelative), { recursive: true });
    cpSync(join(repoRoot, '.claude/hooks'), join(repo, '.claude/hooks'), { recursive: true });
    writeFileSync(join(repo, '.gitignore'), 'node_modules\n.stub-*\n');
    mkdirSync(join(repo, 'node_modules/.bin'), { recursive: true });
    symlinkSync(join(repoRoot, 'node_modules/typescript'), join(repo, 'node_modules/typescript'));
    for (const name of ['tsc', 'vitest', 'eslint']) {
      writeFileSync(join(repo, 'node_modules/.bin', name), STUB);
      chmodSync(join(repo, 'node_modules/.bin', name), 0o755);
    }
    put(repo, 'package.json', JSON.stringify({ name: 'fixture', scripts: { typecheck: 'tsc' } }));
    put(repo, 'scripts/test/run.cjs', RUNNER_STUB);
    git(repo, 'init', '-q', '-b', 'master');
    for (const [path, content] of Object.entries(files)) put(repo, path, content);
    git(repo, 'add', '.');
    git(repo, 'commit', '-qm', 'base');
    git(repo, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
    git(repo, 'switch', '-qc', 'feature');
    return repo;
  };
  const run = (repo, ...args) => {
    const result = spawnSync(process.execPath, [join(repo, toolRelative, 'check.mjs'), ...args], { cwd: repo, encoding: 'utf8' });
    return { code: result.status, out: `${result.stdout}${result.stderr}` };
  };
  const hook = (repo, name, input, cwd = repo) => {
    const result = spawnSync(process.execPath, [join(repo, '.claude/hooks', name)], {
      cwd,
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    });
    return { code: result.status, out: result.stdout, err: result.stderr };
  };
  const stubLog = (repo) => (existsSync(join(repo, '.stub-log')) ? readFileSync(join(repo, '.stub-log'), 'utf8') : '');
  const clearLog = (repo) => rmSync(join(repo, '.stub-log'), { force: true });
  const stop = (repo, extra = {}) => hook(repo, 'check-before-stop.mjs', { stop_hook_active: false, cwd: repo, ...extra });
  const EXISTING = { [LOGIC]: plainFunction('run', 90) };

  describe('command line: base and working tree', () => {
    it('--file: problems in a new file are notes, because the source may not be trimmed yet', () => {
      const repo = makeRepo(EXISTING);
      put(repo, pathFor('fresh'), 'export const fresh = (x: any, y: any, z: any) => [x, y, z];');
      const { code, out } = run(repo, '--file', pathFor('fresh'));
      assert.equal(code, 0);
      assert.ok(out.includes('[any]'), out);
      assert.ok(out.includes('[params]'), out);
    });
    it('--file: problems in an existing file block', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, broken(90));
      assert.equal(run(repo, '--file', LOGIC).code, 1);
    });
    it('--file: small growth is a note with the number', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, plainFunction('run', 93));
      const { code, out } = run(repo, '--file', LOGIC);
      assert.equal(code, 0);
      assert.ok(out.includes('90 -> 93'), out);
    });
    it('--base: moved code across a deleted file passes', () => {
      const repo = makeRepo({ [pathFor('source')]: `${plainFunction('one', 90)}\n${plainFunction('two', 90)}` });
      unlinkSync(join(repo, pathFor('source')));
      put(repo, pathFor('first'), plainFunction('one', 90));
      put(repo, pathFor('second'), plainFunction('two', 90));
      assert.equal(run(repo, '--base', 'origin/master').code, 0);
    });
    it('--base: a plain mv without git add stays a rename', () => {
      const repo = makeRepo(EXISTING);
      renameSync(join(repo, LOGIC), join(repo, pathFor('moved')));
      assert.equal(run(repo, '--base', 'origin/master').code, 0);
      assert.equal(run(repo, '--file', pathFor('moved')).code, 0);
    });
    it('finds the base the branch really left, not only origin/master', () => {
      const repo = makeRepo(EXISTING);
      git(repo, 'switch', '-qc', 'release', 'master');
      put(repo, LOGIC, broken(90));
      git(repo, 'commit', '-qam', 'release has its own problem');
      git(repo, 'update-ref', 'refs/remotes/origin/release', 'HEAD');
      git(repo, 'switch', '-qc', 'on-release');
      put(repo, pathFor('other'), moduleOf(1));
      git(repo, 'add', '.');
      git(repo, 'commit', '-qm', 'own work');
      const { code, out } = run(repo);
      assert.equal(code, 0, out);
      assert.ok(out.includes('origin/release'), out);
      put(repo, LOGIC, `${broken(90)}\nconsole.log('y');`);
      assert.equal(run(repo, '--file', LOGIC).code, 1);
    });
    it('a commit pushed under another name is still checked against master', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, broken(90));
      git(repo, 'commit', '-qam', 'a problem');
      git(repo, 'update-ref', 'refs/remotes/origin/another-name', 'HEAD');
      const { code, out } = run(repo);
      assert.equal(code, 1, out);
      assert.ok(out.includes('origin/master'), out);
    });
    it('a detached HEAD on a pushed commit is still checked against master', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, broken(90));
      git(repo, 'commit', '-qam', 'a problem');
      git(repo, 'update-ref', 'refs/remotes/origin/feature', 'HEAD');
      git(repo, 'switch', '-q', '--detach');
      assert.equal(run(repo).code, 1);
    });
    it('prefers origin/master when another branch is just as close', () => {
      const repo = makeRepo(EXISTING);
      git(repo, 'update-ref', 'refs/remotes/origin/sibling', 'HEAD');
      assert.ok(run(repo).out.includes('origin/master'));
    });
    // The hooks pass no --base. A branch without commits of its own sits on the default branch, which wins.
    it('takes the default branch from origin/HEAD', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, broken(90));
      git(repo, 'commit', '-qam', 'develop moved on');
      git(repo, 'update-ref', 'refs/remotes/origin/develop', 'HEAD');
      git(repo, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/develop');
      const { code, out } = run(repo);
      assert.equal(code, 0, out);
      assert.ok(out.includes('origin/develop'), out);
    });
    it('without origin/HEAD, takes origin/main over an old merged branch', () => {
      const repo = makeRepo(EXISTING);
      git(repo, 'update-ref', 'refs/remotes/origin/old-fix', 'HEAD');
      git(repo, 'update-ref', '-d', 'refs/remotes/origin/master');
      put(repo, LOGIC, broken(90));
      git(repo, 'commit', '-qam', 'main moved on');
      git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
      const { code, out } = run(repo);
      assert.equal(code, 0, out);
      assert.ok(out.includes('origin/main'), out);
    });
    it('does not write to the index or the object store of the checkout', () => {
      const repo = makeRepo(EXISTING);
      put(repo, pathFor('fresh'), moduleOf(1));
      const objects = () => git(repo, 'count-objects');
      const before = [git(repo, 'status', '--porcelain'), objects()];
      run(repo, '--base', 'origin/master');
      assert.deepEqual([git(repo, 'status', '--porcelain'), objects()], before);
    });
  });

  describe('edit hook', () => {
    const edit = (repo, path) => hook(repo, 'check-edited-file.mjs', { tool_name: 'Write', tool_input: { file_path: join(repo, path) }, cwd: repo });
    it('blocks with exit 2 and the rule on stderr', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, broken(90));
      const { code, err } = edit(repo, LOGIC);
      assert.equal(code, 2);
      assert.ok(err.includes('console-log'), err);
    });
    it('does not block code that moved in from another changed file', () => {
      const line = 'export const moved = (x) => { console.log(x); };';
      const [source, target] = [pathFor('a'), pathFor('c')];
      const repo = makeRepo({ [source]: `${line}\nexport const k = 1;`, [target]: 'export const j = 1;' });
      put(repo, source, 'export const k = 1;');
      put(repo, target, `export const j = 1;\n${line}`);
      assert.equal(run(repo).code, 0);
      assert.equal(edit(repo, target).code, 0);
    });
    it('still blocks a new problem next to moved code', () => {
      const line = 'export const moved = (x) => { console.log(x); };';
      const [source, target] = [pathFor('a'), pathFor('c')];
      const repo = makeRepo({ [source]: `${line}\nexport const k = 1;`, [target]: 'export const j = 1;' });
      put(repo, source, 'export const k = 1;');
      put(repo, target, `export const j = 1;\n${line}\nconsole.log('new');`);
      assert.equal(edit(repo, target).code, 2);
    });
    it('hands a note to the agent as JSON, with exit 0', () => {
      const repo = makeRepo(EXISTING);
      put(repo, pathFor('fresh'), 'export const fresh = (x: any) => x;');
      const { code, out } = edit(repo, pathFor('fresh'));
      assert.equal(code, 0);
      const parsed = JSON.parse(out);
      assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
      assert.ok(parsed.hookSpecificOutput.additionalContext.includes('[any]'));
    });
    it('stays silent on a clean edit', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, plainFunction('run', 90).replace('run0', 'runA'));
      assert.deepEqual(edit(repo, LOGIC), { code: 0, out: '', err: '' });
    });
    it('stays out of the way when the file belongs to another repo', () => {
      const repo = makeRepo(EXISTING);
      const other = realpathSync(mkdtempSync(join(tmpdir(), 'quality-other-')));
      repos.push(other);
      git(other, 'init', '-q', '-b', 'master');
      put(other, LOGIC, plainFunction('run', 300));
      assert.deepEqual(hook(repo, 'check-edited-file.mjs', { tool_input: { file_path: join(other, LOGIC) } }), { code: 0, out: '', err: '' });
    });
  });

  describe('stop hook', () => {
    const fail = (repo, step) => writeFileSync(join(repo, `.stub-fail-${step}`), '');
    const pass = (repo, step) => rmSync(join(repo, `.stub-fail-${step}`), { force: true });

    it('costs nothing on a branch without changes', () => {
      const repo = makeRepo(EXISTING);
      assert.deepEqual(stop(repo), { code: 0, out: '', err: '' });
      assert.equal(stubLog(repo), '');
    });
    it('catches a committed violation with a clean tree', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, broken(90));
      git(repo, 'commit', '-qam', 'a problem');
      const { code, err } = stop(repo);
      assert.equal(code, 2);
      assert.ok(err.includes('console-log'), err);
    });
    it('runs the typecheck when a change only deletes files', () => {
      const repo = makeRepo(EXISTING);
      unlinkSync(join(repo, LOGIC));
      fail(repo, 'tsc');
      const { code, err } = stop(repo);
      assert.equal(code, 2);
      assert.ok(err.includes('tsc is red'), err);
    });
    it('runs nothing when no code changed', () => {
      const repo = makeRepo(EXISTING);
      put(repo, 'README.md', '# hi');
      assert.equal(stop(repo).code, 0);
      assert.equal(stubLog(repo), '');
    });
    it('checks the worktree the session is in, not only the project', () => {
      const repo = makeRepo(EXISTING);
      const linked = join(realpathSync(mkdtempSync(join(tmpdir(), 'quality-linked-'))), 'wt');
      repos.push(dirname(linked));
      git(repo, 'worktree', 'add', '-q', '-b', 'linked', linked, 'master');
      symlinkSync(join(repo, 'node_modules'), join(linked, 'node_modules'));
      put(linked, LOGIC, broken(90));
      const { code, err } = stop(repo, { cwd: linked });
      assert.equal(code, 2);
      assert.ok(err.includes('console-log'), err);
    });
    it('checks a worktree edited through an absolute path, with the cwd in the main checkout', () => {
      const repo = makeRepo(EXISTING);
      const linked = join(realpathSync(mkdtempSync(join(tmpdir(), 'quality-linked-'))), 'wt');
      repos.push(dirname(linked));
      git(repo, 'worktree', 'add', '-q', '-b', 'linked', linked, 'master');
      symlinkSync(join(repo, 'node_modules'), join(linked, 'node_modules'));
      put(linked, LOGIC, broken(90));
      const editInput = { session_id: 'one', tool_input: { file_path: join(linked, LOGIC) }, cwd: repo };
      assert.equal(hook(repo, 'check-edited-file.mjs', editInput).code, 2);
      assert.equal(stop(repo, { session_id: 'two', cwd: repo }).code, 0);
      const { code, err } = stop(repo, { session_id: 'one', cwd: repo });
      assert.equal(code, 2);
      assert.ok(err.includes('console-log'), err);
      put(linked, LOGIC, plainFunction('run', 91));
      assert.equal(stop(repo, { session_id: 'one', cwd: repo, stop_hook_active: true }).code, 0);
      clearLog(linked);
      assert.equal(stop(repo, { session_id: 'one', cwd: repo }).code, 0);
      assert.equal(stubLog(linked), '');
    });
    it('checks again after a block when the tree changed', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, plainFunction('run', 91));
      fail(repo, 'tsc');
      assert.equal(stop(repo).code, 2);
      put(repo, LOGIC, plainFunction('run', 92));
      assert.equal(stop(repo, { stop_hook_active: true }).code, 2);
      pass(repo, 'tsc');
      put(repo, LOGIC, plainFunction('run', 93));
      assert.equal(stop(repo, { stop_hook_active: true }).code, 0);
    });
    it('lets go when a block changed nothing, and tells the user', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, plainFunction('run', 91));
      fail(repo, 'tsc');
      assert.equal(stop(repo).code, 2);
      clearLog(repo);
      const second = stop(repo, { stop_hook_active: true });
      assert.equal(second.code, 0);
      assert.equal(stubLog(repo), '');
      assert.ok(JSON.parse(second.out).systemMessage.length > 0);
    });
    it('does not loop forever', () => {
      const repo = makeRepo(EXISTING);
      fail(repo, 'tsc');
      const codes = [];
      for (let lines = 91; lines < 96; lines += 1) {
        put(repo, LOGIC, plainFunction('run', lines));
        codes.push(stop(repo, { stop_hook_active: lines > 91 }).code);
      }
      assert.deepEqual(codes, [2, 2, 2, 0, 0]);
    });
    it('caches a green tree: an unchanged or question-only turn runs nothing', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, plainFunction('run', 91));
      assert.equal(stop(repo).code, 0);
      assert.notEqual(stubLog(repo), '');
      clearLog(repo);
      assert.deepEqual(stop(repo), { code: 0, out: '', err: '' });
      assert.equal(stubLog(repo), '');
      put(repo, LOGIC, plainFunction('run', 92));
      assert.equal(stop(repo).code, 0);
      assert.notEqual(stubLog(repo), '');
    });
    it('a check that could not run is a note, not a block', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, plainFunction('run', 91));
      git(repo, 'update-ref', '-d', 'refs/remotes/origin/master');
      const { code, out } = stop(repo);
      assert.equal(code, 0);
      assert.ok(JSON.parse(out).hookSpecificOutput.additionalContext.includes('quality check'), out);
    });
    it('a missing tool is a note, not a block', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, plainFunction('run', 91));
      rmSync(join(repo, 'node_modules/.bin/tsc'));
      const { code, out } = stop(repo);
      assert.equal(code, 0);
      assert.ok(JSON.parse(out).hookSpecificOutput.additionalContext.includes('typecheck'), out);
    });
    it('a plain mv does not turn moved code into new code', () => {
      const repo = makeRepo(EXISTING);
      renameSync(join(repo, LOGIC), join(repo, pathFor('moved')));
      assert.equal(stop(repo).code, 0);
    });
    it('reports every red step at once', () => {
      const repo = makeRepo(EXISTING);
      put(repo, LOGIC, broken(90));
      fail(repo, 'tsc');
      const { code, err } = stop(repo);
      assert.equal(code, 2);
      assert.ok(err.includes('console-log') && err.includes('tsc is red'), err);
    });
  });
};
