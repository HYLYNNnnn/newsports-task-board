#!/bin/zsh
set -eu
cd "${0:A:h}"
RUNTIME_BIN="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
RUNTIME_FALLBACK="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"
if ! command -v node >/dev/null 2>&1 && [[ -x "$RUNTIME_BIN/node" ]]; then
  export PATH="$RUNTIME_BIN:$RUNTIME_FALLBACK:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  print 'Please install Node.js 22.12+ before starting Nextplay.'
  exit 1
fi
if command -v pnpm >/dev/null 2>&1; then
  if [[ ! -d node_modules ]]; then pnpm install; fi
  pnpm dev
elif command -v npm >/dev/null 2>&1; then
  if [[ ! -d node_modules ]]; then npm install; fi
  npm run dev
else
  print 'Please install pnpm or npm before starting Nextplay.'
  exit 1
fi
