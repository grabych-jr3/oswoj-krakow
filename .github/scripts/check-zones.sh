#!/usr/bin/env bash
# Zone guard (PLAN.md §5.2, §5.5): fails a PR if it changes files outside the zone of its branch prefix.
#   a/…        → zone A only          b/… → zone B only
#   c/…        → everything except zones A and B
#   contract/… → shared files only
# Shared files and app/package.json + lock are allowed on any branch: CODEOWNERS review guards them.
# Usage: check-zones.sh <branch> <base-ref>   (e.g. check-zones.sh a/geocoder origin/main)
set -euo pipefail

branch="${1:?branch name required}"
base="${2:-origin/main}"

zone_of() {
  case "$1" in
    pipeline/geo/*|app/src/server/geo/*|app/src/app/api/geocode/*|app/src/app/api/nearby/*|\
    app/public/data/layers/*|app/data/geo/*|app/scripts/validate-geo.ts|docs/tech/dane.md)
      echo A ;;
    pipeline/kb/*|content/scenarios/*|evals/*|app/src/server/agent/*|app/src/app/api/chat/*|\
    app/data/kb/*|app/scripts/validate-kb.ts|docs/tech/ai.md)
      echo B ;;
    app/src/contracts/*|PLAN.md|AGENTS.md|CLAUDE.md)
      echo SHARED ;;
    app/package.json|app/package-lock.json)
      echo DEPS ;;
    *)
      echo C ;;
  esac
}

case "$branch" in
  a/*) allowed="A" ;;
  b/*) allowed="B" ;;
  c/*) allowed="C" ;;
  contract/*) allowed="" ;;
  *)
    echo "Branch '$branch' must start with a/, b/, c/ or contract/ (PLAN.md §5.5)."
    exit 1 ;;
esac

violations=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  zone="$(zone_of "$file")"
  if [ "$zone" = "SHARED" ] || [ "$zone" = "DEPS" ] || [ "$zone" = "$allowed" ]; then
    continue
  fi
  echo "✗ $file belongs to zone $zone, not allowed on branch $branch"
  violations=$((violations + 1))
done < <(git diff --name-only "$base"...HEAD)

if [ "$violations" -gt 0 ]; then
  echo "$violations file(s) outside the zone. Ask the owner instead (PLAN.md §5.1)."
  exit 1
fi
echo "Zone check passed for $branch."
