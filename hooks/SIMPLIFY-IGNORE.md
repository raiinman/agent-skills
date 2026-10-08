# simplify-ignore hook

Block-level protection for `/code-simplify`. The hook hides annotated blocks from supported Read events and restores them around supported edits. It mutates files on disk while protection is active, so avoid builds, formatters, and other readers during that interval.

## Setup

1. Annotate blocks you want to protect:

```js
/* simplify-ignore-start: perf-critical */
// manually unrolled XOR — 3x faster than a loop
result[0] = buf[0] ^ key[0];
result[1] = buf[1] ^ key[1];
result[2] = buf[2] ^ key[2];
result[3] = buf[3] ^ key[3];
/* simplify-ignore-end */
```

2. Add hooks to `.claude/settings.json`, replacing `/absolute/path/to/agent-skills` with the installed package directory. The helpers live in that package, which can be separate from the project you are editing:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write",
        "hooks": [{ "type": "command", "command": "bash \"/absolute/path/to/agent-skills/hooks/simplify-ignore.sh\"" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "bash \"/absolute/path/to/agent-skills/hooks/simplify-ignore.sh\"" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "bash \"/absolute/path/to/agent-skills/hooks/simplify-ignore.sh\"" }]
      }
    ]
  }
}
```

3. Run `/code-simplify` — protected blocks become `/* BLOCK_<32-hex-content-id>: perf-critical */` placeholders. The model reasons about surrounding code without seeing the protected implementation.

The host must supply native JSON fields `hook_event_name` and `session_id`, plus `tool_name` and `tool_input.file_path` for tool events. Missing identity or unsupported events are graceful no-ops; malformed JSON also emits a warning. An empty `{}` is not a recovery request. Register the `PreToolUse` matcher for all three tools: this is where another session's Read, Edit, or Write is denied before it executes. PostToolUse alone cannot prevent a foreign write.

By default, backups live outside the repository under the physical location of `${TMPDIR:-/tmp}` in `raiinman-simplify-ignore-<user-id>-<project-identity-hash>/`. Resolving the trusted default temporary root supports ordinary aliases such as macOS `/var` → `/private/var`; explicit cache overrides still refuse symlink components. The project hash uses the directory's filesystem identity, so case-only project aliases share state. The cache is private and project-scoped. `SIMPLIFY_IGNORE_CACHE_DIR` can select a stable private cache, including for tests. Every session accessing the same checkout must use the same cache location. If you explicitly put it inside the repository, gitignore that directory. Do not remove the cache while files remain filtered; temporary-directory cleanup can remove recovery data.

## How it works

One script, three hook events:

| Event | Action |
|---|---|
| `PreToolUse Read` | Backs up file, replaces blocks with `BLOCK_<hash>` placeholders in-place |
| `PreToolUse Edit\|Write` | Checks ownership and denies access to a file protected by another session |
| `PostToolUse Edit\|Write` | Expands placeholders back to real code, saves model's changes, re-filters |
| `Stop` | Expands the owning session's remaining placeholders; preserves wholesale rewrites in place and saves missing protected content in a unique recovery file |

Each block uses a 128-bit content identifier (32 hex characters from SHA-256 via `shasum -a 256` or `sha256sum`). Differing blocks with the same identifier are refused before the existing cached block can be overwritten. Repeated identical blocks share an identifier; a missing occurrence retains the expanded backup for recovery. File/project identifiers retain their separate existing hash scheme. Cached paths use canonical project-owned regular files; target and cache symlinks are refused. Session ownership prevents another session's Stop from clearing active protection. File replacements are atomic and preserve mode, but can change the inode. LF, CRLF, and missing trailing newlines are covered by the lifecycle tests. Files containing NUL bytes are refused before filtering or replacement and remain untouched.

Expansion replaces only original input spans in one pass. Tokens inside restored blocks remain literal, including when several original placeholders share a line. NUL content does not bypass ownership checks: foreign tools are still denied, while the owning session's PostToolUse/Stop retains the current bytes, backup, and lock for explicit recovery.

## Annotation syntax

```js
/* simplify-ignore-start */           // basic — hides the block
/* simplify-ignore-start: reason */   // with reason — appears in placeholder
/* simplify-ignore-end */
```

Any comment style works (`//`, `/*`, `#`, `<!--`). Multiple blocks per file and single-line blocks supported. Placeholders preserve the original comment syntax (e.g. `# BLOCK_xxx` for Python, `<!-- BLOCK_xxx -->` for HTML).

## Crash recovery

If Claude Code crashes without triggering Stop, files on disk may still have placeholders. Preserve the cache. Inspect `<id>.path`, `<id>.owner`, and `<id>.bak` to identify the file, original session, and expanded backup. After confirming the original session is no longer active, invoke Stop with that session's identity and the same project/cache configuration:

```bash
jq -n --arg sid 'ORIGINAL_SESSION_ID' \
  '{hook_event_name:"Stop", session_id:$sid}' |
  CLAUDE_PROJECT_DIR="$PWD" bash "/absolute/path/to/agent-skills/hooks/simplify-ignore.sh"
```

If you configured `SIMPLIFY_IGNORE_CACHE_DIR`, set it to that same location for recovery. Stop never steals another session's lock. Orphan locks, missing/mismatched path metadata, ownerless legacy state, and unsafe cache entries require manual inspection; backups are retained. Keep copies before repairing metadata or reconciling a backup with newer edits. Do not blindly copy a stale backup over current work.

Upgrade with no active filtered files. Older versions stored backups in `.claude/.simplify-ignore-cache/` and did not record owners. The new default does not automatically import or restore that state. Recover it manually before starting a new session, retaining both current files and old backups; pointing the override at an ownerless legacy cache does not adopt it automatically.

## Known limitations

- **Single-line blocks hide the entire line.** If `simplify-ignore-start` and `simplify-ignore-end` appear on the same line as other code, the whole line is hidden from the model, not just the annotated portion. Use dedicated lines for annotations.
- **Comment suffix detection covers `*/` and `-->` only.** Template engines with non-standard comment closers (ERB `%>`, Blade `--}}`) may produce unbalanced placeholders. Use `#` or `//` style comments instead.
- **Fallback expansion is progressive, not exact.** If the model alters a placeholder's formatting (e.g. changes the reason text), the hook tries progressively simpler matches: full placeholder → prefix+hash+suffix → hash-only. The hash-only fallback may leave cosmetic debris (e.g. stray `:` or reason text). A warning is printed to stderr when this happens.
- **Placeholder identifiers are reserved outside protected blocks.** Filtering refuses an unprotected source literal that collides with a generated `BLOCK_<hash>` token. The expanded file remains untouched, candidate expansion rules are cleared, and the backup remains available. A later Stop preserves that expanded file and retains a recovery copy. Extra matching tokens introduced during active protection also refuse expansion and retain the current file, backup, and ownership state for explicit recovery.
- **Placeholder identifiers are reserved outside protected blocks.** An unprotected literal containing a cached `BLOCK_<hash>` token can be interpreted as a placeholder by the fuzzy fallback. Keep such literals inside protected blocks or disable this optional hook for the file.
- **A wholesale rewrite stays in place.** If all placeholders disappear, PostToolUse retains the protected backup and leaves the rewrite unchanged. Stop saves that backup as a unique `<id>.recovered.<random>` file in the cache and prints its location. Existing recovery files are never replaced. Partial placeholder loss also retains a recovery copy before backup refresh or cleanup. Reconcile missing blocks manually.
- **File renaming leaves placeholders.** A moved file can retain placeholders. Stop leaves the moved/unsafe target untouched and saves the original backup as a unique cache recovery file. Reconcile it with the moved file manually.
- **This is workflow protection, not a security sandbox.** Shell commands and external editors bypass PreToolUse ownership checks. Concurrent edits to the same file within one session and hostile local-process races are not fully defended. Use separate checkouts for concurrent work; serialize operations on a protected file. Symlink checks and private cache permissions reduce accidental/crafted-path damage without promising race-proof filesystem authorization.

## Requirements

- `jq`, Perl, `shasum` (or both `sha1sum` and `sha256sum`), Bash 3.2+, standard `mktemp`/`find`/`cp`/`mv` utilities. Missing jq is reported; missing Perl prevents mutation. Windows requires Git Bash; lifecycle tests must use a real jq binary.
