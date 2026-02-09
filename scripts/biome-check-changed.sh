#!/bin/sh
set -eu

# Run Biome only on files changed vs origin/main (PR parity).
git fetch origin main --depth=1 >/dev/null 2>&1 || true

FILES="$(git diff --name-only --diff-filter=ACMRT origin/main...HEAD | grep -E '^src/.*\\.(ts|tsx|js|jsx|json|css)$' || true)"

if [ -z "$FILES" ]; then
  echo "No changed src/ files to check."
  exit 0
fi

echo "Biome checking changed files:"
echo "$FILES"

# shellcheck disable=SC2086
bunx biome check $FILES

