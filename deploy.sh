#!/usr/bin/env bash
# Сборка и выкладка статики на testgreenapi.riakovlev.ru (nginx отдаёт папку напрямую).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST=dash@194.87.44.229
DOCROOT=/home/dash/testgreenapi.riakovlev.ru
SSH="ssh -p 2241 -i $HOME/.ssh/dash_host_ed25519"

cd "$ROOT"
npm run build
rsync -az --delete -e "$SSH" dist/ "$HOST:$DOCROOT/"
echo "✓ https://testgreenapi.riakovlev.ru"
