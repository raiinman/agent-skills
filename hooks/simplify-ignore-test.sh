#!/bin/bash
# simplify-ignore-test.sh — Tests for the simplify-ignore hook
#
# Exercises filter_file by extracting function definitions from the hook.
# Run: bash hooks/simplify-ignore-test.sh

set -euo pipefail

PASS=0 FAIL=0
TMPDIR=$(mktemp -d)
TMPDIR=$(cd -P "$TMPDIR" && pwd)
trap 'rm -rf "$TMPDIR"' EXIT

export CACHE="$TMPDIR/cache"
mkdir -p "$CACHE"

# Extract function definitions we need
hash_cmd() {
  if command -v shasum >/dev/null 2>&1; then shasum
  elif command -v sha1sum >/dev/null 2>&1; then sha1sum
  else printf '%s\n' "error: missing shasum or sha1sum" >&2; exit 1; fi
}
file_id() { printf '%s' "$1" | hash_cmd | cut -c1-16; }
escape_glob() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\*/\\*}"
  s="${s//\?/\\?}"
  s="${s//\[/\\[}"
  printf '%s' "$s"
}

# Extract the actual helpers rather than maintaining duplicate filtering code.
eval "$(sed -n '/^no_symlink_components()/,/^}/p' hooks/simplify-ignore.sh)"
eval "$(sed -n '/^cache_guard()/,/^}/p' hooks/simplify-ignore.sh)"
eval "$(sed -n '/^block_hash()/,/^}/p' hooks/simplify-ignore.sh)"
eval "$(sed -n '/^cache_block_content()/,/^}/p' hooks/simplify-ignore.sh)"
eval "$(sed -n '/^filter_file()/,/^}/p' hooks/simplify-ignore.sh)"

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    printf '  PASS: %s\n' "$label"
  else
    FAIL=$((FAIL + 1))
    printf '  FAIL: %s\n' "$label" >&2
    printf '    expected: %s\n' "$(printf '%s' "$expected" | cat -v)" >&2
    printf '    actual:   %s\n' "$(printf '%s' "$actual" | cat -v)" >&2
  fi
}

# ── Test 1: Single-line block produces exactly one placeholder ────────────
printf 'Test 1: Single-line block (start+end on same line)\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/single-line.js"
DEST="$TMPDIR/single-line-filtered.js"
cat > "$SRC" <<'EOF'
const a = 1;
/* simplify-ignore-start */ const secret = 42; /* simplify-ignore-end */
const b = 2;
EOF

FID="test_single"
filter_file "$SRC" "$DEST" "$FID"

placeholder_count=$(grep -c 'BLOCK_' "$DEST")
assert_eq "exactly one placeholder line" "1" "$placeholder_count"
assert_eq "line before block preserved" "1" "$(grep -c 'const a = 1' "$DEST")"
assert_eq "line after block preserved" "1" "$(grep -c 'const b = 2' "$DEST")"

block_files=$(ls "$CACHE/${FID}".block.* 2>/dev/null | wc -l | tr -d ' ')
assert_eq "one block file in cache" "1" "$block_files"

block_content=$(cat "$CACHE/${FID}".block.*)
assert_eq "block content matches" \
  "/* simplify-ignore-start */ const secret = 42; /* simplify-ignore-end */" \
  "$block_content"

# ── Test 2: Multi-line block ─────────────────────────────────────────────
printf '\nTest 2: Multi-line block\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/multi-line.js"
DEST="$TMPDIR/multi-line-filtered.js"
cat > "$SRC" <<'EOF'
const a = 1;
// simplify-ignore-start
const secret1 = 42;
const secret2 = 99;
// simplify-ignore-end
const b = 2;
EOF

FID="test_multi"
filter_file "$SRC" "$DEST" "$FID"

placeholder_count=$(grep -c 'BLOCK_' "$DEST")
assert_eq "exactly one placeholder for multi-line block" "1" "$placeholder_count"

output_lines=$(wc -l < "$DEST" | tr -d ' ')
assert_eq "output has 3 lines (before + placeholder + after)" "3" "$output_lines"

# ── Test 3: Multiple blocks in one file ──────────────────────────────────
printf '\nTest 3: Multiple blocks in one file\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/multi-block.js"
DEST="$TMPDIR/multi-block-filtered.js"
cat > "$SRC" <<'EOF'
line1
// simplify-ignore-start
blockA
// simplify-ignore-end
line2
// simplify-ignore-start
blockB
// simplify-ignore-end
line3
EOF

FID="test_multiblock"
filter_file "$SRC" "$DEST" "$FID"

placeholder_count=$(grep -c 'BLOCK_' "$DEST")
assert_eq "two placeholders for two blocks" "2" "$placeholder_count"

block_files=$(ls "$CACHE/${FID}".block.* 2>/dev/null | wc -l | tr -d ' ')
assert_eq "two block files in cache" "2" "$block_files"

# ── Test 4: Reason string preserved ──────────────────────────────────────
printf '\nTest 4: Reason string in placeholder\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/reason.js"
DEST="$TMPDIR/reason-filtered.js"
cat > "$SRC" <<'EOF'
// simplify-ignore-start: perf-critical
hot_loop();
// simplify-ignore-end
EOF

FID="test_reason"
filter_file "$SRC" "$DEST" "$FID"

assert_eq "placeholder includes reason" "1" "$(grep -c 'perf-critical' "$DEST")"

reason_files=$(ls "$CACHE/${FID}".reason.* 2>/dev/null | wc -l | tr -d ' ')
assert_eq "reason file saved" "1" "$reason_files"
assert_eq "reason content" "perf-critical" "$(cat "$CACHE/${FID}".reason.*)"

# ── Test 5: Trailing newline preservation ────────────────────────────────
printf '\nTest 5: Trailing newline preservation\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/no-trailing-nl.js"
DEST="$TMPDIR/no-trailing-nl-filtered.js"
printf 'line1\n// simplify-ignore-start\nsecret\n// simplify-ignore-end' > "$SRC"

FID="test_trail"
filter_file "$SRC" "$DEST" "$FID"

# Source has no trailing newline; dest should also have no trailing newline
src_has_nl=$(tail -c 1 "$SRC" | wc -l | tr -d ' ')
dest_has_nl=$(tail -c 1 "$DEST" | wc -l | tr -d ' ')
assert_eq "dest preserves no-trailing-newline from source" "$src_has_nl" "$dest_has_nl"

# ── Test 6: No blocks → return 1 ────────────────────────────────────────
printf '\nTest 6: No blocks returns 1\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/no-blocks.js"
DEST="$TMPDIR/no-blocks-filtered.js"
cat > "$SRC" <<'EOF'
const a = 1;
const b = 2;
EOF

FID="test_noblocks"
rc=0
filter_file "$SRC" "$DEST" "$FID" || rc=$?
assert_eq "returns 1 when no blocks found" "1" "$rc"

# ── Test 7: Unclosed block emits warning and flushes ─────────────────────
printf '\nTest 7: Unclosed block\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/unclosed.js"
DEST="$TMPDIR/unclosed-filtered.js"
cat > "$SRC" <<'EOF'
line1
// simplify-ignore-start
orphan code
EOF

FID="test_unclosed"
stderr_out=$(filter_file "$SRC" "$DEST" "$FID" 2>&1) || true
assert_eq "warning emitted for unclosed block" "1" "$(printf '%s' "$stderr_out" | grep -c 'unclosed')"
assert_eq "orphan code flushed to output" "1" "$(grep -c 'orphan code' "$DEST")"

# ── Test 8: Single-line block with reason ────────────────────────────────
printf '\nTest 8: Single-line block with reason\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/single-reason.js"
DEST="$TMPDIR/single-reason-filtered.js"
cat > "$SRC" <<'EOF'
before
/* simplify-ignore-start: hot-path */ x = compute(); /* simplify-ignore-end */
after
EOF

FID="test_single_reason"
filter_file "$SRC" "$DEST" "$FID"

placeholder_count=$(grep -c 'BLOCK_' "$DEST")
assert_eq "exactly one placeholder for single-line+reason" "1" "$placeholder_count"
assert_eq "reason in placeholder" "1" "$(grep -c 'hot-path' "$DEST")"

# ── Test 9: HTML comment syntax ──────────────────────────────────────────
printf '\nTest 9: HTML comment syntax\n'
rm -f "$CACHE"/*

SRC="$TMPDIR/html.html"
DEST="$TMPDIR/html-filtered.html"
cat > "$SRC" <<'EOF'
<div>
<!-- simplify-ignore-start -->
<secret-component />
<!-- simplify-ignore-end -->
</div>
EOF

FID="test_html"
filter_file "$SRC" "$DEST" "$FID"

placeholder_count=$(grep -c 'BLOCK_' "$DEST")
assert_eq "HTML block replaced" "1" "$placeholder_count"
assert_eq "HTML suffix preserved" "1" "$(grep -c '\-\->' "$DEST")"

# ── Test 10: JSON parsing error warning ──────────────────────────────────
printf '\nTest 10: Malformed JSON input produces warning\n'

# Without jq the hook's guard exits before parsing input. Assert whichever
# branch this machine can exercise (same pattern as session-start-test.sh).
warning_out=$(echo 'NOT_JSON{{{' | bash hooks/simplify-ignore.sh 2>&1) || true
if command -v jq >/dev/null 2>&1; then
  assert_eq "warning on bad JSON" "1" "$(printf '%s' "$warning_out" | grep -c 'Warning.*failed to parse')"
else
  assert_eq "missing-jq guard surfaced" "1" "$(printf '%s' "$warning_out" | grep -c 'error: missing jq')"
fi

# ── Test 11: Stop keeps a change made outside Edit|Write ─────────────────
printf '\nTest 11: Stop keeps a Bash write made after the last Edit\n'

if ! command -v jq >/dev/null 2>&1; then
  printf '  SKIP: full lifecycle needs jq (the hook exits at its jq guard)\n'
else
  PROJ="$TMPDIR/proj"
  rm -rf "$PROJ"
  mkdir -p "$PROJ/.claude"
  TARGET="$PROJ/app.js"
  cat > "$TARGET" <<'EOF'
const editable = 1;
/* simplify-ignore-start: perf-critical */
const protectedValue = 42;
/* simplify-ignore-end */
EOF

  hook_event() {
    printf '%s' "$1" | jq '. + {session_id:"test-session",hook_event_name:(if .tool_name == "Read" then "PreToolUse" elif .tool_name then "PostToolUse" else "Stop" end)}' |
      CLAUDE_PROJECT_DIR="$PROJ" SIMPLIFY_IGNORE_CACHE_DIR="$PROJ/.claude/.simplify-ignore-cache" bash hooks/simplify-ignore.sh
  }
  read_event=$(printf '{"tool_name":"Read","tool_input":{"file_path":"%s"}}' "$TARGET")
  edit_event=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$TARGET")

  # PreToolUse Read → block hidden behind a placeholder, backup taken
  hook_event "$read_event"
  assert_eq "protected block hidden after Read" "1" "$(grep -c 'BLOCK_' "$TARGET")"
  assert_eq "protected content off disk after Read" "0" "$(grep -c 'protectedValue' "$TARGET")"

  # Model edits the filtered file → PostToolUse Edit refreshes the backup
  printf 'const added = 3;\n' >> "$TARGET"
  hook_event "$edit_event"

  # A later write through Bash — no Edit or Write event follows it
  sed 's/const editable = 1;/const editable = 2;/' "$TARGET" > "$TMPDIR/bash-write.js"
  cat "$TMPDIR/bash-write.js" > "$TARGET"

  # Stop
  hook_event '{}'

  assert_eq "Bash write survives Stop" "1" "$(grep -c 'const editable = 2;' "$TARGET")"
  assert_eq "stale backup value not restored" "0" "$(grep -c 'const editable = 1;' "$TARGET")"
  assert_eq "edit made through Edit survives Stop" "1" "$(grep -c 'const added = 3;' "$TARGET")"
  assert_eq "protected block back on disk" "1" "$(grep -c 'const protectedValue = 42;' "$TARGET")"
  assert_eq "no placeholder left after Stop" "0" "$(grep -c 'BLOCK_' "$TARGET")"
fi

# ── Test 12: Stop fallback keeps the rewrite in the cache ───────────────
printf '\nTest 12: Wholesale rewrite stays in place and protected backup is retained\n'

if ! command -v jq >/dev/null 2>&1; then
  printf '  SKIP: full lifecycle needs jq (the hook exits at its jq guard)\n'
else
  PROJ="$TMPDIR/proj-rewrite"
  rm -rf "$PROJ"
  mkdir -p "$PROJ/.claude"
  TARGET="$PROJ/app.js"
  cat > "$TARGET" <<'EOF'
const editable = 1;
/* simplify-ignore-start: perf-critical */
const protectedValue = 42;
/* simplify-ignore-end */
EOF

  hook_event() {
    printf '%s' "$1" | jq '. + {session_id:"test-session",hook_event_name:(if .tool_name == "Read" then "PreToolUse" elif .tool_name then "PostToolUse" else "Stop" end)}' |
      CLAUDE_PROJECT_DIR="$PROJ" SIMPLIFY_IGNORE_CACHE_DIR="$PROJ/.claude/.simplify-ignore-cache" bash hooks/simplify-ignore.sh
  }
  read_event=$(printf '{"tool_name":"Read","tool_input":{"file_path":"%s"}}' "$TARGET")

  hook_event "$read_event"
  assert_eq "protected block hidden after Read" "1" "$(grep -c 'BLOCK_' "$TARGET")"

  # Wholesale rewrite — every placeholder is gone, so Stop has nothing to expand
  printf 'const rewritten = 7;\n' > "$TARGET"

  stop_out=$(hook_event '{}' 2>&1) || true

  PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
  RECOVERED=$(find "$PROJ_CACHE" -name '*.recovered.*' -type f | head -1)

  assert_eq "rewrite stays in place" "const rewritten = 7;" "$(cat "$TARGET")"
  assert_eq "rewrite kept in cache" "1" "$([ -f "$RECOVERED" ] && echo 1 || echo 0)"
  assert_eq "recovery holds protected original" "1" "$(grep -c 'const protectedValue = 42;' "$RECOVERED")"
  assert_eq "warning names the restored file" "1" \
    "$(printf '%s' "$stop_out" | grep -c -F "$TARGET")"
  assert_eq "warning names the cached rewrite" "1" \
    "$(printf '%s' "$stop_out" | grep -c -F "$RECOVERED")"
fi

# ── Test 13: Read → direct write with no event → Stop ───────────────────
printf '\nTest 13: A write with no Edit or Write event survives Stop\n'

if ! command -v jq >/dev/null 2>&1; then
  printf '  SKIP: full lifecycle needs jq (the hook exits at its jq guard)\n'
else
  PROJ="$TMPDIR/proj-noevent"
  rm -rf "$PROJ"
  mkdir -p "$PROJ/.claude"
  TARGET="$PROJ/app.js"
  cat > "$TARGET" <<'EOF'
const editable = 1;
/* simplify-ignore-start: perf-critical */
const protectedValue = 42;
/* simplify-ignore-end */
EOF

  hook_event() {
    printf '%s' "$1" | jq '. + {session_id:"test-session",hook_event_name:(if .tool_name == "Read" then "PreToolUse" elif .tool_name then "PostToolUse" else "Stop" end)}' |
      CLAUDE_PROJECT_DIR="$PROJ" SIMPLIFY_IGNORE_CACHE_DIR="$PROJ/.claude/.simplify-ignore-cache" bash hooks/simplify-ignore.sh
  }
  read_event=$(printf '{"tool_name":"Read","tool_input":{"file_path":"%s"}}' "$TARGET")

  # Read → placeholder on disk, backup taken
  hook_event "$read_event"

  # Direct write, no Edit or Write event follows it
  sed 's/const editable = 1;/const editable = 9;/' "$TARGET" > "$TMPDIR/noevent-write.js"
  cat "$TMPDIR/noevent-write.js" > "$TARGET"

  # Stop
  hook_event '{}'

  assert_eq "write with no event survives Stop" "1" "$(grep -c 'const editable = 9;' "$TARGET")"
  assert_eq "stale backup value not restored" "0" "$(grep -c 'const editable = 1;' "$TARGET")"
  assert_eq "protected block back on disk" "1" "$(grep -c 'const protectedValue = 42;' "$TARGET")"
  assert_eq "no placeholder left after Stop" "0" "$(grep -c 'BLOCK_' "$TARGET")"
fi

# ── Tests 14-16: full-lifecycle round-trip fidelity ──────────────────────
# Run the hook end-to-end (Read → [Edit] → Stop) against an isolated
# CLAUDE_PROJECT_DIR and assert the original bytes are recovered exactly.
# These exercise the expand/restore half of the hook, which the
# function-extraction tests above cannot reach.

if command -v jq >/dev/null 2>&1; then

rt_hook_event() {
  # rt_hook_event <project_dir> <tool_name|""> <file_path|"">
  local proj="$1" tool="$2" fp="$3" input sid="${4:-test-session}" event="${5:-}"
  if [ -n "$tool" ]; then
    input=$(jq -n --arg t "$tool" --arg fp "$fp" \
      '{tool_name:$t, tool_input:{file_path:$fp}}')
  else
    input='{}'
  fi
  if [ -z "$event" ]; then
    if [ "$tool" = "Read" ]; then event=PreToolUse
    elif [ -n "$tool" ]; then event=PostToolUse
    else event=Stop; fi
  fi
  input=$(printf '%s' "$input" | jq --arg sid "$sid" --arg event "$event" '. + {session_id:$sid,hook_event_name:$event}')
  printf '%s' "$input" | CLAUDE_PROJECT_DIR="$proj" SIMPLIFY_IGNORE_CACHE_DIR="$proj/.claude/.simplify-ignore-cache" bash hooks/simplify-ignore.sh
}

# ── Test 14: Read → Stop restores the file byte-identically ──────────────
printf '\nTest 14: Round-trip Read → Stop (byte fidelity)\n'
PROJ="$TMPDIR/rt14"; mkdir -p "$PROJ"
RT="$PROJ/roundtrip.js"
cat > "$RT" <<'EOF'
const a = `template ${literal}`;
// simplify-ignore-start: perf-critical
const secret = "glob*chars? [and] \\backslashes";
if (a && b) { mask = flags & 0xff; } // ampersands must survive bash 5.2 patsub_replacement
hot_loop($HOME);
// simplify-ignore-end
middle line
/* simplify-ignore-start */ const inline = 1; /* simplify-ignore-end */
const b = 2;
EOF
cp "$RT" "$PROJ/roundtrip.orig"

rt_hook_event "$PROJ" "Read" "$RT"
assert_eq "blocks hidden on disk after Read" "2" "$(grep -c 'BLOCK_' "$RT")"
assert_eq "secret absent from disk after Read" "0" "$(grep -c 'secret' "$RT")"

rt_hook_event "$PROJ" "" ""
if cmp -s "$RT" "$PROJ/roundtrip.orig"; then
  assert_eq "Stop restores original bytes" "identical" "identical"
else
  assert_eq "Stop restores original bytes" "identical" "$(cmp "$RT" "$PROJ/roundtrip.orig" 2>&1 | head -1)"
fi

# ── Test 15: Round-trip preserves missing trailing newline ────────────────
printf '\nTest 15: Round-trip with no trailing newline\n'
PROJ="$TMPDIR/rt15"; mkdir -p "$PROJ"
RT="$PROJ/nonewline.js"
printf 'top\n// simplify-ignore-start\nhidden\n// simplify-ignore-end\nbottom' > "$RT"
cp "$RT" "$PROJ/nonewline.orig"

rt_hook_event "$PROJ" "Read" "$RT"
assert_eq "block hidden" "1" "$(grep -c 'BLOCK_' "$RT")"
rt_hook_event "$PROJ" "" ""
if cmp -s "$RT" "$PROJ/nonewline.orig"; then
  assert_eq "no-trailing-newline file restored byte-identically" "identical" "identical"
else
  assert_eq "no-trailing-newline file restored byte-identically" "identical" "differs"
fi

# ── Test 16: Read → model edit → Edit event → Stop keeps the edit ────────
printf '\nTest 16: Round-trip with an edit during the session\n'
PROJ="$TMPDIR/rt16"; mkdir -p "$PROJ"
RT="$PROJ/edited.js"
cat > "$RT" <<'EOF'
const a = 1;
// simplify-ignore-start
const secret = 42;
// simplify-ignore-end
const b = 2;
EOF
cp "$RT" "$PROJ/edited.orig"

rt_hook_event "$PROJ" "Read" "$RT"
# Simulate the model editing the filtered file: append a new line.
printf '%s\n' "const added = true;" >> "$RT"
rt_hook_event "$PROJ" "Edit" "$RT"

assert_eq "disk still placeholdered after Edit" "1" "$(grep -c 'BLOCK_' "$RT")"
assert_eq "secret still absent from disk after Edit" "0" "$(grep -c 'secret' "$RT")"
assert_eq "added line survives re-filter" "1" "$(grep -c 'const added' "$RT")"
BAK=$(ls "$PROJ/.claude/.simplify-ignore-cache"/*.bak 2>/dev/null | head -1)
assert_eq "backup holds real content" "1" "$(grep -c 'const secret = 42' "${BAK:-/dev/null}")"
assert_eq "backup holds the edit" "1" "$(grep -c 'const added' "${BAK:-/dev/null}")"

rt_hook_event "$PROJ" "" ""
EXPECTED="$PROJ/edited.expected"
cp "$PROJ/edited.orig" "$EXPECTED"
printf '%s\n' "const added = true;" >> "$EXPECTED"
if cmp -s "$RT" "$EXPECTED"; then
  assert_eq "Stop restores original + edit byte-identically" "identical" "identical"
else
  assert_eq "Stop restores original + edit byte-identically" "identical" "differs"
fi

# ── Test 17: Native event/session identity is mandatory ────────────────
printf '\nTest 17: Missing identity and unrelated events do not mutate\n'
PROJ="$TMPDIR/rt17"; mkdir -p "$PROJ"
RT="$PROJ/identity.js"
printf '// simplify-ignore-start\nhidden\n// simplify-ignore-end\n' > "$RT"
cp "$RT" "$PROJ/original"
for input in '{}' '{"hook_event_name":"Stop"}' '{"session_id":"A"}' \
  '{"hook_event_name":"SessionStart","session_id":"A"}'; do
  printf '%s' "$input" | CLAUDE_PROJECT_DIR="$PROJ" SIMPLIFY_IGNORE_CACHE_DIR="$PROJ/.claude/.simplify-ignore-cache" bash hooks/simplify-ignore.sh
done
assert_eq "identity-less events leave bytes unchanged" "0" "$(cmp -s "$RT" "$PROJ/original"; echo $?)"
assert_eq "identity-less events create no cache" "0" "$([ -d "$PROJ/.claude/.simplify-ignore-cache" ] && echo 1 || echo 0)"

# ── Test 18: Foreign Stop cannot invalidate an active owner's blocks ───
printf '\nTest 18: A Read, B Stop, denied B tools, A Write and Stop\n'
PROJ="$TMPDIR/rt18"; mkdir -p "$PROJ/nested"
RT="$PROJ/shared.js"
printf 'editable\n// simplify-ignore-start\nprotected\n// simplify-ignore-end\n' > "$RT"
cp "$RT" "$PROJ/expected"
rt_hook_event "$PROJ" Read "$RT" A
rt_hook_event "$PROJ" '' '' B
assert_eq "foreign Stop leaves placeholder intact" "1" "$(grep -c BLOCK_ "$RT")"
for tool in Read Edit Write; do
  rc=0
  rt_hook_event "$PROJ" "$tool" "$PROJ/nested/../shared.js" B PreToolUse 2>"$PROJ/denied" || rc=$?
  assert_eq "foreign $tool denied before tool execution" "2" "$rc"
done
if [ "$RT" -ef "$PROJ/SHARED.JS" ]; then
  rc=0
  rt_hook_event "$PROJ" Write "$PROJ/SHARED.JS" B PreToolUse 2>"$PROJ/denied" || rc=$?
  assert_eq "foreign case-alias Write is denied" "2" "$rc"
else
  printf '  SKIP: case-alias assertion needs a case-insensitive filesystem\n'
fi
printf 'added\n' >> "$RT"
printf 'added\n' >> "$PROJ/expected"
rt_hook_event "$PROJ" Write "$RT" A
rt_hook_event "$PROJ" '' '' A
assert_eq "owner Write and Stop retain protected bytes and edit" "0" "$(cmp -s "$RT" "$PROJ/expected"; echo $?)"

# ── Test 19: Rewrites do not overwrite recoveries or backups ───────────
printf '\nTest 19: PostToolUse wholesale rewrite preserves original backup\n'
PROJ="$TMPDIR/rt19"; mkdir -p "$PROJ"
RT="$PROJ/rewrite.js"
printf '// simplify-ignore-start\nprotected\n// simplify-ignore-end\n' > "$RT"
cp "$RT" "$PROJ/original"
rt_hook_event "$PROJ" Read "$RT" A
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
BAK=$(find "$PROJ_CACHE" -name '*.bak' -type f | head -1)
OLD_RECOVERY="${BAK%.bak}.recovered"
printf 'existing recovery\n' > "$OLD_RECOVERY"
printf 'rewritten with no terminal newline' > "$RT"
rt_hook_event "$PROJ" Write "$RT" A 2>"$PROJ/warnings"
assert_eq "PostToolUse does not refresh backup from rewrite" "0" "$(cmp -s "$BAK" "$PROJ/original"; echo $?)"
rt_hook_event "$PROJ" '' '' A 2>>"$PROJ/warnings"
assert_eq "rewrite stays in place without newline changes" "rewritten with no terminal newline" "$(cat "$RT")"
assert_eq "rewrite still has no terminal newline" "0" "$(tail -c1 "$RT" | wc -l | tr -d ' ')"
assert_eq "existing .recovered is never overwritten" "existing recovery" "$(cat "$OLD_RECOVERY")"
RECOVERED=$(find "$PROJ_CACHE" -name '*.recovered.*' -type f | head -1)
assert_eq "unique recovery retains protected original bytes" "0" "$(cmp -s "$RECOVERED" "$PROJ/original"; echo $?)"

# ── Test 20: CRLF, blank lines, terminal blocks, modes, input aliases ───
printf '\nTest 20: Byte fidelity and canonical input aliases\n'
PROJ="$TMPDIR/rt20"; mkdir -p "$PROJ/nested"
for variant in crlf terminal blanklines; do
  RT="$PROJ/$variant.js"
  case "$variant" in
    crlf) printf 'top\r\n/* simplify-ignore-start */\r\nhidden\r\n/* simplify-ignore-end */\r\nbottom\r\n' > "$RT" ;;
    terminal) printf 'top\n// simplify-ignore-start\nhidden\n// simplify-ignore-end' > "$RT" ;;
    blanklines) printf '\n\n// simplify-ignore-start\nhidden\n\n// simplify-ignore-end\n\n\n' > "$RT" ;;
  esac
  chmod 750 "$RT"
  original_mode=$(stat -c '%a' "$RT")
  cp "$RT" "$PROJ/$variant.original"
  rt_hook_event "$PROJ" Read "$PROJ/nested/../$variant.js" A
  rt_hook_event "$PROJ" Read "$variant.js" A
  rt_hook_event "$PROJ" '' '' A
  assert_eq "$variant restored byte-identically" "0" "$(cmp -s "$RT" "$PROJ/$variant.original"; echo $?)"
  assert_eq "$variant preserves mode" "$original_mode" "$(stat -c '%a' "$RT")"
done

# ── Test 21: Corrupt metadata never deletes the only recovery ──────────
printf '\nTest 21: Metadata path aliases and missing paths retain backups\n'
PROJ="$TMPDIR/rt21"; mkdir -p "$PROJ"
RT="$PROJ/metadata.js"
printf '// simplify-ignore-start\nprotected\n// simplify-ignore-end\n' > "$RT"
rt_hook_event "$PROJ" Read "$RT" A
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
BAK=$(find "$PROJ_CACHE" -name '*.bak' -type f | head -1)
PATHFILE="${BAK%.bak}.path"
printf '%s' "$PROJ/./metadata.js" > "$PATHFILE"
rt_hook_event "$PROJ" '' '' A 2>"$PROJ/warnings"
assert_eq "metadata alias does not authorize restoration" "1" "$(grep -c BLOCK_ "$RT")"
assert_eq "metadata alias retains backup" "1" "$([ -f "$BAK" ] && echo 1 || echo 0)"
rm -f "$PATHFILE"
rt_hook_event "$PROJ" '' '' A 2>>"$PROJ/warnings"
assert_eq "missing metadata retains backup" "1" "$([ -f "$BAK" ] && echo 1 || echo 0)"

# ── Test 22: Foreign and unowned locks are never reclaimed ─────────────
printf '\nTest 22: Foreign and unowned lock refusal\n'
PROJ="$TMPDIR/rt22"; mkdir -p "$PROJ"
RT="$PROJ/locked.js"
printf '// simplify-ignore-start\nprotected\n// simplify-ignore-end\n' > "$RT"
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"; mkdir -p "$PROJ_CACHE"
FID=$(file_id "$RT")
mkdir "$PROJ_CACHE/$FID.lock"
printf 'B' > "$PROJ_CACHE/$FID.lock/owner"
touch -t 202001010000 "$PROJ_CACHE/$FID.lock"
rc=0; rt_hook_event "$PROJ" Read "$RT" A 2>"$PROJ/warnings" || rc=$?
assert_eq "stale foreign lock denies Read" "2" "$rc"
assert_eq "foreign lock owner survives" "B" "$(cat "$PROJ_CACHE/$FID.lock/owner")"
rt_hook_event "$PROJ" '' '' A
assert_eq "foreign lock survives Stop" "1" "$([ -d "$PROJ_CACHE/$FID.lock" ] && echo 1 || echo 0)"
rm -f "$PROJ_CACHE/$FID.lock/owner"
rc=0; rt_hook_event "$PROJ" Read "$RT" A 2>"$PROJ/warnings" || rc=$?
assert_eq "unowned lock denies Read rather than deleting it" "2" "$rc"

# ── Test 23: Outside paths, real symlinks, and cache symlink writes ─────
printf '\nTest 23: Unsafe target/cache paths are refused\n'
PROJ="$TMPDIR/rt23"; mkdir -p "$PROJ"
OUTSIDE="$TMPDIR/outside.js"
printf '// simplify-ignore-start\noutside protected\n// simplify-ignore-end\n' > "$OUTSIDE"
cp "$OUTSIDE" "$TMPDIR/outside.original"
rt_hook_event "$PROJ" Read "$OUTSIDE" A
assert_eq "outside-root target left byte-identical" "0" "$(cmp -s "$OUTSIDE" "$TMPDIR/outside.original"; echo $?)"
RT="$PROJ/link.js"
if MSYS=winsymlinks:nativestrict ln -s "$OUTSIDE" "$RT" 2>/dev/null && [ -L "$RT" ]; then
  rt_hook_event "$PROJ" Read "$RT" A
  assert_eq "symlink target left byte-identical" "0" "$(cmp -s "$OUTSIDE" "$TMPDIR/outside.original"; echo $?)"
  rm -f "$RT"
  printf '// simplify-ignore-start\ninside protected\n// simplify-ignore-end\n' > "$RT"
  MSYS=winsymlinks:nativestrict ln -s "$RT" "$PROJ/inside-link.js"
  rt_hook_event "$PROJ" Read "$PROJ/inside-link.js" A
  assert_eq "in-root symlink is refused before canonicalization" "1" "$(grep -c 'inside protected' "$RT")"
  rm -f "$PROJ/inside-link.js"
  mkdir "$PROJ/real-cache"
  MSYS=winsymlinks:nativestrict ln -s "$PROJ/real-cache" "$PROJ/cache-link"
  for unsafe_cache in "$PROJ/cache-link" "$PROJ/cache-link/nested"; do
    rc=0
    jq -n --arg fp "$RT" '{hook_event_name:"PreToolUse",session_id:"A",tool_name:"Read",tool_input:{file_path:$fp}}' |
      CLAUDE_PROJECT_DIR="$PROJ" SIMPLIFY_IGNORE_CACHE_DIR="$unsafe_cache" bash hooks/simplify-ignore.sh 2>"$PROJ/warnings" || rc=$?
    assert_eq "symlinked cache or parent refuses writes" "2" "$rc"
  done
  rm -f "$PROJ/cache-link"
  rt_hook_event "$PROJ" Read "$RT" A
  PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
  BAK=$(find "$PROJ_CACHE" -name '*.bak' -type f | head -1)
  for suffix in path owner bak lock/owner; do
    metadata="${BAK%.bak}.$suffix"
    mv "$metadata" "$PROJ/held-metadata"
    MSYS=winsymlinks:nativestrict ln -s "$OUTSIDE" "$metadata"
    rc=0; rt_hook_event "$PROJ" Write "$RT" A PreToolUse 2>"$PROJ/warnings" || rc=$?
    assert_eq "cache $suffix symlink refused" "2" "$rc"
    assert_eq "cache $suffix does not write through symlink" "0" "$(cmp -s "$OUTSIDE" "$TMPDIR/outside.original"; echo $?)"
    rm -f "$metadata"
    mv "$PROJ/held-metadata" "$metadata"
  done
  rt_hook_event "$PROJ" '' '' A
else
  rm -f "$RT"
  printf '  SKIP: native symlinks unavailable on this filesystem\n'
fi

# ── Test 24: Partial placeholder loss retains the deleted block ────────
printf '\nTest 24: Partial rewrite retains recoverable protected content\n'
PROJ="$TMPDIR/rt24"; mkdir -p "$PROJ"
RT="$PROJ/partial.js"
printf 'editable\n// simplify-ignore-start\nfirst secret\n// simplify-ignore-end\n// simplify-ignore-start\nsecond secret\n// simplify-ignore-end\n' > "$RT"
cp "$RT" "$PROJ/original"
rt_hook_event "$PROJ" Read "$RT" A
# Remove only the first placeholder, retaining the second insertion point.
awk '/BLOCK_/ && !removed { removed=1; next } { print }' "$RT" > "$PROJ/rewritten"
cat "$PROJ/rewritten" > "$RT"
rt_hook_event "$PROJ" Edit "$RT" A 2>"$PROJ/warnings"
rt_hook_event "$PROJ" '' '' A 2>>"$PROJ/warnings"
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
RECOVERED=$(find "$PROJ_CACHE" -name '*.recovered.*' -type f | head -1)
assert_eq "partially removed block survives in original recovery" "0" "$(cmp -s "$RECOVERED" "$PROJ/original"; echo $?)"
assert_eq "remaining block is expanded into current file" "1" "$(grep -c 'second secret' "$RT")"

# ── Test 25: Replacement failure preserves the original recovery data ──
printf '\nTest 25: Failed atomic replacement retains backup and metadata\n'
PROJ="$TMPDIR/rt25"; mkdir -p "$PROJ/failing-bin"
RT="$PROJ/failure.js"
printf '// simplify-ignore-start\nprotected\n// simplify-ignore-end\n' > "$RT"
cp "$RT" "$PROJ/original"
printf '#!/bin/bash\nexit 1\n' > "$PROJ/failing-bin/mv"
chmod +x "$PROJ/failing-bin/mv"
rc=0
PATH="$PROJ/failing-bin:$PATH" rt_hook_event "$PROJ" Read "$RT" A 2>"$PROJ/warnings" || rc=$?
assert_eq "replacement failure is reported" "1" "$rc"
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
BAK=$(find "$PROJ_CACHE" -name '*.bak' -type f | head -1)
assert_eq "replacement failure preserves original target" "0" "$(cmp -s "$RT" "$PROJ/original"; echo $?)"
assert_eq "replacement failure preserves backup bytes" "0" "$(cmp -s "$BAK" "$PROJ/original"; echo $?)"
assert_eq "replacement failure retains recovery path" "1" "$([ -f "${BAK%.bak}.path" ] && echo 1 || echo 0)"

# ── Test 26: Exact SHA1/32-bit collision pair round-trips separately ────
printf '\nTest 26: Previously colliding protected blocks round-trip exactly\n'
PROJ="$TMPDIR/rt26"; mkdir -p "$PROJ"
RT="$PROJ/collision.js"
FIRST_BLOCK=$(printf '// simplify-ignore-start\nconst protected_2322 = 2322;\n// simplify-ignore-end')
SECOND_BLOCK=$(printf '// simplify-ignore-start\nconst protected_130093 = 130093;\n// simplify-ignore-end')
assert_eq "first block has reproduced old collision ID" "f71cdd6f" "$(printf '%s' "$FIRST_BLOCK" | hash_cmd | cut -c1-8)"
assert_eq "second block has reproduced old collision ID" "f71cdd6f" "$(printf '%s' "$SECOND_BLOCK" | hash_cmd | cut -c1-8)"
printf '%s\n%s' "$FIRST_BLOCK" "$SECOND_BLOCK" > "$RT"
cp "$RT" "$PROJ/original"
rt_hook_event "$PROJ" Read "$RT" A
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
assert_eq "distinct cached blocks survive the old collision pair" "2" "$(find "$PROJ_CACHE" -name '*.block.*' -type f | wc -l | tr -d ' ')"
assert_eq "placeholders use 128-bit content identifiers" "2" "$(grep -Ec 'BLOCK_[a-f0-9]{32}' "$RT")"
rt_hook_event "$PROJ" Edit "$RT" A
rt_hook_event "$PROJ" '' '' A
assert_eq "old collision pair restores byte-identically" "0" "$(cmp -s "$RT" "$PROJ/original"; echo $?)"

# Exercise the collision guard deterministically without replacing real jq or
# weakening the full-lifecycle content-hash regression above.
collision_rc=0
(
  CACHE="$PROJ/forced-cache"; mkdir -p "$CACHE"
  block_hash() { printf '%s' '00000000000000000000000000000000'; }
  filter_file "$PROJ/original" "$PROJ/forced-filtered" forced
) 2>"$PROJ/collision-warning" || collision_rc=$?
assert_eq "differing content with the same identifier is refused" "2" "$collision_rc"
assert_eq "collision refusal retains the first cached block" "$FIRST_BLOCK" "$(cat "$PROJ/forced-cache/forced.block.00000000000000000000000000000000")"
assert_eq "collision refusal diagnoses the conflict" "1" "$(grep -c 'identifier collision' "$PROJ/collision-warning")"

# ── Test 27: Identical blocks need occurrence-aware recovery ───────────
printf '\nTest 27: Removing one identical placeholder retains both original occurrences\n'
PROJ="$TMPDIR/rt27"; mkdir -p "$PROJ"
RT="$PROJ/duplicates.js"
BLOCK=$(printf '// simplify-ignore-start\nprotected();\n// simplify-ignore-end')
printf 'function a() {\n%s\n}\nfunction b() {\n%s\n}\n' "$BLOCK" "$BLOCK" > "$RT"
cp "$RT" "$PROJ/original"
rt_hook_event "$PROJ" Read "$RT" A
awk '/BLOCK_/ && !removed { removed=1; next } { print }' "$RT" > "$PROJ/rewritten"
cat "$PROJ/rewritten" > "$RT"
rt_hook_event "$PROJ" Edit "$RT" A 2>"$PROJ/warnings"
rt_hook_event "$PROJ" '' '' A 2>>"$PROJ/warnings"
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
RECOVERED=$(find "$PROJ_CACHE" -name '*.recovered.*' -type f | head -1)
if [ -n "$RECOVERED" ] && cmp -s "$RECOVERED" "$PROJ/original"; then
  assert_eq "identical-block deletion retains original placement and multiplicity" "0" "0"
else
  assert_eq "identical-block deletion retains original placement and multiplicity" "0" "1"
fi
assert_eq "surviving duplicate is expanded" "1" "$(grep -c 'protected();' "$RT")"

# ── Test 28: Unsupported NUL text must never be filtered ───────────────
printf '\nTest 28: NUL-containing source is refused without mutation\n'
for variant in outside inside; do
  PROJ="$TMPDIR/rt28-$variant"; mkdir -p "$PROJ"
  RT="$PROJ/binary.js"
  if [ "$variant" = outside ]; then
    printf 'prefix\0suffix\n// simplify-ignore-start\nprotected();\n// simplify-ignore-end\n' > "$RT"
  else
    printf '// simplify-ignore-start\nprefix\0suffix\n// simplify-ignore-end\n' > "$RT"
  fi
  cp "$RT" "$PROJ/original"
  rt_hook_event "$PROJ" Read "$RT" A
  rt_hook_event "$PROJ" '' '' A
  assert_eq "NUL $variant protected block remains byte-identical" "0" "$(cmp -s "$RT" "$PROJ/original"; echo $?)"
  assert_eq "NUL $variant creates no protection state" "0" "$([ -d "$PROJ/.claude/.simplify-ignore-cache" ] && echo 1 || echo 0)"
done

# ── Test 29: Trusted default temporary roots can have normal aliases ───
printf '\nTest 29: Default temporary-root alias resolves physically\n'
PROJ="$TMPDIR/rt29"; mkdir -p "$PROJ/physical-temp"
RT="$PROJ/default.js"
printf '// simplify-ignore-start\nprotected();\n// simplify-ignore-end\n' > "$RT"
cp "$RT" "$PROJ/original"
if ln -s "$PROJ/physical-temp" "$PROJ/temporary-alias" 2>/dev/null && [ -L "$PROJ/temporary-alias" ]; then
  jq -n --arg fp "$RT" '{hook_event_name:"PreToolUse",session_id:"A",tool_name:"Read",tool_input:{file_path:$fp}}' |
    CLAUDE_PROJECT_DIR="$PROJ" TMPDIR="$PROJ/temporary-alias" SIMPLIFY_IGNORE_CACHE_DIR='' bash hooks/simplify-ignore.sh
  assert_eq "aliased default temporary root permits protection" "1" "$(grep -c BLOCK_ "$RT")"
  printf '%s' '{"hook_event_name":"Stop","session_id":"A"}' |
    CLAUDE_PROJECT_DIR="$PROJ" TMPDIR="$PROJ/temporary-alias" SIMPLIFY_IGNORE_CACHE_DIR='' bash hooks/simplify-ignore.sh
  assert_eq "aliased default cache restores original bytes" "0" "$(cmp -s "$RT" "$PROJ/original"; echo $?)"
else
  printf '  SKIP: temporary-root alias test needs symlink support\n'
fi

# ── Test 30: NUL eligibility never bypasses foreign ownership ──────────
printf '\nTest 30: NUL-containing active protection still denies foreign tools\n'
PROJ="$TMPDIR/rt30"; mkdir -p "$PROJ"
RT="$PROJ/protected.js"
printf '// simplify-ignore-start\nprotected();\n// simplify-ignore-end\n' > "$RT"
cp "$RT" "$PROJ/original"
rt_hook_event "$PROJ" Read "$RT" A
PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
BAK=$(find "$PROJ_CACHE" -name '*.bak' -type f | head -1)
printf '\0unsupported text' >> "$RT"
cp "$RT" "$PROJ/current-with-nul"
for tool in Read Edit Write; do
  rc=0; rt_hook_event "$PROJ" "$tool" "$RT" B PreToolUse 2>"$PROJ/warnings" || rc=$?
  assert_eq "foreign $tool is denied despite NUL content" "2" "$rc"
done
rt_hook_event "$PROJ" Write "$RT" A 2>"$PROJ/warnings"
rt_hook_event "$PROJ" '' '' A 2>>"$PROJ/warnings"
assert_eq "owner Post/Stop leave unsupported current bytes untouched" "0" "$(cmp -s "$RT" "$PROJ/current-with-nul"; echo $?)"
assert_eq "owner Stop retains the expanded backup" "0" "$(cmp -s "$BAK" "$PROJ/original"; echo $?)"
LOCK=$(printf '%s' "$BAK" | sed 's/\.bak$/.lock\/owner/')
assert_eq "unsupported active file keeps its ownership lock" "A" "$(cat "$LOCK")"

# ── Test 31: Restored content is never another substitution input ──────
printf '\nTest 31: Literal cross-block tokens survive expansion\n'
PROJ="$TMPDIR/rt31"; mkdir -p "$PROJ"
CACHE="$PROJ/cache"; mkdir -p "$CACHE"
eval "$(sed -n '/^expand_file()/,/^}/p' hooks/simplify-ignore.sh)"
B=$(printf '// simplify-ignore-start\nsecretB();\n// simplify-ignore-end')
HB=$(block_hash "$B")
A=$(printf '// simplify-ignore-start\nconst token = "BLOCK_%s"; // nonce=0\n// simplify-ignore-end' "$HB")
HA=$(block_hash "$A")
assert_eq "the restored A token is tested before cached B" "1" "$([ "$HA" \< "$HB" ] && echo 1 || echo 0)"
printf '%s\n%s\n' "$A" "$B" > "$PROJ/original"
filter_file "$PROJ/original" "$PROJ/filtered" cascade
expand_file "$PROJ/filtered" "$PROJ/expanded" cascade
assert_eq "cross-block literal token roundtrip preserves original bytes" "0" "$(cmp -s "$PROJ/original" "$PROJ/expanded"; echo $?)"
tr '\n' ' ' < "$PROJ/filtered" > "$PROJ/same-line"
printf '\n' >> "$PROJ/same-line"
printf '%s %s \n' "$A" "$B" > "$PROJ/same-line-expected"
expand_file "$PROJ/same-line" "$PROJ/same-line-expanded" cascade
assert_eq "multiple original placeholders on one line cannot cascade into restored text" "0" "$(cmp -s "$PROJ/same-line-expected" "$PROJ/same-line-expanded"; echo $?)"

# ── Test 32: Refused token collisions cannot be expanded by Stop ───────
printf '\nTest 32: Reserved-token refusal is safe through later Stop\n'
for variant in read refilter active; do
  PROJ="$TMPDIR/rt32-$variant"; mkdir -p "$PROJ"
  RT="$PROJ/collision.js"
  B=$(printf '// simplify-ignore-start\nprotectedB();\n// simplify-ignore-end')
  HB=$(block_hash "$B")
  if [ "$variant" = read ]; then
    printf 'const literal = "BLOCK_%s";\n%s\n' "$HB" "$B" > "$RT"
    cp "$RT" "$PROJ/expected"
    rc=0; rt_hook_event "$PROJ" Read "$RT" A 2>"$PROJ/warnings" || rc=$?
  else
    A=$(printf '// simplify-ignore-start\nprotectedA();\n// simplify-ignore-end')
    printf '%s\n' "$A" > "$RT"
    rt_hook_event "$PROJ" Read "$RT" A
    if [ "$variant" = refilter ]; then
      printf 'const literal = "BLOCK_%s";\n%s\n' "$HB" "$B" >> "$RT"
      printf '%s\nconst literal = "BLOCK_%s";\n%s\n' "$A" "$HB" "$B" > "$PROJ/expected"
    else
      HA=$(block_hash "$A")
      printf 'const literal = "BLOCK_%s";\n' "$HA" >> "$RT"
      cp "$RT" "$PROJ/expected"
    fi
    rc=0; rt_hook_event "$PROJ" Edit "$RT" A 2>"$PROJ/warnings" || rc=$?
  fi
  assert_eq "$variant collision is refused" "2" "$rc"
  assert_eq "$variant refusal leaves current bytes intact" "0" "$(cmp -s "$RT" "$PROJ/expected"; echo $?)"
  rt_hook_event "$PROJ" '' '' A 2>>"$PROJ/warnings"
  assert_eq "$variant refusal then Stop preserves current bytes" "0" "$(cmp -s "$RT" "$PROJ/expected"; echo $?)"
  PROJ_CACHE="$PROJ/.claude/.simplify-ignore-cache"
  if [ "$variant" = active ]; then
    assert_eq "active ambiguity retains its expanded backup" "1" "$(find "$PROJ_CACHE" -name '*.bak' -type f | wc -l | tr -d ' ')"
  else
    RECOVERED=$(find "$PROJ_CACHE" -name '*.recovered.*' -type f | head -1)
    assert_eq "$variant refusal retains byte-identical recovery" "0" "$(cmp -s "$RECOVERED" "$PROJ/expected"; echo $?)"
  fi
done

else
  printf '\nTests 14-32 skipped: jq not available (hook exits at its jq guard)\n'
fi

# ── Summary ──────────────────────────────────────────────────────────────
printf '\n══════════════════════════════════════════\n'
printf 'Results: %d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
