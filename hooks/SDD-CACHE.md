# sdd-cache hook

An opt-in, local cache for custom fetch integrations that provide HTTP validators from the **same successful response** as the processed reading.

**Native Claude Code WebFetch cannot use this cache.** Its [documented output](https://code.claude.com/docs/en/agent-sdk/typescript) includes status, URL, timing, and a prompt-processed result, but no HTTP response headers. Its input has no representation headers either. Both hooks bypass native inputs; they create no entry and make no revalidation request. A later HEAD request cannot establish which representation produced an earlier reading.

The hooks are not registered by the plugin. Existing in-project `.claude/sdd-cache/` entries from the old implementation are ignored and may be removed manually.

## Requirements and setup

- Bash 3.2+ and a usable Python 3.8+ interpreter (`python3` or `python`).
- A trusted custom fetch integration implementing the contract below.
- An explicit comma-separated hostname allowlist in `SDD_CACHE_ALLOWED_HOSTS`; it is empty by default.
- A private cache directory outside the project.

For example, set `SDD_CACHE_ALLOWED_HOSTS=docs.example.com` in the environment that launches your host. Entries live under `$XDG_CACHE_HOME/raiinman-sdd-cache` (or `~/.cache/raiinman-sdd-cache`) on Unix, and `%LOCALAPPDATA%\raiinman-sdd-cache` on Windows. An absolute `SDD_CACHE_DIR` can override that location. The path must remain outside `CLAUDE_PROJECT_DIR` (or the current working directory).

Register the helpers for **your custom tool**, replacing the matcher and script paths with its actual name and the installed package's absolute paths:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "mcp__your_server__fetch",
      "hooks": [{
        "type": "command",
        "command": "bash \"/absolute/path/to/agent-skills/hooks/sdd-cache-pre.sh\"",
        "timeout": 10
      }]
    }],
    "PostToolUse": [{
      "matcher": "mcp__your_server__fetch",
      "hooks": [{
        "type": "command",
        "command": "bash \"/absolute/path/to/agent-skills/hooks/sdd-cache-post.sh\"",
        "timeout": 10
      }]
    }]
  }
}
```

A hit exits 2 and writes the reading to stderr as untrusted evidence. On a miss or unsupported input, the pre-hook exits 0 silently so the original tool proceeds. The post-hook never makes a network request. Missing or unsupported Python also leaves the tool available.

## Custom integration contract

The custom tool must perform an anonymous GET without redirects, using exactly these HTTP request headers in addition to the ordinary Host header:

```json
{
  "Accept": "*/*",
  "Accept-Encoding": "identity",
  "User-Agent": "raiinman-sdd-cache/3"
}
```

The pre-hook needs those actual representation headers in `tool_input.headers`. The post-hook needs the actual request profile, method, final response URL, status, response headers, and processed reading from that same operation. Do not manufacture metadata using a separate request.

A supported post-hook payload is:

```json
{
  "tool_input": {
    "url": "https://docs.example.com/guide",
    "prompt": "Extract the signature",
    "headers": {
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "User-Agent": "raiinman-sdd-cache/3"
    }
  },
  "tool_response": {
    "code": 200,
    "method": "GET",
    "url": "https://docs.example.com/guide",
    "request_headers": {
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "User-Agent": "raiinman-sdd-cache/3"
    },
    "headers": {
      "ETag": "\"version-1\"",
      "Cache-Control": "public"
    },
    "result": "The signature is example(value)."
  }
}
```

The pre-hook receives the same `tool_input` without needing `tool_response`. Header names are case-insensitive, but duplicate spellings of a header are rejected. Integrations must preserve or reject duplicate original validator fields rather than silently choosing one.

Unsupported cases bypass storage and reuse:

- Missing metadata, a legacy string response, non-200 status, non-GET method, or a response URL different from the requested URL.
- Any caller headers outside the fixed profile, including credentials, cookies, language preferences, and alternative encodings. Additional tool input fields are also unsupported.
- URLs over 8 KiB or containing credentials, query strings (including an empty `?`), fragments, backslashes, raw Unicode, whitespace, or control characters. Only allowlisted HTTPS DNS hostnames on port 443 are accepted; IP-literal URLs are rejected.
- Missing ETag and Last-Modified, malformed header values, any nonempty Vary, Set-Cookie, or private/no-store/no-cache response directives.
- Empty readings, readings over 1 MiB of UTF-8, malformed or oversized hook input, and invalid cache entries.

The fixed request profile and conservative rejection of Vary avoid confusing differently negotiated responses. Supporting other profiles requires extending both the fetch contract and revalidator together.

## Reuse and local storage

The key binds the **exact URL, exact prompt, and resolved project directory**. Entries retain those fields and are checked again before use. Different prompts and projects cannot consume each other's reading. Old entry versions are ignored.

A candidate must be at most one hour old, contain a nonempty bounded reading, and have valid same-response validators. The revalidator sends HEAD with the same request profile and a conditional validator. Only a 304 without contradictory validators or unsupported cache policy allows reuse; redirects, changed representations, errors, or timeouts let the original tool run. A cache hit does not refresh the entry's original age.

Every DNS address returned for the hostname is checked. Private, loopback, link-local, reserved, and multicast addresses reject the request even when another address is public. The protocol-assignment block `192.0.0.0/24`, deprecated 6to4 space `2002::/16`, and deprecated site-local IPv6 `fec0::/10` are refused explicitly, including public exceptions within the first two blocks. Supported Python versions can classify site-local IPv6 as global and non-reserved; older versions also classify some other special-use addresses as global. IPv4-compatible and IPv4-mapped IPv6 addresses are refused by the reserved-address check. Ordinary public IPv4 and IPv6 remain supported. The connection uses a vetted numeric address directly, with TLS verification and SNI for the original hostname, avoiding a second hostname lookup. Redirects are never followed. DNS and HTTP work run in a child process with a five-second deadline; sockets have a four-second timeout.

On Unix the cache directory and readable entries must be private and owned by the current user. Windows uses the user's local application-data directory and its inherited access controls. Symlink and Windows reparse paths are refused, including parent components and cache entries. New entries use uniquely created temporary files and atomic replacement; a failed replacement preserves the previous entry.

These checks protect against common accidental exposure and path substitutions. They do not isolate the cache from arbitrary code already running as the same user, establish trust in dishonest integration metadata, or prove that a model-generated reading faithfully summarizes a page. Cached text remains untrusted evidence. HTTP revalidation concerns the origin representation, not the truth of the reading.

## Free regression tests

```bash
python hooks/sdd-cache-test.py
# Or use the portable interpreter-selecting wrapper:
bash hooks/sdd-cache-test.sh
```

Tests use Python's standard library and mocked DNS, TLS/socket connections, HTTP responses, and child-process outcomes. They make no real network or model calls. They cover native bypass, same-response provenance, wrong prompts/projects, negotiation and authentication rejection, invalid metadata, freshness and size limits, hostile text, DNS/SSRF checks, connection pinning, redirect refusal, symlink/reparse checks, and atomic-write failure. Real symlink and Unix-permission tests skip where the operating system cannot exercise them.

Remove the chosen external cache directory to clear stored readings. The helpers never automatically delete legacy project cache directories or unrelated files.
