#!/bin/bash
# Native WebFetch has no same-response provenance and bypasses this cache.
set -euo pipefail
for SDD_PYTHON in python3 python; do
  if command -v "$SDD_PYTHON" >/dev/null 2>&1 &&
     "$SDD_PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
    export PYTHONIOENCODING=utf-8
    exec "$SDD_PYTHON" "$(dirname "$0")/lib/sdd_cache.py" post
  fi
done
# A missing/unsupported interpreter leaves the original tool available.
exit 0
