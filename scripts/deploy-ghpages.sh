#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (branch-based GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE=$(git remote get-url origin)

DEPLOY_BASE=/gostop/ npm run build
touch dist/.nojekyll

cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "deploy $(date +%Y-%m-%d_%H%M)"
git push -f "$REMOTE" gh-pages:gh-pages
cd ..
rm -rf dist/.git
echo "deployed gh-pages"
