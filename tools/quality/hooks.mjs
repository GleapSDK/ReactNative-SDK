// What the Claude Code and Codex hooks of this repo do. The files in .claude/hooks only name the steps.
// Exit 2 with stderr blocks in both. Plain stdout on exit 0 reaches neither model, so notes go out as JSON.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { commonDirOf, forkPointOf, headOf, isSameRepository, repoRootOf, resolveBase, workingTreeState } from './changes.mjs';

const OUTPUT_LINES = 60;
const MAX_BLOCKS_IN_A_ROW = 3;

export const projectDirOf = (hookUrl) => resolve(dirname(fileURLToPath(hookUrl)), '../..');

export const readHookInput = async () => {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

// Claude Code names one file_path. Codex edits through apply_patch and only has the patch in tool_input.command.
export const editedFiles = (input) => {
  const toolInput = input.tool_input ?? {};
  if (toolInput.file_path) return [toolInput.file_path];
  const files = [];
  for (const line of String(toolInput.command ?? '').split('\n')) {
    const edited = line.match(/^\*\*\* (?:Update|Add) File: (.+)$/);
    if (edited) files.push(edited[1].trim());
    const moved = line.match(/^\*\*\* Move to: (.+)$/);
    if (moved) files[files.length - 1] = moved[1].trim();
  }
  return files;
};

const block = (reason) => {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};

const emit = (output) => process.stdout.write(`${JSON.stringify(output)}\n`);

const rootFor = ({ input, projectDir }) => {
  const root = input.cwd ? repoRootOf(input.cwd) : null;
  return root && isSameRepository(root, projectDir) ? root : projectDir;
};

// A session can edit a linked worktree through an absolute path while its cwd stays elsewhere. The stop hook only knows
// the cwd, so the edit hook leaves the other root here.
const sessionRootsFile = ({ input, projectDir }) => {
  const session = String(input.session_id ?? 'unknown').replace(/[^\w.-]/g, '_');
  return join(commonDirOf(projectDir), 'quality-session-roots', `${session}.json`);
};

const readSessionRoots = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
};

const rememberRoot = ({ input, projectDir, absolute }) => {
  if (!existsSync(dirname(absolute))) return;
  const root = repoRootOf(dirname(absolute));
  if (!root || root === projectDir || root === rootFor({ input, projectDir }) || !isSameRepository(root, projectDir)) return;
  const file = sessionRootsFile({ input, projectDir });
  const roots = readSessionRoots(file);
  if (roots.includes(root)) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify([...roots, root]));
};

export const runEditHook = async ({ toolPath, projectDir, extraCheck }) => {
  const input = await readHookInput();
  const blocking = [];
  const notes = [];
  for (const file of editedFiles(input)) {
    const absolute = resolve(input.cwd ?? projectDir, file);
    rememberRoot({ input, projectDir, absolute });
    const result = spawnSync(process.execPath, [toolPath, '--file', absolute], { cwd: projectDir, encoding: 'utf8' });
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status === 1) blocking.push(result.stdout);
    else if (result.stdout) notes.push(result.stdout);
    const extra = extraCheck?.(absolute);
    if (extra) blocking.push(extra);
  }
  if (blocking.length) block(`The edit is on disk, but it breaks the rules below. Fix it before you continue:\n\n${blocking.join('\n')}`);
  if (notes.length) emit({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `Quality check:\n\n${notes.join('\n')}` } });
};

const tail = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`.split('\n').slice(-OUTPUT_LINES).join('\n');

const runStep = ({ step, root }) => {
  if (step.requires && !existsSync(join(root, step.requires))) return { note: `${step.name} could not run: ${step.requires} is missing.` };
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    encoding: 'utf8',
    timeout: step.timeout,
    env: { ...process.env, ...step.env },
    maxBuffer: 2 ** 28,
  });
  if (result.error?.code === 'ETIMEDOUT') return { note: `${step.name} did not finish in ${step.timeout / 1000} s; CI runs it.` };
  if (result.error) return { note: `${step.name} could not run: ${result.error.message}` };
  if (result.status === step.couldNotRunStatus) return { note: `${step.name} could not run: ${tail(result).trim()}` };
  return result.status === 0 ? {} : { failure: `${step.name} is red:\n${tail(result)}` };
};

const readState = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
};

const forkOrHead = ({ root }) => {
  try {
    return forkPointOf({ root, base: resolveBase({ root }) });
  } catch {
    return headOf({ root });
  }
};

// Only Claude Code takes extra context on Stop; it continues the turn once so the agent can say what was not checked.
const emitStopNotes = (notes) => {
  const text = `Before you finish, say what was not checked:\n${notes.join('\n')}`;
  if (process.env.CLAUDE_PROJECT_DIR) emit({ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: text } });
  else emit({ systemMessage: text });
};

// One checkout: what is left to tell. `isSettled` means nothing more can come of this root in this session.
const gateRoot = ({ root, input, toolPath, isCode, stepsFor }) => {
  const fork = forkOrHead({ root });
  const { tree, changes } = workingTreeState({ root, fork });
  const key = `${tree}:${fork}`;
  const stateFile = resolve(root, spawnSync('git', ['rev-parse', '--git-path', 'quality-stop-state.json'], { cwd: root, encoding: 'utf8' }).stdout.trim());
  const state = readState(stateFile);
  const save = (next) => writeFileSync(stateFile, JSON.stringify(next));

  const code = changes.filter(({ path }) => isCode(path));
  if (!code.length || state.greenKey === key) return { isSettled: true };
  if (state.reportedKey === key) {
    // The agent was told and changed nothing: another block would only burn a turn.
    const message = input.stop_hook_active && state.isRed ? 'The quality gate is still red; the agent stopped without changing anything.' : null;
    return { message };
  }
  const blocks = input.stop_hook_active ? (state.blocks ?? 0) : 0;
  if (blocks >= MAX_BLOCKS_IN_A_ROW) return { message: `The quality gate blocked ${blocks} times in a row and was not run again.` };

  const qualityStep = { name: 'The quality check', command: process.execPath, args: [toolPath], couldNotRunStatus: 3 };
  const existing = changes.filter(({ path, isDeleted }) => !isDeleted && isCode(path)).map(({ path }) => path);
  const planned = [qualityStep, ...stepsFor({ root, changed: code.map(({ path }) => path), existing })];
  const failures = [];
  const notes = [];
  for (const step of planned) {
    const { failure, note } = step.note ? { note: step.note } : runStep({ step, root });
    if (failure) failures.push(failure);
    if (note) notes.push(note);
  }
  if (failures.length) {
    save({ reportedKey: key, isRed: true, blocks: blocks + 1 });
    return { failures };
  }
  if (notes.length) {
    save({ reportedKey: key, isRed: false });
    return { notes };
  }
  save({ greenKey: key });
  return { isSettled: true };
};

export const runStopGate = async ({ toolPath, projectDir, isCode, stepsFor }) => {
  const input = await readHookInput();
  const primary = rootFor({ input, projectDir });
  const rootsFile = sessionRootsFile({ input, projectDir });
  const remembered = readSessionRoots(rootsFile).filter((root) => root !== primary && existsSync(root));
  const outcomes = [primary, ...remembered].map((root) => ({ root, ...gateRoot({ root, input, toolPath, isCode, stepsFor }) }));

  const open = remembered.filter((root) => !outcomes.find((outcome) => outcome.root === root).isSettled);
  if (open.length) writeFileSync(rootsFile, JSON.stringify(open));
  else rmSync(rootsFile, { force: true });

  const inRoot = ({ root }, text) => (root === primary ? text : `In ${root}:\n${text}`);
  const failures = outcomes.flatMap((outcome) => (outcome.failures ?? []).map((failure) => inRoot(outcome, failure)));
  if (failures.length) block(`Fix this before you finish, or report BLOCKED with the reason:\n\n${failures.join('\n\n')}`);
  const notes = outcomes.flatMap((outcome) => (outcome.notes ?? []).map((note) => inRoot(outcome, note)));
  if (notes.length) {
    emitStopNotes(notes);
    return;
  }
  const messages = outcomes.map(({ message }) => message).filter(Boolean);
  if (messages.length) emit({ systemMessage: messages.join('\n') });
};
