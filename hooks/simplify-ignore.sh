#!/bin/bash
# simplify-ignore.sh — Read|Edit|Write (PreToolUse), Edit|Write (PostToolUse), Stop
#
# PreToolUse Read   → backs up file, replaces blocks with BLOCK_<hash> in-place
# PostToolUse Edit  → expands placeholders, re-filters so file stays hidden
# PostToolUse Write → expands placeholders, re-filters so file stays hidden
# Stop              → expands the placeholders still in the file on disk, so a
#                     change made by any route survives; missing placeholders
#                     leave a separate recovery copy of the protected backup
#
# Normal Read/Edit flow keeps placeholders on disk while protection is active.
# Wholesale rewrites stay in place with the protected backup retained.
# The real content is that file with its placeholders expanded; the backup
# holds the last state the hook itself saw.
#
# Dependencies: jq, Perl, shasum (or sha1sum plus sha256sum)

set -euo pipefail

# Bash 5.2+ turns on patsub_replacement by default, which makes `&` and
# backslash special on the replacement side of ${var//pattern/replacement}:
# `&` expands to the matched text and `\\` collapses. expand_file substitutes
# raw block content there, and code routinely contains `&&` and backslashes,
# so the option must be off or protected blocks come back corrupted on Linux.
# Older bashes do not know the option; ignore the error there.
shopt -u patsub_replacement 2>/dev/null || true

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "error: missing jq" >&2; exit 1
fi

# Restrict mutations to this project, using physical paths and private state.
command -v perl >/dev/null 2>&1 || exit 0
PROJECT_PATH="${CLAUDE_PROJECT_DIR:-$PWD}"
if command -v cygpath >/dev/null 2>&1; then PROJECT_PATH=$(cygpath -u -- "$PROJECT_PATH"); fi
PROJECT_ROOT=$(cd -P -- "$PROJECT_PATH" && pwd) || exit 0
if [ -n "${SIMPLIFY_IGNORE_CACHE_DIR:-}" ]; then
  CACHE="$SIMPLIFY_IGNORE_CACHE_DIR"
else
  # The OS's trusted temporary root can have a normal alias (/var on macOS).
  # Resolve only this default root; explicit cache overrides still reject links.
  DEFAULT_TEMP_ROOT="${TMPDIR:-/tmp}"
  if command -v cygpath >/dev/null 2>&1; then DEFAULT_TEMP_ROOT=$(cygpath -u -- "$DEFAULT_TEMP_ROOT"); fi
  DEFAULT_TEMP_ROOT=$(cd -P -- "$DEFAULT_TEMP_ROOT" && pwd) || exit 0
  CACHE="$DEFAULT_TEMP_ROOT/raiinman-simplify-ignore-$(id -u)"
fi
umask 077
if [ -t 0 ]; then INPUT="{}"; else INPUT=$(cat); fi

# Parse hook input — trap errors explicitly so set -e doesn't cause
# a silent exit on malformed JSON, and surface a useful diagnostic.
parse_error=""
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r 'if (.tool_name | type) == "string" then .tool_name else empty end' 2>/dev/null) || {
  parse_error="failed to parse .tool_name from hook input"
  TOOL_NAME=""
}
FILE_PATH=$(printf '%s' "$INPUT" | jq -r 'if (.tool_input.file_path | type) == "string" then .tool_input.file_path | select(explode | all(. >= 32 and . != 127)) else empty end' 2>/dev/null) || {
  parse_error="failed to parse .tool_input.file_path from hook input"
  FILE_PATH=""
}
if [ -n "$parse_error" ]; then
  printf 'Warning: %s (input: %.120s)\n' "$parse_error" "$INPUT" >&2
  exit 0
fi
HOOK_EVENT=$(printf '%s' "$INPUT" | jq -r 'if (.hook_event_name | type) == "string" then .hook_event_name else empty end' 2>/dev/null) || exit 0
SESSION_ID=$(printf '%s' "$INPUT" | jq -r 'if (.session_id | type) == "string" then .session_id | select(length > 0 and length <= 256 and (explode | all(. >= 32 and . != 127))) else empty end' 2>/dev/null) || exit 0
[ -n "$SESSION_ID" ] || exit 0
case "$HOOK_EVENT:$TOOL_NAME" in
  Stop:*) TOOL_NAME="" ;;
  PreToolUse:Read|PreToolUse:Edit|PreToolUse:Write|PostToolUse:Edit|PostToolUse:Write) ;;
  *) exit 0 ;;
esac

hash_cmd() {
  if command -v shasum >/dev/null 2>&1; then shasum
  elif command -v sha1sum >/dev/null 2>&1; then sha1sum
  else printf '%s\n' "error: missing shasum or sha1sum" >&2; exit 1; fi
}
file_id() { printf '%s' "$1" | hash_cmd | cut -c1-16; }
if [ -z "${SIMPLIFY_IGNORE_CACHE_DIR:-}" ]; then
  project_identity=$(perl -e '@s=stat($ARGV[0]); die "missing project identity" unless @s; print "$s[0]:$s[1]"' -- "$PROJECT_ROOT")
  CACHE="${CACHE}-$(file_id "$project_identity")"
fi
if command -v cygpath >/dev/null 2>&1; then CACHE=$(cygpath -u -- "$CACHE"); fi
case "$CACHE" in /*) ;; *) CACHE="$PROJECT_ROOT/$CACHE" ;; esac
# Check every existing component before canonicalization: resolving first would
# disguise a symlinked parent as an ordinary project/cache path.
no_symlink_components() {
  local cursor="$1" parent
  case "$cursor" in /*) ;; *) return 1 ;; esac
  while :; do
    [ ! -L "$cursor" ] || return 1
    parent="${cursor%/*}"
    [ -n "$parent" ] || parent=/
    [ "$parent" != "$cursor" ] || break
    cursor="$parent"
  done
}
cache_guard() {
  local cache_uid
  no_symlink_components "$CACHE" || return 1
  [ ! -e "$CACHE" ] || [ -d "$CACHE" ] || return 1
  if [ -d "$CACHE" ]; then
    cache_uid=$(perl -e '@s=stat($ARGV[0]); exit 1 if !$s[2] || ($s[2] & 0022); print $s[4]' -- "$CACHE") || return 1
    [ "$cache_uid" = "$(id -u)" ] || return 1
    [ -z "$(find "$CACHE" -mindepth 1 ! -type d ! -type f -print -quit)" ] || return 1
    [ -z "$(find "$CACHE" -type f -links +1 -print -quit)" ] || return 1
  fi
}
cache_guard || { printf 'Protection cache is unsafe; automatic writes refused.\n' >&2; exit 2; }
if [ -d "$CACHE" ]; then chmod 700 "$CACHE"; fi
block_hash() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | cut -c1-32
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | cut -c1-32
  else
    printf '%s\n' 'error: missing shasum or sha256sum for block identifiers' >&2
    return 1
  fi
}

# Never overwrite another block merely because its content ID matches.
cache_block_content() {
  local fid="$1" h="$2" content="$3" existing target
  target="$CACHE/${fid}.block.${h}"
  cache_guard || return 2
  if [ -e "$target" ]; then
    existing=$(cat "$target"; printf x); existing="${existing%x}"
    if [ "$existing" != "$content" ]; then
      printf 'Warning: block identifier collision for BLOCK_%s; protection refused and existing block retained.\n' "$h" >&2
      return 2
    fi
  fi
  printf '%s' "$content" > "$target" || return 2
}
# Escape glob metacharacters so ${var/pattern/repl} treats pattern as literal.
# Needed for Bash 3.2 (macOS) where quotes don't suppress globbing in PE patterns.
escape_glob() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\*/\\*}"
  s="${s//\?/\\?}"
  s="${s//\[/\\[}"
  printf '%s' "$s"
}

# Canonical target must be a regular non-symlink file inside the project.
safe_target() {
  local target="$1" resolved parent next
  no_symlink_components "$target" || return 1
  [ -f "$target" ] && [ ! -L "$target" ] || return 1
  resolved=$(perl -MCwd=abs_path -e 'print abs_path($ARGV[0]) // ""' -- "$target") || return 1
  [ "$resolved" = "$target" ] || return 1
  parent="${resolved%/*}"
  while [ -n "$parent" ]; do
    [ "$parent" -ef "$PROJECT_ROOT" ] && return 0
    next="${parent%/*}"
    [ -n "$next" ] || next=/
    [ "$next" != "$parent" ] || break
    parent="$next"
  done
  return 1
}

# Content eligibility is separate from path/ownership validation.
text_target() {
  perl -e 'open(my $f, "<", $ARGV[0]) or exit 1; binmode $f;
    while (1) { my $n = read($f, my $b, 65536); exit 1 unless defined $n;
      last unless $n; exit 1 if index($b, "\0") >= 0; }' -- "$1"
}

atomic_replace() {
  local source="$1" target="$2" temporary
  cache_guard || return 1
  safe_target "$target" || return 1
  text_target "$target" && text_target "$source" || return 1
  temporary=$(mktemp "${target}.simplify-XXXXXX") || return 1
  if cp -p "$target" "$temporary" && cat "$source" > "$temporary" && safe_target "$target" && text_target "$target"; then
    mv -f "$temporary" "$target"
  else
    rm -f "$temporary"
    return 1
  fi
}

release_lock() {
  local fid="$1"
  cache_guard || return 1
  [ -f "$CACHE/${fid}.lock/owner" ] && [ "$(cat "$CACHE/${fid}.lock/owner")" = "$SESSION_ID" ] || return 1
  rm -f "$CACHE/${fid}.lock/owner"
  rmdir "$CACHE/${fid}.lock" 2>/dev/null || true
}

# A unique recovery never replaces a user's file or an earlier recovery.
recover_backup() {
  local backup="$1" fid="$2" recovery
  cache_guard || return 1
  recovery=$(mktemp "$CACHE/${fid}.recovered.XXXXXX") || return 1
  cp -p "$backup" "$recovery" || return 1
  printf 'Warning: current file preserved; protected backup retained at %s\n' "$recovery" >&2
}

# ── filter_file: replace simplify-ignore blocks with BLOCK_<hash> placeholders ─
# Reads $1 (source), writes filtered version to $2 (dest), saves blocks to cache.
# Returns 0 if blocks were found, 1 if none.
filter_file() {
  local src="$1" dest="$2" fid="$3"
  cache_guard || return 2
  : > "$dest" || return 2
  rm -f "$CACHE/${fid}".block.* "$CACHE/${fid}".reason.* "$CACHE/${fid}".prefix.* "$CACHE/${fid}".suffix.* || return 2

  local count=0 in_block=0 buf="" reason="" prefix="" suffix="" ids=""

  while IFS= read -r line || [ -n "$line" ]; do
    # Check for start marker (no fork — uses bash case)
    if [ $in_block -eq 0 ]; then
      case "$line" in *simplify-ignore-start*)
        in_block=1
        buf="$line"
        # Extract comment prefix/suffix to preserve language-appropriate syntax
        prefix="${line%%simplify-ignore-start*}"
        suffix=""
        case "$line" in *'*/'*) suffix=" */" ;; *'-->'*) suffix=" -->" ;; esac
        reason=$(printf '%s' "$line" | sed -n 's/.*simplify-ignore-start:[[:space:]]*//p' \
          | sed 's/[[:space:]]*\*\/.*$//' | sed 's/[[:space:]]*-->.*$//' | sed 's/[[:space:]]*$//')
        # Handle single-line block (start + end on same line)
        case "$line" in *simplify-ignore-end*)
          in_block=0
          # Write single-line block immediately and skip to next line
          # to avoid the end-marker check below firing again
          local h; h=$(block_hash "$buf") || return 2
          count=$((count + 1))
          ids="$ids$h "
          cache_block_content "$fid" "$h" "$buf" || return 2
          if [ -n "$reason" ]; then printf '%s' "$reason" > "$CACHE/${fid}.reason.${h}" || return 2; fi
          printf '%s' "$prefix" > "$CACHE/${fid}.prefix.${h}" || return 2
          printf '%s' "$suffix" > "$CACHE/${fid}.suffix.${h}" || return 2
          if [ -n "$reason" ]; then
            printf '%s\n' "${prefix}BLOCK_${h}: ${reason}${suffix}" >> "$dest" || return 2
          else
            printf '%s\n' "${prefix}BLOCK_${h}${suffix}" >> "$dest" || return 2
          fi
          buf=""; reason=""; prefix=""; suffix=""
          continue
          ;; *)
          continue
          ;;
        esac
      ;; esac
    fi
    # Accumulate block content
    if [ $in_block -eq 1 ]; then
      buf="${buf}
${line}"
    fi
    # Check for end marker
    case "$line" in *simplify-ignore-end*)
      if [ $in_block -eq 1 ]; then
        local h; h=$(block_hash "$buf") || return 2
        count=$((count + 1))
        ids="$ids$h "
        cache_block_content "$fid" "$h" "$buf" || return 2
        if [ -n "$reason" ]; then printf '%s' "$reason" > "$CACHE/${fid}.reason.${h}" || return 2; fi
        printf '%s' "$prefix" > "$CACHE/${fid}.prefix.${h}" || return 2
        printf '%s' "$suffix" > "$CACHE/${fid}.suffix.${h}" || return 2
        if [ -n "$reason" ]; then
          printf '%s\n' "${prefix}BLOCK_${h}: ${reason}${suffix}" >> "$dest" || return 2
        else
          printf '%s\n' "${prefix}BLOCK_${h}${suffix}" >> "$dest" || return 2
        fi
        in_block=0; buf=""; reason=""; prefix=""; suffix=""
        continue
      fi
      ;;
    esac
    if [ $in_block -eq 0 ]; then printf '%s\n' "$line" >> "$dest" || return 2; fi
  done < "$src"

  # Unclosed block → flush as-is
  if [ $in_block -eq 1 ] && [ -n "$buf" ]; then
    printf 'Warning: unclosed simplify-ignore-start in %s (block not hidden)\n' "$src" >&2
    printf '%s\n' "$buf" >> "$dest" || return 2
  fi

  # Preserve trailing newline status of source
  if [ -s "$dest" ] && [ -s "$src" ] && [ -n "$(tail -c 1 "$src")" ]; then
    perl -pe 'chomp if eof' "$dest" > "${dest}.nnl" && \
      cat "${dest}.nnl" > "$dest" && rm -f "${dest}.nnl" || return 2
  fi

  if [ "$count" -gt 0 ] && ! printf '%s' "$ids" | perl -e '
    local $/; my $ids = <STDIN> // "";
    open(my $f, "<", $ARGV[0]) or die "cannot inspect filtered protection state";
    binmode $f; my $content = <$f> // ""; my %expected;
    $expected{$_}++ for grep { length } split /\s+/, $ids;
    for my $h (keys %expected) {
      my $actual = () = $content =~ /BLOCK_\Q$h\E/g;
      exit 1 if $actual != $expected{$h};
    }
  ' -- "$dest"; then
    # Refuse ambiguous tokens transactionally: the target is still the expanded
    # input. Clearing candidate rules ensures a later Stop cannot expand its
    # literal tokens; the existing backup/ownership state remains recoverable.
    rm -f "$CACHE/${fid}".block.* "$CACHE/${fid}".reason.* "$CACHE/${fid}".prefix.* "$CACHE/${fid}".suffix.* || return 2
    printf 'Warning: reserved BLOCK_ token collides with an unprotected source literal; filtering refused and backup retained.\n' >&2
    return 2
  fi
  [ $count -gt 0 ] && return 0 || return 1
}

# ── expand_file: replace BLOCK_<hash> placeholders with the real block code ───
# Reads $1 (source), writes the expanded version to $2 (dest), using the blocks
# cached under $3 (file id). Warns on placeholders that were altered or deleted.
expand_file() {
  local src="$1" dest="$2" fid="$3"
  cache_guard || return 1
  # Match only original input spans in a single substitution pass. Restored
  # content is never scanned again, including multiple placeholders per line.
  perl -e '
    sub bytes { open(my $f, "<", $_[0]) or die "cannot read protection state";
      binmode $f; local $/; return <$f> // ""; }
    my ($src, $dest, $cache, $fid) = splice @ARGV, 0, 4;
    my %rules;
    for my $bf (@ARGV) {
      next unless -f $bf;
      my ($h) = $bf =~ /\.block\.([0-9a-f]+)\z/;
      next unless defined $h;
      my $block = bytes($bf);
      my $prefix = -f "$cache/$fid.prefix.$h" ? bytes("$cache/$fid.prefix.$h") : "";
      my $suffix = -f "$cache/$fid.suffix.$h" ? bytes("$cache/$fid.suffix.$h") : "";
      my $reason = -f "$cache/$fid.reason.$h" ? bytes("$cache/$fid.reason.$h") : "";
      my $token = "BLOCK_$h";
      my $exact = $prefix . $token . (length($reason) ? ": $reason" : "") . $suffix;
      for my $rule ([$exact, 0], [$prefix . $token . $suffix, 1], [$token, 1]) {
        $rules{$rule->[0]} //= [$block, $h, $rule->[1]];
      }
    }
    my $content = bytes($src);
    if (%rules) {
      my $pattern = join "|", map { quotemeta($_) }
        sort { length($b) <=> length($a) || $a cmp $b } keys %rules;
      $content =~ s/($pattern)/do {
        my $rule = $rules{$1};
        warn "Warning: placeholder BLOCK_" . $rule->[1] . " was modified by model, using fuzzy match\n" if $rule->[2];
        $rule->[0];
      }/ge;
    }
    open(my $out, ">", $dest) or die "cannot write expanded protection state";
    binmode $out;
    print {$out} $content or die "cannot write expanded protection state";
    close($out) or die "cannot close expanded protection state";
  ' -- "$src" "$dest" "$CACHE" "$fid" "$CACHE/$fid".block.* || return 1
  return 0
}

# ── has_placeholders: is a cached BLOCK_<hash> for $2 still present in file $1? ─
has_placeholders() {
  local f="$1" fid="$2" bf h
  for bf in "$CACHE/${fid}".block.*; do
    [ -f "$bf" ] || continue
    h="${bf##*.}"
    grep -qF "BLOCK_${h}" "$f" 2>/dev/null && return 0
  done
  return 1
}

# If even one cached placeholder disappeared, preserve the previous full
# backup before refreshing/deleting state. A surviving token is insufficient.
missing_placeholders() {
  local f="$1" fid="$2" bf h
  for bf in "$CACHE/${fid}".block.*; do
    [ -f "$bf" ] || continue
    h="${bf##*.}"
    # Identical blocks intentionally share an ID, so a surviving token alone
    # cannot prove that every original insertion point remains. Compare the
    # token multiplicity with exact block occurrences in the expanded backup.
    if ! perl -e '
      sub bytes { open(my $f, "<", $_[0]) or die "cannot read protection state";
        binmode $f; local $/; return <$f> // ""; }
      my ($backup, $block, $current) = map { bytes($_) } @ARGV[0..2];
      die "empty protection state" unless length $block;
      my $expected = () = $backup =~ /\Q$block\E/g;
      my $actual = () = $current =~ /BLOCK_\Q$ARGV[3]\E/g;
      exit($expected > 0 && $actual >= $expected ? 0 : 1);
    ' -- "$CACHE/${fid}.bak" "$bf" "$f" "$h"; then return 0; fi
  done
  return 1
}

# More matching tokens than original blocks make expansion ambiguous: a new
# literal must not be mistaken for an insertion point or change protected code.
ambiguous_placeholders() {
  local f="$1" fid="$2" bf h
  for bf in "$CACHE/${fid}".block.*; do
    [ -f "$bf" ] || continue
    h="${bf##*.}"
    if perl -e '
      sub bytes { open(my $f, "<", $_[0]) or die "cannot read protection state";
        binmode $f; local $/; return <$f> // ""; }
      my ($backup, $block, $current) = map { bytes($_) } @ARGV[0..2];
      my $expected = () = $backup =~ /\Q$block\E/g;
      my $actual = () = $current =~ /BLOCK_\Q$ARGV[3]\E/g;
      exit($actual > $expected ? 0 : 1);
    ' -- "$CACHE/${fid}.bak" "$bf" "$f" "$h"; then return 0; fi
  done
  return 1
}

# ── Stop: expand owned files, retain backups for missing placeholders ───────
if [ "$HOOK_EVENT" = "Stop" ]; then
  [ -d "$CACHE" ] || exit 0
  for bak in "$CACHE"/*.bak; do
    [ -f "$bak" ] || continue
    fid="${bak##*/}"; fid="${fid%.bak}"
    [ -f "$CACHE/${fid}.owner" ] && [ "$(cat "$CACHE/${fid}.owner")" = "$SESSION_ID" ] || continue
    if [ -d "$CACHE/${fid}.lock" ] && {
      [ ! -f "$CACHE/${fid}.lock/owner" ] || [ "$(cat "$CACHE/${fid}.lock/owner")" != "$SESSION_ID" ];
    }; then
      printf 'Warning: protection lock ownership mismatch; backup retained at %s\n' "$bak" >&2
      continue
    fi
    pathfile="$CACHE/${fid}.path"
    [ -f "$pathfile" ] || { printf 'Warning: missing protection path; backup retained at %s\n' "$bak" >&2; continue; }
    orig=$(cat "$pathfile")
    [ "$(file_id "$orig")" = "$fid" ] || {
      printf 'Warning: protection path does not match its cache identity; backup retained at %s\n' "$bak" >&2; continue;
    }
    if safe_target "$orig"; then
      if ! text_target "$orig"; then
        printf 'Warning: unsupported NUL-containing or unreadable file; protection state and backup retained for %s\n' "$orig" >&2
        continue
      fi
      if ambiguous_placeholders "$orig" "$fid"; then
        printf 'Warning: ambiguous reserved BLOCK_ tokens; current file and protection state retained for %s\n' "$orig" >&2
        continue
      fi
      # A change can reach the file through a route that fires no Edit or Write
      # event (a Bash command, a formatter, an external editor), and the backup
      # is stale for all of them. Expand what is on disk rather than overwrite it.
      if has_placeholders "$orig" "$fid"; then
        if missing_placeholders "$orig" "$fid"; then recover_backup "$bak" "$fid"; fi
        EXPANDED="$CACHE/${fid}.$$.expanded"
        expand_file "$orig" "$EXPANDED" "$fid"
        atomic_replace "$EXPANDED" "$orig"
        rm -f "$EXPANDED"
      else
        # A wholesale rewrite is current user work. Preserve it in place and
        # retain the protected backup separately for explicit reconciliation.
        recover_backup "$bak" "$fid"
        printf 'Warning: no BLOCK_ placeholder remains in %s; rewrite left in place.\n' "$orig" >&2
      fi
      cache_guard || exit 2
      rm -f "$bak" "$pathfile" "$CACHE/${fid}.owner" "$CACHE/${fid}".block.* "$CACHE/${fid}".reason.* "$CACHE/${fid}".prefix.* "$CACHE/${fid}".suffix.*
      release_lock "$fid"
    else
      # File was moved/deleted — save backup as .recovered, don't destroy it
      recover_backup "$bak" "$fid"
      cache_guard || exit 2
      rm -f "$bak"
      rm -f "$pathfile" "$CACHE/${fid}.owner" "$CACHE/${fid}".block.* "$CACHE/${fid}".reason.* "$CACHE/${fid}".prefix.* "$CACHE/${fid}".suffix.*
      release_lock "$fid"
      printf 'Warning: %s was moved/deleted or unsafe; target left untouched.\n' "$orig" >&2
    fi
  done
  exit 0
fi

[ -z "$FILE_PATH" ] && exit 0
if command -v cygpath >/dev/null 2>&1; then FILE_PATH=$(cygpath -u -- "$FILE_PATH"); fi
case "$FILE_PATH" in /*) ;; *) FILE_PATH="$PROJECT_ROOT/$FILE_PATH" ;; esac
no_symlink_components "$FILE_PATH" || exit 0
FILE_PATH=$(perl -MCwd=abs_path -e 'print abs_path($ARGV[0]) // ""' -- "$FILE_PATH") || exit 0
safe_target "$FILE_PATH" || exit 0
# Physical identity recognizes case/short-name aliases on Windows without
# lowercasing paths (which would select the wrong file in case-sensitive dirs).
for cached_path in "$CACHE"/*.path; do
  [ -f "$cached_path" ] || continue
  cached_orig=$(cat "$cached_path")
  if [ "$FILE_PATH" -ef "$cached_orig" ]; then
    safe_target "$cached_orig" || { printf 'Protection path is unsafe; backup retained.\n' >&2; exit 2; }
    FILE_PATH="$cached_orig"
    break
  fi
done
ID=$(file_id "$FILE_PATH")
if { [ -f "$CACHE/${ID}.owner" ] && [ "$(cat "$CACHE/${ID}.owner")" != "$SESSION_ID" ]; } ||
   { [ -e "$CACHE/${ID}.bak" ] && [ ! -f "$CACHE/${ID}.owner" ]; } ||
   { [ -d "$CACHE/${ID}.lock" ] && { [ ! -f "$CACHE/${ID}.lock/owner" ] || [ "$(cat "$CACHE/${ID}.lock/owner")" != "$SESSION_ID" ]; }; }; then
  printf 'Protected file has foreign or incomplete ownership; leave it untouched and inspect recovery state.\n' >&2
  exit 2
fi
if [ -f "$CACHE/${ID}.bak" ]; then
  [ -f "$CACHE/${ID}.path" ] && [ "$(cat "$CACHE/${ID}.path")" = "$FILE_PATH" ] || {
    printf 'Protection metadata mismatch; backup retained for manual recovery.\n' >&2; exit 2;
  }
fi
if [ "$HOOK_EVENT" = "PreToolUse" ] && [ "$TOOL_NAME" != "Read" ]; then exit 0; fi

# ── PreToolUse Read: filter in-place ──────────────────────────────────────────
if [ "$TOOL_NAME" = "Read" ]; then
  [ -f "$FILE_PATH" ] || exit 0
  case "$(basename "$FILE_PATH")" in simplify-ignore*|SIMPLIFY-IGNORE*) exit 0 ;; esac
  text_target "$FILE_PATH" || exit 0

  mkdir -p "$CACHE"
  cache_guard || exit 2
  chmod 700 "$CACHE"
  ID=$(file_id "$FILE_PATH")

  # If backup exists, file is already filtered — skip
  if [ -f "$CACHE/${ID}.bak" ]; then
    [ -f "$CACHE/${ID}.owner" ] || { printf 'Legacy protection state requires manual recovery before reuse.\n' >&2; exit 2; }
    [ "$(cat "$CACHE/${ID}.path")" = "$FILE_PATH" ] || exit 2
    exit 0
  fi

  grep -q 'simplify-ignore-start' -- "$FILE_PATH" || exit 0

  # Atomic lock: never steal an unknown/foreign lock based on its age.
  if ! mkdir "$CACHE/${ID}.lock" 2>/dev/null; then
    printf 'Protection lock already exists; explicit recovery required.\n' >&2
    exit 2
  fi

  cache_guard || exit 2
  printf '%s' "$SESSION_ID" > "$CACHE/${ID}.owner"
  printf '%s' "$SESSION_ID" > "$CACHE/${ID}.lock/owner"

  # Back up the original (preserve trailing newline status)
  cp -p "$FILE_PATH" "$CACHE/${ID}.bak" 2>/dev/null || cp "$FILE_PATH" "$CACHE/${ID}.bak"
  printf '%s' "$FILE_PATH" > "$CACHE/${ID}.path"

  # Atomic replacement preserves file mode; the inode can change.
  FILTERED="$CACHE/${ID}.$$.tmp"
  rm -f "$FILTERED"
  if filter_file "$FILE_PATH" "$FILTERED" "$ID"; then
    atomic_replace "$FILTERED" "$FILE_PATH"
    rm -f "$FILTERED"
  else
    filter_status=$?
    [ "$filter_status" -eq 1 ] || exit "$filter_status"
    cache_guard || exit 2
    rm -f "$FILTERED" "$CACHE/${ID}.bak" "$CACHE/${ID}.path" "$CACHE/${ID}.owner"
    release_lock "$ID"
  fi
  exit 0
fi

# ── PostToolUse Edit|Write: expand, then re-filter ────────────────────────────
if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
  ID=$(file_id "$FILE_PATH")
  [ -f "$CACHE/${ID}.bak" ] || exit 0
  [ -f "$CACHE/${ID}.owner" ] && [ "$(cat "$CACHE/${ID}.owner")" = "$SESSION_ID" ] || exit 0
  ls "$CACHE/${ID}".block.* >/dev/null 2>&1 || exit 0
  if ! text_target "$FILE_PATH"; then
    printf 'Warning: unsupported NUL-containing or unreadable file; protection state and backup retained.\n' >&2
    exit 0
  fi
  if ambiguous_placeholders "$FILE_PATH" "$ID"; then
    printf 'Warning: ambiguous reserved BLOCK_ tokens; current file and protection state retained.\n' >&2
    exit 2
  fi

  # A rewrite has no insertion points. Do not refresh the only protected
  # backup from that rewrite; Stop will retain it as a unique recovery copy.
  if ! has_placeholders "$FILE_PATH" "$ID"; then
    printf 'Warning: no BLOCK_ placeholder remains; current rewrite and protected backup retained.\n' >&2
    exit 0
  fi
  if missing_placeholders "$FILE_PATH" "$ID"; then recover_backup "$CACHE/${ID}.bak" "$ID"; fi

  # Expand placeholders, preserving any inline code the model added around them
  EXPANDED="$CACHE/${ID}.$$.expanded"
  expand_file "$FILE_PATH" "$EXPANDED" "$ID"
  # Preserve file mode while replacing atomically.
  atomic_replace "$EXPANDED" "$FILE_PATH"
  rm -f "$EXPANDED"

  # Save expanded version as new backup (this is the "real" file with model's changes)
  cache_guard || exit 2
  cp "$FILE_PATH" "$CACHE/${ID}.bak"

  # Re-filter in-place so the file on disk stays with placeholders
  FILTERED="$CACHE/${ID}.$$.tmp"
  rm -f "$FILTERED"
  if filter_file "$FILE_PATH" "$FILTERED" "$ID"; then
    atomic_replace "$FILTERED" "$FILE_PATH"
    rm -f "$FILTERED"
  else
    filter_status=$?
    [ "$filter_status" -eq 1 ] || exit "$filter_status"
    rm -f "$FILTERED"
  fi

  exit 0
fi
