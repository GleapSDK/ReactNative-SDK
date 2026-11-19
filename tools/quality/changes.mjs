// What git knows about a change. One process per question, never one per file: a big PR stays fast.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const git = ({ root, args, input, env }) =>
  execFileSync('git', args, {
    cwd: root,
    input,
    env: env ? { ...process.env, ...env } : undefined,
    maxBuffer: 2 ** 31 - 1,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
const gitText = (request) => git(request).toString('utf8').trim();
const gitList = (request) => git(request).toString('utf8').split('\0').filter(Boolean);
const gitPath = ({ root, name }) => resolve(root, gitText({ root, args: ['rev-parse', '--git-path', name] }));

export const repoRootOf = (directory) => {
  try {
    return gitText({ root: directory, args: ['rev-parse', '--show-toplevel'] });
  } catch {
    return null;
  }
};

export const isSameRepository = (a, b) => commonDirOf(a) === commonDirOf(b);

export const commonDirOf = (root) => realpathSync(resolve(root, gitText({ root, args: ['rev-parse', '--git-common-dir'] })));

export const forkPointOf = ({ root, base, head }) => gitText({ root, args: ['merge-base', base, head ?? 'HEAD'] });

export const headOf = ({ root }) => gitText({ root, args: ['rev-parse', 'HEAD'] });

// origin/HEAD as the clone recorded it, else origin/main or origin/master, whichever exists.
const defaultBranchOf = ({ root, rows }) => {
  try {
    return gitText({ root, args: ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'] });
  } catch {
    return ['origin/main', 'origin/master'].find((ref) => rows.some((row) => row.startsWith(`${ref} `)));
  }
};

// The closest remote branch this one left. The default branch wins a tie, and a branch that holds this one plus more
// is its child, not its base. A ref at this very commit is this work pushed under another name, unless the commit is
// on the default branch anyway. Costs about 250 ms across 2000 refs, so the answer is kept per commit.
const findBase = ({ root, head }) => {
  const branch = gitText({ root, args: ['branch', '--show-current'] });
  const skipped = new Set(['origin/HEAD', 'origin', `origin/${branch}`]);
  const refs = gitText({ root, args: ['for-each-ref', '--format=%(refname:short) %(ahead-behind:HEAD)', 'refs/remotes/origin'] });
  const rows = refs.split('\n').filter(Boolean);
  const defaultBase = defaultBranchOf({ root, rows });
  const defaultRow = rows.find((row) => row.startsWith(`${defaultBase} `));
  const isAheadOfDefault = !defaultRow || Number(defaultRow.split(' ')[2]) > 0;
  let best = null;
  for (const row of rows) {
    const [ref, ahead, behind] = row.split(' ');
    const isChild = Number(ahead) > 0 && Number(behind) === 0 && ref !== defaultBase;
    const isThisCommit = Number(ahead) === 0 && Number(behind) === 0 && ref !== defaultBase;
    if (skipped.has(ref) || isChild || (isThisCommit && isAheadOfDefault)) continue;
    const isBetter = !best || Number(behind) < best.behind || (Number(behind) === best.behind && ref === defaultBase);
    if (isBetter) best = { ref, behind: Number(behind) };
  }
  if (!best) throw new Error(`no remote branch to compare ${head.slice(0, 10)} with`);
  return best.ref;
};

export const resolveBase = ({ root }) => {
  const head = headOf({ root });
  const cache = gitPath({ root, name: 'quality-base' });
  const [cachedHead, cachedBase] = existsSync(cache) ? readFileSync(cache, 'utf8').trim().split(' ') : [];
  if (cachedHead === head && cachedBase) return cachedBase;
  const base = findBase({ root, head });
  writeFileSync(cache, `${head} ${base}\n`);
  return base;
};

const parseNameStatus = (tokens) => {
  const changes = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const status = tokens[i];
    const isTwoPaths = status.startsWith('R') || status.startsWith('C');
    const first = tokens[(i += 1)];
    const path = isTwoPaths ? tokens[(i += 1)] : first;
    changes.push({ path, previousPath: status.startsWith('R') ? first : null, isDeleted: status === 'D' });
  }
  return changes;
};

// The working tree as git would see it after `git add -A`, without touching the real index or object store. That
// makes a plain `mv` a rename and gives one hash for the whole tree.
export const workingTreeState = ({ root, fork }) => {
  const scratch = mkdtempSync(join(tmpdir(), 'quality-tree-'));
  try {
    const index = gitPath({ root, name: 'index' });
    if (existsSync(index)) copyFileSync(index, join(scratch, 'index'));
    mkdirSync(join(scratch, 'objects'));
    const env = {
      GIT_INDEX_FILE: join(scratch, 'index'),
      GIT_OBJECT_DIRECTORY: join(scratch, 'objects'),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: gitPath({ root, name: 'objects' }),
    };
    git({ root, args: ['add', '-A', '--', '.'], env });
    const tree = gitText({ root, args: ['write-tree'], env });
    const args = ['diff', '--cached', '--name-status', '-M', '--no-ext-diff', '-z', fork];
    return { tree, changes: parseNameStatus(gitList({ root, args, env })) };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

// Without a head this compares with the working tree, so it also sees what is not committed yet.
export const changedFiles = ({ root, fork, head }) => {
  if (!head) return workingTreeState({ root, fork }).changes;
  return parseNameStatus(gitList({ root, args: ['diff', '--name-status', '-M', '--no-ext-diff', '-z', fork, head] }));
};

export const readBlobs = ({ root, rev, paths }) => {
  const blobs = new Map();
  if (!paths.length) return blobs;
  const input = paths.map((path) => `${rev}:${path}\n`).join('');
  const output = git({ root, args: ['cat-file', '--batch'], input });
  let offset = 0;
  for (const path of paths) {
    const headerEnd = output.indexOf(10, offset);
    const header = output.toString('utf8', offset, headerEnd);
    offset = headerEnd + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    blobs.set(path, output.toString('utf8', offset, offset + size));
    offset += size + 1;
  }
  return blobs;
};

export const filesAt = ({ root, rev }) => new Set(gitList({ root, args: ['ls-tree', '-r', '--name-only', '-z', rev] }));

export const foldersAt = ({ root, rev }) => new Set(gitList({ root, args: ['ls-tree', '-r', '-d', '--name-only', '-z', rev] }));

export const newFoldersOf = ({ path, existing }) => {
  const segments = path.split('/').slice(0, -1);
  const folders = segments.map((_, index) => segments.slice(0, index + 1).join('/'));
  return folders.filter((folder) => !existing.has(folder));
};
