# Using Raiinman Agent Skills with Codex

This is the supported installation for the personal [`raiinman/agent-skills`](https://github.com/raiinman/agent-skills) fork of [Addy Osmani's Agent Skills](https://github.com/addyosmani/agent-skills). The plugin and marketplace are both named `raiinman-agent-skills`, distinct from upstream. All 25 shared skills and the original MIT attribution are preserved.

## Install

```bash
codex plugin marketplace add raiinman/agent-skills
codex plugin add raiinman-agent-skills@raiinman-agent-skills
```

The first command registers the fork's marketplace. The second installs and enables its plugin on a Codex CLI that supports plugin installation. For desktop installation, open the Plugins Directory, select the `Raiinman Agent Skills` marketplace, and install `Raiinman Agent Skills`. Restart or open a new session so the installed skills are discovered. See the [official plugin packaging and marketplace documentation](https://developers.openai.com/plugins/build/plugins) for current surface-specific installation behavior.

Local clones work too:

```bash
codex plugin marketplace add /absolute/path/to/agent-skills
codex plugin add raiinman-agent-skills@raiinman-agent-skills
```

The distinct identity avoids replacing upstream. Both packs contain the same skill names, so enable one pack per project to avoid competing descriptions and workflow policies.

## Workflow

Describe the task and let Codex select relevant skills, or explicitly invoke a skill such as `@spec-driven-development`.

- **Small, clear tasks:** execute directly, validate the changed content or behavior, and commit the verified task. No spec or plan is required just because files change.
- **Substantial or ambiguous work:** use a spec and dependency-ordered plan. Reuse accepted requirements and existing artifacts.
- **Authorization:** carry forward scope and decisions through the current session. Continue authorized implementation without repeated approval questions. Ask when a consequential decision is unresolved or an action exceeds authorization.
- **Requested deliverables:** a request for a spec, plan, or review alone stops with that deliverable. It does not authorize implementation.
- **Verification:** use meaningful behavior tests for behavior changes, relevant content/configuration checks for static edits, and required repository checks. Broaden testing for shared behavior, failures, or unresolved concerns. Report behavior that was not verified.
- **Commits:** each verified task still commits automatically. Stage only task-owned files and preserve unrelated local changes.
- **Model comparisons:** local checks are the default. Paid cross-model comparisons require an explicit request and stay within the authorized scope and budget.

For an end-to-end task, authorize its scope: “Implement the agreed feature, resolve routine choices within these requirements, verify each task, and commit each completed task. Ask about consequential gaps.” To reserve a review checkpoint, say “Produce the plan only; do not implement yet.”

[Codex uses progressive disclosure](https://developers.openai.com/codex/skills): it starts with each skill's `name` and `description`, chooses skills on demand, then loads the full `SKILL.md` only when selected. Do not also paste `using-agent-skills/SKILL.md` into `AGENTS.md`, a system prompt, or other always-on context: that stacks the pack's meta-router on Codex's native router and adds unnecessary routing work. The meta-skill can remain installed with the pack; the warning is specifically against preloading its full instructions.

## Package structure

- `plugin.json` — portable root identity and version, aligned with the Codex manifest.
- `.codex-plugin/plugin.json` — supported compatibility manifest pointing `skills` at `./skills/`.
- `.agents/plugins/marketplace.json` — the fork's marketplace; its local source path `./` resolves to this repository root.
- `skills/<name>/SKILL.md` — shared workflows using the same `name` + `description` frontmatter format across hosts.

Keep the plugin package together so links to the root `references/` directory resolve. Slash commands in `.claude/commands/` and personas in `agents/` stay host-specific. Codex uses the shared skills directly, including their authorization and continuation rules; `/build auto` is a command adapter, not a Codex command. The `SessionStart` helper under `hooks/` is not registered by either plugin.

## Verification and maintenance

Local validators check skill structure, lexical routing, references, command parity, artifact paths, and manifest versions. These checks do not establish native model invocation reliability. Gemini and other inherited host integrations retain portable content; native runtime verification is a later stage.

Before treating a new version as behaviorally proven, exercise representative tasks in Codex and record host/model versions and observed outcomes. Paid behavioral runs are optional and explicitly requested. The [eval guide](../evals/README.md) describes the existing Claude-backed runner's complete package snapshots, explicit model selections, and retained evidence. That runner's results do not establish native Codex or Gemini behavior.
