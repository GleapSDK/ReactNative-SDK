#!/usr/bin/env node
// Compares changed files with their state where the branch left its base. Old code may stay as it is, but must not
// get worse, and new code keeps the rules in .claude/rules/code-conventions.md.
//
//   check.mjs --file <path>                       one file, for the edit hook
//   check.mjs [--base <ref>] [--head <ref>]       every changed file, for CI and the stop hook. Without --base it finds
//                                                 the closest remote branch; without --head it reads the working tree
//
// Exit codes: 0 clean, 1 problems found, 3 the check itself could not run.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { changedFiles, filesAt, foldersAt, forkPointOf, isSameRepository, newFoldersOf, readBlobs, repoRootOf, resolveBase } from './changes.mjs';
import { config } from './config.mjs';

const TOOL_ROOT = repoRootOf(dirname(fileURLToPath(import.meta.url)));

const ALLOW_HELP = 'Only if a split is really wrong here: `// quality-allow <rule>: <reason>` on the line above. Reviewers see it.';

const escapeAnnotation = (text) => text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

const WARNING_LABEL = 'Warning, not blocking:';

const annotate = ({ violations, notes, allows, formatViolation }) => {
  if (!process.env.GITHUB_ACTIONS) return;
  const annotation = ({ level, path, line, title, body }) =>
    console.log(`::${level} file=${path},line=${line},title=${title}::${escapeAnnotation(body)}`);
  for (const item of violations) {
    annotation({ level: 'error', path: item.path, line: item.line, title: `quality ${item.rule}`, body: formatViolation(item) });
  }
  for (const item of notes) {
    annotation({ level: 'warning', path: item.path, line: item.line, title: `quality ${item.rule}`, body: formatViolation(item) });
  }
  for (const { path, line, rule, reason } of allows) {
    annotation({ level: 'notice', path, line, title: `quality-allow ${rule}`, body: reason });
  }
};

const printReport = ({ violations, later = [], notes, allows, formatViolation }) => {
  for (const violation of violations) console.log(`${formatViolation(violation)}\n`);
  if (violations.length) console.log(`${ALLOW_HELP}\n`);
  for (const item of later) console.log(`Not blocking yet, needed before you finish:\n${formatViolation(item)}\n`);
  for (const note of notes) console.log(`${WARNING_LABEL}\n${formatViolation(note)}\n`);
  for (const allow of allows) console.log(`quality-allow ${allow.rule}: ${allow.reason} (${allow.path}:${allow.line})`);
  annotate({ violations, notes, allows, formatViolation });
};

const changesAgainst = ({ root, fork, head }) => {
  const inScope = changedFiles({ root, fork, head }).filter(({ path, previousPath }) => config.isInScope(path) || (previousPath && config.isInScope(previousPath)));
  const beforeBlobs = readBlobs({ root, rev: fork, paths: inScope.map(({ path, previousPath }) => previousPath ?? path) });
  const present = inScope.filter(({ isDeleted }) => !isDeleted).map(({ path }) => path);
  const afterBlobs = head ? readBlobs({ root, rev: head, paths: present }) : null;
  const readAfter = (path) => (afterBlobs ? afterBlobs.get(path) : readFileSync(join(root, path), 'utf8'));

  let foldersAtFork;
  const newFolders = (path) => {
    foldersAtFork ??= foldersAt({ root, rev: fork });
    return newFoldersOf({ path, existing: foldersAtFork });
  };
  return inScope.map(({ path, previousPath, isDeleted }) => {
    const isNewPath = !isDeleted && (previousPath !== null || !beforeBlobs.has(path));
    return {
      path,
      previousPath,
      before: beforeBlobs.get(previousPath ?? path),
      after: isDeleted ? null : readAfter(path),
      isNewPath,
      newFolders: isNewPath ? newFolders(path) : [],
    };
  });
};

const judgeInWholeChange = ({ change, root, fork, pathExists, rules }) => {
  // This file goes first, so that what moved is credited to it and not to another file with the same line.
  const others = changesAgainst({ root, fork }).filter(({ path }) => path !== change.path);
  const { violations, notes, allows } = rules.checkChanges({ changes: [change, ...others], config, pathExists });
  const inThisFile = ({ path }) => path === change.path;
  return { violations: violations.filter(inThisFile), notes: notes.filter(inThisFile), allows: allows.filter(inThisFile) };
};

const runFile = async (file) => {
  const absolute = resolve(file);
  if (!existsSync(absolute)) return 0;
  const realPath = realpathSync(absolute);
  const root = repoRootOf(dirname(realPath));
  if (!root || !TOOL_ROOT || !isSameRepository(root, TOOL_ROOT)) return 0;
  const path = relative(root, realPath);
  if (!config.isInScope(path)) return 0;

  const rules = await import('./rules.mjs');
  const fork = forkPointOf({ root, base: resolveBase({ root }) });
  let before = readBlobs({ root, rev: fork, paths: [path] }).get(path);
  const isNewPath = before === undefined;
  let previousPath = null;
  if (isNewPath) {
    previousPath = changedFiles({ root, fork }).find((change) => change.path === path)?.previousPath ?? null;
    if (previousPath) before = readBlobs({ root, rev: fork, paths: [previousPath] }).get(previousPath);
  }
  const change = {
    path,
    previousPath,
    before,
    after: readFileSync(realPath, 'utf8'),
    isNewPath,
    newFolders: isNewPath ? newFoldersOf({ path, existing: foldersAt({ root, rev: fork }) }) : [],
  };
  const pathExists = (candidate) => existsSync(join(root, candidate));
  const firstLook = rules.checkChange({ change, config, pathExists });
  // Code may have moved in from another changed file. That takes every changed file, so only when there is something
  // to report: most edits stay fast.
  const { violations, notes, allows } = firstLook.violations.length ? judgeInWholeChange({ change, root, fork, pathExists, rules }) : firstLook;
  // A new file may be the first half of a split whose source is not trimmed yet, so only the whole change can judge it.
  const isNewFile = before === undefined;
  printReport({
    violations: isNewFile ? [] : violations,
    later: isNewFile ? violations : [],
    notes,
    allows,
    formatViolation: rules.formatViolation,
  });
  return !isNewFile && violations.length ? 1 : 0;
};

const runBase = async ({ base: givenBase, head }) => {
  const root = repoRootOf(process.cwd());
  if (!root) throw new Error('not inside a git repository');
  const base = givenBase ?? resolveBase({ root });
  const fork = forkPointOf({ root, base, head });
  const changes = changesAgainst({ root, fork, head });
  const present = changes.filter(({ after }) => after != null);
  let filesAtHead;
  const pathExists = (candidate) => {
    if (!head) return existsSync(join(root, candidate));
    filesAtHead ??= filesAt({ root, rev: head });
    return filesAtHead.has(candidate);
  };

  const rules = await import('./rules.mjs');
  const { violations, notes, allows } = rules.checkChanges({ changes, config, pathExists });
  printReport({ violations, notes, allows, formatViolation: rules.formatViolation });
  console.log(
    `quality check: ${violations.length} problem(s), ${notes.length} warning(s) in ${present.length} changed source file(s), compared with ${fork.slice(0, 10)} (where this branch left ${base}).`
  );
  return violations.length ? 1 : 0;
};

const main = async () => {
  const { values } = parseArgs({
    options: { file: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' } },
  });
  if (!values.file) return runBase({ base: values.base, head: values.head });
  try {
    return await runFile(values.file);
  } catch (error) {
    // An edit hook must not stop a session over a missing default branch or typescript. CI still runs it.
    console.error(`quality check skipped for ${values.file}: ${error.message}`);
    return 0;
  }
};

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`quality check could not run: ${error.message}`);
  process.exitCode = 3;
}
