#!/usr/bin/env bash
# Bootstrap a fresh git worktree: the push hook and the dependencies. Run once from inside the new worktree.
# It copies no .env: the SDK reads none.
set -euo pipefail

here=$(git rev-parse --show-toplevel)
cd "$here"

# CI and the release use Node 24; an older shell default cannot run the tools.
if ! node --version 2>/dev/null | grep -qE '^v(2[4-9]|[3-9][0-9])'; then
  latest=$(ls -d "$HOME/.nvm/versions/node"/v24* 2>/dev/null | sort -V | tail -1)
  if [ -n "$latest" ]; then
    export PATH="$latest/bin:$PATH"
  fi
fi
echo "using node $(node --version)"

# Not an npm prepare script: package.json is published, and its scripts with it.
sh .githooks/install.sh

# npm ci, not npm install: install rewrites package-lock.json and leaves the worktree dirty. It also builds lib/.
npm ci
# The quality check's own TypeScript (tools/quality/package.json).
npm ci --prefix tools/quality

echo "worktree ready: $here"
