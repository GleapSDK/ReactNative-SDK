#!/bin/sh
# Run by npm's prepare script. Git's own pre-push hook, shared by every worktree of the clone, runs .githooks/pre-push
# of what is checked out. Only that one hook: pointing core.hooksPath at .githooks would also run any hook a branch adds
# there on checkout or pull.
dir=$(git --git-dir=.git rev-parse --git-common-dir 2>/dev/null) || exit 0
hook="$dir/hooks/pre-push"
case $(git --git-dir=.git config core.hooksPath) in
  '' | *.git/hooks | *.git/hooks/) ;;
  *) echo "core.hooksPath is set, so git does not run $hook and pushes here run no checks." ;;
esac
if [ -e "$hook" ] || [ -L "$hook" ]; then
  grep -q 'githooks/pre-push' "$hook" 2>/dev/null || echo "$hook already exists and is left as it is, so pushes here run no checks."
  exit 0
fi
mkdir -p "$dir/hooks" || exit 0
printf '%s\n' '#!/bin/sh' '[ -f .githooks/pre-push ] || exit 0' 'exec sh .githooks/pre-push "$@"' > "$hook" && chmod +x "$hook"
exit 0
