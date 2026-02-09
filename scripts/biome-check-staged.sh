#!/bin/sh
set -eu

# Run Biome only on staged src/ files to keep pre-commit fast and CI-aligned.
FILES="$(git diff --cached --name-only --diff-filter=ACMRT | grep -E '^src/.*\\.(ts|tsx|js|jsx|json|css)$' || true)"

if [ -z "$FILES" ]; then
  echo "No staged src/ files to check."
  exit 0
fi

echo "Biome checking staged files:"
echo "$FILES"

# shellcheck disable=SC2086
bunx biome check $FILES

