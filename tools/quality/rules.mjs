// Compares each changed file with its state at the fork point. A rule breaks only if the change made things worse;
// old code that already breaks a rule stays allowed, and code that only moved stays old.
import { basename, dirname } from 'node:path';

import { analyzeSource } from './analyze.mjs';
import { buildMovePool, normalizeItem } from './moves.mjs';

const NO_SQUEEZE = 'Never squeeze code onto fewer lines.';
const FIXES = {
  'file-lines': `Move one responsibility into its own file next to this one. ${NO_SQUEEZE}`,
  'function-lines': `Split by responsibility: extract a part into its own function or sub-component at module level. ${NO_SQUEEZE}`,
  'jsx-return-lines': `Move a part of this JSX into a private sub-component at module level in this file. ${NO_SQUEEZE}`,
  'long-line': `Break it up by responsibility: one statement per line, with named steps. ${NO_SQUEEZE}`,
  any: 'Use the real type, or unknown with a type guard. `as unknown as T` is `any` in disguise.',
  'ts-ignore': 'Fix the type error instead of suppressing it.',
  'console-log': 'Remove it. console.error and console.warn are for real failures.',
  'string-compare': 'Compare with a member of the enum for this set of values; search for an existing enum before adding one.',
  params: 'Take one object with named fields: fn({ a, b, c }).',
  'file-name': 'Rename the file.',
  'generic-file-name': 'Name the file after what it holds, so the name is unique in the repo and an agent can find it.',
  'folder-name': 'Rename the folder.',
  'component-domain-import': 'src/components holds blocks without a domain. Put this in src/features/<domain>/<Name>/, or pass the data in as props.',
  'type-assertion': 'Narrow with a type guard, or fix the type where it comes from. `as const` is fine.',
  'non-null-assertion': 'Handle the missing case, or narrow first.',
  'const-enum': 'Use a plain enum.',
  'local-require': 'Import it at the top of the file. If that makes a cycle, move the shared part into its own module. Only heavy packages load late.',
  'server-logs': 'Log with console.error.',
  'class-validator': 'TSOA validates from the DTO types: leave out the class-validator decorators.',
  'empty-conflict-error': 'Say what went wrong: new ConflictError({ message: ... }).',
  'route-outside-tsoa': 'Add it to a TSOA controller. Only a latency reason justifies a router route: `// quality-allow route-outside-tsoa: <reason>` on the line above.',
  'classnames-import': 'Use cn from @/lib/utils.',
  'default-export': 'Use a named export, so agents can find and rename it.',
  'comment-reference': 'A comment explains why the code is this way; the number belongs in the PR.',
  'comment-attribution':
    "Remove the name or date and keep the reason: who decided what, and when, belongs in the PR. An example takes a name that is no teammate's; a date that is data goes in backticks.",
  'comment-date': 'If the date only says when something happened, remove it and keep the reason: that history belongs in the PR. A date the code depends on, such as a cutoff for old data, can stay.',
  'nested-component': 'Move it to module level and pass what it needs as props: a component defined inside another remounts on every render and loses its state.',
  'build-function': 'Write a sub-component at module level instead.',
  'needs-test': 'Add the test or story next to the file.',
  'parse-error': 'Fix the syntax error; nothing else can be measured until then.',
};
// These have no single line: their quality-allow comment goes anywhere above the first code line.
const FILE_RULES = new Set(['file-lines', 'file-name', 'generic-file-name', 'folder-name', 'needs-test']);
// An allow for these covers the size it was written for. Growing past it needs a new reason, which reviewers then see.
const GROWTH_RULES = new Set(['file-lines', 'function-lines', 'jsx-return-lines', 'params']);
const FOLDER_RULES = new Set(['folder-name']);
// These fail on every new one: a comment that loses its number or stamp does not pay for one that gains it.
const EVERY_NEW_ONE_RULES = new Set(['comment-reference', 'comment-attribution', 'comment-date']);

const countBy = (items, keyOf) => {
  const counts = new Map();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return counts;
};

const allowKey = (allow) => `${allow.rule}:${allow.reason}`;

const newAllowsOf = ({ beforeFacts, afterFacts }) => {
  const remaining = countBy(beforeFacts?.allows ?? [], allowKey);
  return afterFacts.allows.filter((allow) => {
    const left = remaining.get(allowKey(allow)) ?? 0;
    remaining.set(allowKey(allow), left - 1);
    return left <= 0;
  });
};

const isAllowedAt = ({ allows, facts, rule, line }) =>
  allows.some((allow) => allow.rule === rule && (FILE_RULES.has(rule) ? allow.line < facts.firstCodeLine : allow.line === line - 1));

// The sizes are working values, so going over one is a warning. What fails is the ratchet: growing further, by more
// than a small bug fix, what is already too big.
const sizeProblem = ({ config, before, after, growth = after - (before ?? 0), limit, isGuideOnly = false, ...problem }) => {
  if (after <= limit || (before != null && growth <= 0)) return null;
  const isRatchet = before != null && before > limit && growth > config.limits.smallGrowthLines && !config.legacySizeGrowthWarns;
  return { ...problem, before, after, limit, unit: 'code lines', isNote: isGuideOnly || !isRatchet };
};

const growthAllowance = ({ path, beforeFacts, afterFacts, config }) => {
  let allowance = 0;
  for (const [key, lines] of afterFacts.regions) {
    const isCounted = key.startsWith('enum:') || config.isModelFile(path);
    if (isCounted && beforeFacts.regions.has(key)) allowance += Math.max(0, lines - beforeFacts.regions.get(key));
  }
  return allowance;
};

const fileLineProblems = ({ path, beforeFacts, afterFacts, config, movedLines }) => {
  const { limits } = config;
  if (config.registryFiles.has(path) || config.isFixture(path) || afterFacts.isDataFile) return [];
  const after = afterFacts.codeLines;
  if (!beforeFacts && after - movedLines <= limits.fileLines) return [];
  const before = beforeFacts?.codeLines ?? null;
  const growth = beforeFacts ? after - growthAllowance({ path, beforeFacts, afterFacts, config }) - before : after;
  const line = afterFacts.firstCodeLine;
  const problem = sizeProblem({ config, before, after, growth, limit: limits.fileLines, rule: 'file-lines', line, subject: 'file' });
  if (!problem) return [];
  const isExistingUnderLimit = Boolean(beforeFacts) && before <= limits.fileLines && !config.legacySizeGrowthWarns;
  const isOverMaximum = (!beforeFacts || isExistingUnderLimit) && after - movedLines > limits.newFileLines;
  return [{ ...problem, isNote: problem.isNote && !isOverMaximum }];
};

const newFunctionProblems = ({ fact }) => {
  const problems = [];
  const { line, name } = fact;
  if (fact.isNested && fact.isPascalCase && fact.hasOwnJsx) {
    problems.push({ rule: 'nested-component', line, before: null, after: name, subject: 'component inside a function' });
  }
  if (/^_?build[A-Z]/.test(fact.baseName) && fact.returnsJsx) {
    problems.push({ rule: 'build-function', line, before: null, after: name, subject: 'buildX() returning JSX' });
  }
  return problems;
};

const paramsProblem = ({ fact, old, path, config }) => {
  const limit = config.limits.positionalParams;
  if (fact.params <= limit || fact.isParamsExempt || config.isParamsExemptFile(path)) return null;
  if (old && fact.params <= old.params) return null;
  const subject = `${old ? '' : 'new '}function "${fact.name}"`;
  return { rule: 'params', line: fact.line, before: old?.params ?? null, after: fact.params, limit, subject, unit: 'positional parameters' };
};

const functionProblems = ({ path, beforeFacts, afterFacts, config, pool }) => {
  const { limits } = config;
  const hasNoLineLimit = config.isFixture(path);
  const problems = [];
  for (const fact of afterFacts.functions.values()) {
    const old = beforeFacts?.functions.get(fact.key) ?? pool.findFunction(fact);
    const label = `${old ? '' : 'new '}${fact.isComponent ? 'component' : 'function'} "${fact.key}"`;
    const limit = fact.isComponent ? (limits.componentLines ?? limits.functionLines) : limits.functionLines;
    if (!hasNoLineLimit) {
      problems.push(
        sizeProblem({ config, before: old?.lines ?? null, after: fact.lines, limit, rule: 'function-lines', line: fact.line, subject: label })
      );
      problems.push(
        limits.jsxReturnLines &&
          sizeProblem({
            config,
            before: old?.jsxReturnLines ?? null,
            after: fact.jsxReturnLines,
            limit: limits.jsxReturnLines,
            isGuideOnly: true,
            rule: 'jsx-return-lines',
            line: fact.jsxReturnLine,
            subject: `JSX of ${label}`,
          })
      );
    }
    problems.push(paramsProblem({ fact, old, path, config }));
    if (!old) problems.push(...newFunctionProblems({ fact }));
  }
  return problems.filter(Boolean);
};

const itemsNotInBefore = ({ beforeItems, afterItems }) => {
  const remaining = countBy(beforeItems, ({ text }) => normalizeItem(text));
  return afterItems.filter(({ text }) => {
    const key = normalizeItem(text);
    const left = remaining.get(key) ?? 0;
    remaining.set(key, left - 1);
    return left <= 0;
  });
};

const COUNTER_LABELS = {
  any: '`any`',
  'ts-ignore': '@ts-ignore or @ts-expect-error',
  'console-log': 'console.log, info, debug or table',
  'string-compare': 'comparisons or case with a string literal',
  'default-export': 'default exports',
  'comment-reference': 'comments with a ticket or PR number',
  'comment-attribution': "comments with a teammate's name or a date stamp",
  'comment-date': 'comments with a date',
  'type-assertion': '`as` assertions',
  'non-null-assertion': '`!` assertions',
  'const-enum': '`const enum` declarations',
  'local-require': 'local require() calls',
  'server-logs': 'ServerLogs.send calls',
  'class-validator': 'class-validator imports',
  'empty-conflict-error': 'new ConflictError without a message',
  'route-outside-tsoa': 'routes outside TSOA',
  'classnames-import': 'classnames or clsx imports',
};

const isMostlyMoved = ({ afterFacts, movedLines, config }) =>
  movedLines / Math.max(1, afterFacts.codeLines - afterFacts.importCodeLines) >= config.limits.movedShare;

const counterProblems = ({ beforeFacts, afterFacts, beforeAllows, afterAllows, pool, config, movedLines }) =>
  Object.keys(afterFacts.counters).flatMap((rule) => {
    // An import follows its moved code while the source keeps its own, so it never shows up as removed.
    const isImportRule = config.bannedImports.some((banned) => banned.rule === rule);
    if (isImportRule && !beforeFacts && isMostlyMoved({ afterFacts, movedLines, config })) return [];
    const notAllowed = ({ items, facts, allows }) => items.filter(({ line }) => !isAllowedAt({ allows, facts, rule, line }));
    const beforeItems = beforeFacts ? notAllowed({ items: beforeFacts.counters[rule] ?? [], facts: beforeFacts, allows: beforeAllows }) : [];
    const afterItems = notAllowed({ items: afterFacts.counters[rule], facts: afterFacts, allows: afterAllows });
    const fresh = itemsNotInBefore({ beforeItems, afterItems });
    const brandNew = fresh.filter(({ text }) => !pool.takeCounter({ rule, text }));
    const isWithinCount = afterItems.length - (fresh.length - brandNew.length) <= beforeItems.length;
    if (EVERY_NEW_ONE_RULES.has(rule) ? !brandNew.length : isWithinCount) return [];
    const lines = [...new Set(brandNew.map(({ line }) => line))].sort((a, b) => a - b).slice(0, 8);
    const subject = `${COUNTER_LABELS[rule] ?? 'banned imports'} in this file, new at line ${lines.join(', ')}`;
    return [{ rule, line: lines[0], before: beforeItems.length, after: afterItems.length, subject, unit: 'found' }];
  });

// An edit that leaves a long line shorter is an improvement, so each new line may take the place of one at least as wide.
const notReplacingAWiderLine = ({ fresh, removed }) => {
  const widest = (a, b) => b.width - a.width;
  const candidates = [...removed].sort(widest);
  return [...fresh].sort(widest).filter(({ width }) => {
    if (!candidates.length || candidates[0].width < width) return true;
    candidates.shift();
    return false;
  });
};

const longLineProblems = ({ beforeFacts, afterFacts, config, pool }) => {
  const beforeItems = beforeFacts?.longLines ?? [];
  const fresh = itemsNotInBefore({ beforeItems, afterItems: afterFacts.longLines });
  const removed = itemsNotInBefore({ beforeItems: afterFacts.longLines, afterItems: beforeItems });
  const limit = config.limits.lineChars;
  return notReplacingAWiderLine({ fresh, removed })
    .filter(({ text }) => !pool.hasLine(text))
    .map(({ line }) => ({ rule: 'long-line', line, before: null, after: 'too wide', limit, subject: `code over ${limit} characters, without strings` }));
};

const nameProblems = ({ path, afterFacts, change, config }) => {
  const problems = [];
  const line = afterFacts.firstCodeLine;
  const keptItsName = change.previousPath && basename(change.previousPath) === basename(path);
  if (!keptItsName) {
    if (config.genericFileNames.has(basename(path).replace(/\.[^.]+$/, ''))) {
      problems.push({ rule: 'generic-file-name', line, before: null, after: basename(path), subject: 'a name that many files could have' });
    } else if (!config.isFixture(path) && !afterFacts.isDataFile) {
      const subject = config.fileNameProblem({ path, facts: afterFacts });
      if (subject) problems.push({ rule: 'file-name', line, before: null, after: path, subject });
    }
  }
  for (const folder of change.newFolders ?? []) {
    const subject = config.folderNameProblem(folder);
    if (subject) problems.push({ rule: 'folder-name', line, before: null, after: folder, subject, folder });
  }
  return problems;
};

const componentImportProblems = ({ path, beforeFacts, afterFacts, change, config }) => {
  if (beforeFacts || !config.isNewComponentBlock?.({ path, newFolders: change.newFolders ?? [] })) return [];
  return afterFacts.imports
    .filter(({ isTypeOnly, specifier }) => !isTypeOnly && config.isDomainImport({ path, specifier }))
    .map(({ line, specifier }) => ({ rule: 'component-domain-import', line, before: null, after: specifier, subject: 'a new block in src/components imports domain code' }));
};

const testProblems = ({ path, afterFacts, pathExists, config, movedLines }) => {
  if (config.isFixture(path) || afterFacts.isDataFile) return [];
  if (isMostlyMoved({ afterFacts, movedLines, config })) return [];
  const candidates = config.testCandidates({ path, facts: afterFacts });
  if (!candidates || candidates.some(pathExists)) return [];
  const wanted = candidates.map((candidate) => candidate.slice(dirname(path).length + 1)).join(' or ');
  return [{ rule: 'needs-test', line: afterFacts.firstCodeLine, before: null, after: `no ${wanted} next to it`, subject: 'new file' }];
};

const checkAnalyzed = ({ entry, config, pathExists, pool }) => {
  const { change, beforeFacts, afterFacts } = entry;
  const { path } = change;
  if (afterFacts.parseError) {
    const { line, message } = afterFacts.parseError;
    const problem = { rule: 'parse-error', line, before: null, after: message, subject: 'syntax error', path, fix: FIXES['parse-error'] };
    return { problems: [problem], allows: [] };
  }
  const newAllows = newAllowsOf({ beforeFacts, afterFacts });
  const movedLines = beforeFacts ? 0 : pool.takeLines(afterFacts.codeLineTexts);
  const context = {
    path,
    beforeFacts,
    afterFacts,
    beforeAllows: beforeFacts?.allows ?? [],
    afterAllows: afterFacts.allows,
    config,
    change,
    pathExists,
    pool,
    movedLines,
  };
  const found = [
    ...fileLineProblems(context),
    ...functionProblems(context),
    ...counterProblems(context),
    ...longLineProblems(context),
    ...(change.isNewPath ? nameProblems(context) : []),
    ...componentImportProblems(context),
    ...(beforeFacts ? [] : testProblems(context)),
  ];
  const problems = found.map((problem) => {
    const allows = GROWTH_RULES.has(problem.rule) ? newAllows : afterFacts.allows;
    const isAllowed = isAllowedAt({ allows, facts: afterFacts, rule: problem.rule, line: problem.line });
    const isNote = problem.isNote || Boolean(config.warningRules?.has(problem.rule));
    return { ...problem, isNote, path, fix: config.fixes?.[problem.rule] ?? FIXES[problem.rule], isAllowed };
  });
  return { problems: problems.filter(({ isAllowed, rule }) => !isAllowed || FOLDER_RULES.has(rule)), allows: newAllows.map((allow) => ({ ...allow, path })) };
};

// One report per new folder, and one allow in any of its files covers the folder.
const mergeFolderProblems = (problems) => {
  const groups = new Map();
  const others = [];
  for (const problem of problems) {
    if (!FOLDER_RULES.has(problem.rule)) {
      others.push(problem);
      continue;
    }
    const key = `${problem.rule}:${problem.folder}`;
    groups.set(key, [...(groups.get(key) ?? []), problem]);
  }
  const merged = [...groups.values()].filter((group) => !group.some(({ isAllowed }) => isAllowed)).map(([first]) => first);
  return [...others, ...merged];
};

export const checkChanges = ({ changes, config, pathExists }) => {
  const analyzeIn = ({ path, source }) => (source == null || !config.isInScope(path) ? null : analyzeSource({ path, source, config }));
  const analyzed = changes.map((change) => ({
    change,
    beforeFacts: analyzeIn({ path: change.previousPath ?? change.path, source: change.before }),
    afterFacts: analyzeIn({ path: change.path, source: change.after }),
  }));
  const pool = buildMovePool(analyzed);
  const results = analyzed.filter(({ afterFacts }) => afterFacts).map((entry) => checkAnalyzed({ entry, config, pathExists, pool }));
  const problems = mergeFolderProblems(results.flatMap((result) => result.problems));
  return {
    violations: problems.filter(({ isNote }) => !isNote),
    notes: problems.filter(({ isNote }) => isNote),
    allows: results.flatMap((result) => result.allows),
  };
};

export const checkChange = ({ change, config, pathExists }) => checkChanges({ changes: [change], config, pathExists });

const describeNumbers = ({ before, after, limit, unit }) => {
  const from = before ?? 'new';
  return `${from} -> ${after}${unit ? ` ${unit}` : ''}${limit ? ` (limit ${limit})` : ''}`;
};

export const formatViolation = (violation) =>
  [
    `[${violation.rule}] ${violation.path}:${violation.line}`,
    `  ${violation.subject}: ${describeNumbers(violation)}`,
    `  Fix: ${violation.fix}`,
  ].join('\n');
