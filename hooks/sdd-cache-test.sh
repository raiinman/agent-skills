#!/bin/bash
# Network-free Python stdlib tests; no jq, curl, model, or service required.
set -euo pipefail
for SDD_PYTHON in python3 python; do
  if command -v "$SDD_PYTHON" >/dev/null 2>&1 &&
     "$SDD_PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
    export PYTHONIOENCODING=utf-8
    exec "$SDD_PYTHON" "$(dirname "$0")/sdd-cache-test.py"
  fi
done
printf '%s\n' 'FAIL: cache regressions require Python 3.8+.' >&2
exit 1
