<!-- project-centered:start -->
<div align="center">

<a name="readme-top"></a>
<h1 align="center">Agent Skills</h1>

<!-- project-header:start -->
<p align="center"><img src="readme-banner.png" alt="agent-skills — original decorative project artwork" width="100%"></p>
<!-- project-header:end -->

<!-- project-badges:start -->
<p align="center"><a href="https://github.com/raiinman/agent-skills"><img src="https://img.shields.io/badge/collection-engineering_workflows-AE8D53?logo=github&amp;logoColor=white" alt="collection: engineering workflows"></a> <a href="https://github.com/raiinman/agent-skills"><img src="https://img.shields.io/badge/access-public-AE8D53?logo=github&amp;logoColor=white" alt="access: public"></a> <a href="#readme-index"><img src="https://img.shields.io/badge/docs-explore_the_index-AE8D53?logo=readthedocs&amp;logoColor=white" alt="docs: explore the index"></a></p>
<!-- project-badges:end -->

<!-- project-live-badges:start -->
<p align="center"><a href="https://github.com/raiinman/agent-skills/commits/main"><img src="https://img.shields.io/github/last-commit/raiinman/agent-skills?color=AE8D53&amp;logo=git&amp;logoColor=white" alt="GitHub last commit"></a> <a href="https://github.com/raiinman/agent-skills/issues"><img src="https://img.shields.io/github/issues/raiinman/agent-skills?color=AE8D53&amp;logo=github&amp;logoColor=white" alt="GitHub open issues"></a> <a href="https://github.com/raiinman/agent-skills/stargazers"><img src="https://img.shields.io/github/stars/raiinman/agent-skills?style=flat&amp;color=AE8D53&amp;logo=github&amp;logoColor=white" alt="GitHub stars"></a></p>
<!-- project-live-badges:end -->

<!-- project-index:start -->
<a name="readme-index"></a>
<h3 align="center">✦ Explore this project</h3>
<table align="center"><tbody><tr><td align="center"><a href="#readme-overview"><strong>Overview</strong></a></td><td align="center"><a href="#readme-section-1"><strong>Commands</strong></a></td></tr><tr><td align="center"><a href="#readme-section-2"><strong>Quick Start</strong></a></td><td align="center"><a href="#readme-section-3"><strong>Adoption</strong></a></td></tr><tr><td align="center"><a href="#readme-section-4"><strong>All 25 Skills</strong></a></td><td align="center"><a href="#readme-section-12"><strong>Agent Personas</strong></a></td></tr><tr><td align="center"><a href="#readme-section-13"><strong>Reference Checklists</strong></a></td><td align="center"><a href="#readme-section-14"><strong>How Skills Work</strong></a></td></tr><tr><td align="center"><a href="#readme-section-15"><strong>Project Structure</strong></a></td><td align="center"><a href="#readme-section-16"><strong>Why Agent Skills?</strong></a></td></tr><tr><td align="center"><a href="#readme-section-17"><strong>How it compares</strong></a></td><td align="center"><a href="#readme-section-18"><strong>Contributing</strong></a></td></tr><tr><td align="center"><a href="#readme-section-19"><strong>Team</strong></a></td><td align="center"><a href="#readme-section-20"><strong>License</strong></a></td></tr></tbody></table>
<h4 align="center">Project shortcuts</h4>
<table align="center"><tbody><tr><td align="center"><a href="CONTRIBUTING.md"><strong>CONTRIBUTING</strong></a></td><td align="center"><a href="https://github.com/raiinman/agent-skills/tree/main/skills"><strong>skills</strong></a></td></tr><tr><td align="center"><a href="https://github.com/raiinman/agent-skills/tree/main/docs"><strong>docs</strong></a></td><td align="center"><a href="LICENSE"><strong>License</strong></a></td></tr></tbody></table>
<!-- project-index:end -->

<a name="readme-overview"></a>
<h2 align="center">Overview</h2>

**Production-grade engineering skills for AI coding agents.**

Skills encode the workflows, quality gates, and best practices that senior engineers use when building software. These ones are packaged so AI agents follow them consistently across every phase of development.

<a href="https://trendshift.io/repositories/25200" target="_blank"><img src="https://trendshift.io/api/badge/repositories/25200" alt="addyosmani%2Fagent-skills | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

![Addy's Agent Skills](https://addyosmani.com/assets/images/addys-agent-skills.jpg)

<table align="center"><tbody><tr><td align="left"><pre><code>  DEFINE          PLAN           BUILD          VERIFY         REVIEW          SHIP&#10; ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐&#10; │ Idea │ ───▶ │ Spec │ ───▶ │ Code │ ───▶ │ Test │ ───▶ │  QA  │ ───▶ │  Go  │&#10; │Refine│      │  PRD │      │ Impl │      │Debug │      │ Gate │      │ Live │&#10; └──────┘      └──────┘      └──────┘      └──────┘      └──────┘      └──────┘&#10;  /spec          /plan          /build        /test         /review       /ship&#10;</code></pre></td></tr></tbody></table>



---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-1"></a>

## Commands

9 slash commands that map to the development lifecycle. Each one activates the right skills automatically.

<table align="center">
<thead>
<tr>
<th align="center">What you're doing</th>
<th align="center">Command</th>
<th align="center">Key principle</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center">Define what to build</td>
<td align="center"><code>/spec</code></td>
<td align="center">Spec before code</td>
</tr>
<tr>
<td align="center">Plan how to build it</td>
<td align="center"><code>/plan</code></td>
<td align="center">Small, atomic tasks</td>
</tr>
<tr>
<td align="center">Build incrementally</td>
<td align="center"><code>/build</code></td>
<td align="center">One slice at a time</td>
</tr>
<tr>
<td align="center">Prove it works</td>
<td align="center"><code>/test</code></td>
<td align="center">Tests are proof</td>
</tr>
<tr>
<td align="center">Set the quality bar</td>
<td align="center"><code>/constraints</code></td>
<td align="center">Decide it once, enforce it everywhere</td>
</tr>
<tr>
<td align="center">Review before merge</td>
<td align="center"><code>/review</code></td>
<td align="center">Improve code health</td>
</tr>
<tr>
<td align="center">Audit web performance</td>
<td align="center"><code>/webperf</code></td>
<td align="center">Measure before you optimize</td>
</tr>
<tr>
<td align="center">Simplify the code</td>
<td align="center"><code>/code-simplify</code></td>
<td align="center">Clarity over cleverness</td>
</tr>
<tr>
<td align="center">Ship to production</td>
<td align="center"><code>/ship</code></td>
<td align="center">Faster is safer</td>
</tr>
</tbody>
</table>



In Claude Code these install as plugin commands. Where a built-in command has the same name, as `/review` does, use the namespaced form: `/agent-skills:review`.

Want fewer manual steps once the spec exists? **`/build auto`** generates the plan and implements every task in a single approved pass — you approve the plan once, then it runs autonomously. It removes the human stepping *between* tasks, not the verification: every task is still test-driven and committed individually, and it pauses on failures or risky steps.

Skills also activate automatically based on what you're doing — designing an API triggers `api-and-interface-design`, building UI triggers `frontend-ui-engineering`, and so on.

---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-2"></a>

## Quick Start

**Fastest path — any agent, one command.** The open [skills CLI](https://github.com/vercel-labs/skills) installs into 70+ agents (Claude Code, Cursor, Codex, Copilot, Cline, and more):

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">npx skills add addyosmani/agent-skills            # install all 25 skills&#10;npx skills add addyosmani/agent-skills --list     # browse before installing&#10;</code></pre></td></tr></tbody></table>



Or grab individual skills:

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">npx skills add addyosmani/agent-skills --skill code-review-and-quality   # five-axis review before merge&#10;npx skills add addyosmani/agent-skills --skill interview-me              # requirements interrogation, one question at a time&#10;npx skills add addyosmani/agent-skills --skill test-driven-development   # red-green-refactor, enforced&#10;</code></pre></td></tr></tbody></table>



<blockquote align="center">
<p align="center"><strong>Installing one skill?</strong> A per-skill <code>npx</code> install copies only
<code>skills/&lt;name&gt;/</code>, not the repo-level <code>references/</code> directory. The skill still
works, but paths to supplementary shared checklists are unavailable. Use a
whole-repo integration, clone the repository, or copy the needed checklist into
a <code>references/</code> directory inside the installed skill. This portability gap is
tracked in <a href="https://github.com/addyosmani/agent-skills/issues/361">#361</a>.</p>
</blockquote>



Prefer a native integration? Pick your tool below.

<details>
<summary><b>Claude Code (recommended)</b></summary>

**Marketplace install:**

<table align="center"><tbody><tr><td align="left"><pre><code>/plugin marketplace add addyosmani/agent-skills&#10;/plugin install agent-skills@addy-agent-skills&#10;</code></pre></td></tr></tbody></table>



<blockquote align="center">
<p align="center"><strong>SSH errors?</strong> The marketplace clones repos via SSH. If you don't have SSH keys set up on GitHub, either <a href="https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account">add your SSH key</a> or use the full HTTPS URL to force HTTPS cloning during the marketplace-add step:</p>
<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">/plugin marketplace add https://github.com/addyosmani/agent-skills.git&#10;/plugin install agent-skills@addy-agent-skills&#10;</code></pre></td></tr></tbody></table>
<p align="center">If <code>/plugin install</code> still fails with <code>git@github.com: Permission denied (publickey)</code> on Windows or macOS, the recommended workaround is to configure Git once to rewrite GitHub SSH URLs to HTTPS for subprocess clones:</p>
<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">git config --global url."https://github.com/".insteadOf git@github.com:&#10;</code></pre></td></tr></tbody></table>
</blockquote>



**Local / development:**

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">git clone https://github.com/addyosmani/agent-skills.git&#10;claude --plugin-dir /path/to/agent-skills&#10;</code></pre></td></tr></tbody></table>



</details>

<details>
<summary><b>Cursor</b></summary>

Put workflow skills under `.cursor/skills/` (sync from `agent-skills/skills/`) and short policies in `.cursor/rules/*.mdc` — do not paste full skills into rules. Both directories live in your project; this repo does not ship a `.cursor/` folder. See [docs/cursor-setup.md](docs/cursor-setup.md).

</details>

<details>
<summary><b>Antigravity CLI</b></summary>

Install as a native plugin for skills and subagents. In affected Antigravity CLI releases, legacy command TOMLs are reported as converted but their wrapper commands are not discoverable; invoke the underlying namespaced skills directly. See [docs/antigravity-setup.md](docs/antigravity-setup.md#lifecycle-workflows-and-command-compatibility).

**Install from the repo:**

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">agy plugin install https://github.com/addyosmani/agent-skills.git&#10;</code></pre></td></tr></tbody></table>



**Install from a local clone:**

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">git clone https://github.com/addyosmani/agent-skills.git&#10;agy plugin install ./agent-skills&#10;</code></pre></td></tr></tbody></table>



</details>

<details>
<summary><b>Gemini CLI</b></summary>

Install as native skills for auto-discovery, or add to `GEMINI.md` for persistent context. See [docs/gemini-cli-setup.md](docs/gemini-cli-setup.md).

**Install from the repo:**

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">gemini skills install https://github.com/addyosmani/agent-skills.git --path skills&#10;</code></pre></td></tr></tbody></table>



**Install from a local clone:**

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">gemini skills install ./agent-skills/skills/&#10;</code></pre></td></tr></tbody></table>



</details>

<details>
<summary><b>Windsurf</b></summary>

Add skill contents to your Windsurf rules configuration. See [docs/windsurf-setup.md](docs/windsurf-setup.md).

</details>

<details>
<summary><b>OpenCode</b></summary>

Copy skills to `.opencode/skills/` (or `~/.config/opencode/skills/`), add a project-local `AGENTS.md`, and use the built-in `skill` tool for agent-driven execution. Optional slash commands can be added under `.opencode/commands/`.

See [docs/opencode-setup.md](docs/opencode-setup.md).

</details>

<details>
<summary><b>GitHub Copilot</b></summary>

Use agent definitions from `agents/` as Copilot personas and skill content in `.github/copilot-instructions.md`. The lifecycle slash commands (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`) are Claude Code commands and do not appear in Copilot; invoke the skills by name (`/spec-driven-development`, …) instead. See [docs/copilot-setup.md](docs/copilot-setup.md).

Using the standalone `copilot` CLI? Install it as a plugin — see [docs/copilot-cli-setup.md](docs/copilot-cli-setup.md).

</details>

<details>
  <summary><b>Kiro IDE & CLI </b></summary>
  Skills for Kiro reside under ".kiro/skills/" and can be stored under Project or Global level. Kiro also supports Agents.md. See Kiro docs at https://kiro.dev/docs/skills/
</details>

<details>
<summary><b>Codex</b></summary>

Install as a native Codex plugin (Codex CLI v0.122+):

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">codex plugin marketplace add addyosmani/agent-skills&#10;codex plugin add agent-skills@agent-skills&#10;</code></pre></td></tr></tbody></table>



The first command registers the marketplace; the second installs the plugin. Codex reads the root `skills/` directory directly through `.codex-plugin/plugin.json`. Once installed, invoke skills in chat using `@` (e.g., `@spec-driven-development`). See [docs/codex-setup.md](docs/codex-setup.md) for local installation and troubleshooting.

</details>

<details>
<summary><b>Command Code</b></summary>

Install natively with the built-in `cmd skills` command. Command Code clones the repo, discovers every `SKILL.md`, and installs into `.commandcode/skills/`:

<table align="center"><tbody><tr><td align="left"><pre><code class="language-bash">cmd skills add addyosmani/agent-skills            # pick skills to install (project)&#10;cmd skills add addyosmani/agent-skills --global   # install for all projects (~/.commandcode/skills/)&#10;cmd skills add addyosmani/agent-skills -s spec-driven-development  # install a specific skill&#10;</code></pre></td></tr></tbody></table>



Installed skills show up in the TUI slash menu, e.g. `/spec-driven-development`. See [docs/commandcode-setup.md](docs/commandcode-setup.md).

</details>

<details>
<summary><b>Other Agents</b></summary>

Skills are plain Markdown - they work with any agent that accepts system prompts or instruction files. See [docs/getting-started.md](docs/getting-started.md). Hosts that install the pack but aren't listed above are in [docs/other-hosts.md](docs/other-hosts.md).

</details>



---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-3"></a>

## Adoption

Already installed? How you roll the pack out depends on your codebase. The **[Adoption Guide](docs/adoption-guide.md)** covers two paths: the full lifecycle from day one for a greenfield project, or an incremental, verification-first rollout for an established codebase.

---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-4"></a>

## All 25 Skills

The commands above are entry points. The pack includes 25 skills total — 24 lifecycle skills plus the `using-agent-skills` meta-skill. Each skill is a structured workflow with steps, verification gates, and anti-rationalization tables. You can also reference any skill directly.

<a name="readme-section-5"></a>

### Meta - Discover which skill applies

<table align="center">
<thead>
<tr>
<th align="center">Skill</th>
<th align="center">What It Does</th>
<th align="center">Use When</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="skills/using-agent-skills/SKILL.md">using-agent-skills</a></td>
<td align="center">Maps incoming work to the right skill workflow and defines shared operating rules</td>
<td align="center">Starting a session or deciding which skill applies</td>
</tr>
</tbody>
</table>



<a name="readme-section-6"></a>

### Define - Clarify what to build

<table align="center">
<thead>
<tr>
<th align="center">Skill</th>
<th align="center">What It Does</th>
<th align="center">Use When</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="skills/interview-me/SKILL.md">interview-me</a></td>
<td align="center">One-question-at-a-time interview that extracts what the user actually wants instead of what they think they should want, until ~95% confidence</td>
<td align="center">The ask is underspecified, or the user invokes "interview me" / "grill me"</td>
</tr>
<tr>
<td align="center"><a href="skills/idea-refine/SKILL.md">idea-refine</a></td>
<td align="center">Structured divergent/convergent thinking to turn vague ideas into concrete proposals</td>
<td align="center">You have a rough concept that needs exploration</td>
</tr>
<tr>
<td align="center"><a href="skills/spec-driven-development/SKILL.md">spec-driven-development</a></td>
<td align="center">Write a PRD covering objectives, commands, structure, code style, testing, and boundaries before any code</td>
<td align="center">Starting a new project, feature, or significant change</td>
</tr>
<tr>
<td align="center"><a href="skills/constraint-driven-development/SKILL.md">constraint-driven-development</a></td>
<td align="center">Interviews you for a quality bar with sane default thresholds, writes CONSTRAINTS.md, places each check by cost, and catches agents silencing checks or skipping tests to get green</td>
<td align="center">No standards are written down, or an agent is producing more than anyone reads</td>
</tr>
</tbody>
</table>



<a name="readme-section-7"></a>

### Plan - Break it down

<table align="center">
<thead>
<tr>
<th align="center">Skill</th>
<th align="center">What It Does</th>
<th align="center">Use When</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="skills/planning-and-task-breakdown/SKILL.md">planning-and-task-breakdown</a></td>
<td align="center">Decompose specs into small, verifiable tasks with acceptance criteria and dependency ordering</td>
<td align="center">You have a spec and need implementable units</td>
</tr>
</tbody>
</table>



<a name="readme-section-8"></a>

### Build - Write the code

<table align="center">
<thead>
<tr>
<th align="center">Skill</th>
<th align="center">What It Does</th>
<th align="center">Use When</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="skills/incremental-implementation/SKILL.md">incremental-implementation</a></td>
<td align="center">Thin vertical slices - implement, test, verify, commit. Feature flags, safe defaults, rollback-friendly changes</td>
<td align="center">Any change touching more than one file</td>
</tr>
<tr>
<td align="center"><a href="skills/test-driven-development/SKILL.md">test-driven-development</a></td>
<td align="center">Red-Green-Refactor, test pyramid (80/15/5), test sizes, DAMP over DRY, Beyonce Rule, browser testing</td>
<td align="center">Implementing logic, fixing bugs, or changing behavior</td>
</tr>
<tr>
<td align="center"><a href="skills/context-engineering/SKILL.md">context-engineering</a></td>
<td align="center">Feed agents the right information at the right time - rules files, context packing, MCP integrations</td>
<td align="center">Starting a session, switching tasks, or when output quality drops</td>
</tr>
<tr>
<td align="center"><a href="skills/source-driven-development/SKILL.md">source-driven-development</a></td>
<td align="center">Ground every framework decision in official documentation - verify, cite sources, flag what's unverified</td>
<td align="center">You want authoritative, source-cited code for any framework or library</td>
</tr>
<tr>
<td align="center"><a href="skills/doubt-driven-development/SKILL.md">doubt-driven-development</a></td>
<td align="center">Adversarial fresh-context review of every non-trivial decision in-flight - CLAIM → EXTRACT → DOUBT → RECONCILE → STOP, with optional user-authorized cross-model escalation</td>
<td align="center">Stakes are high (production, security, irreversible), working in unfamiliar code, or a confident output is cheaper to verify now than to debug later</td>
</tr>
<tr>
<td align="center"><a href="skills/frontend-ui-engineering/SKILL.md">frontend-ui-engineering</a></td>
<td align="center">Component architecture, design systems, state management, responsive design, WCAG 2.1 AA accessibility</td>
<td align="center">Building or modifying user-facing interfaces</td>
</tr>
<tr>
<td align="center"><a href="skills/api-and-interface-design/SKILL.md">api-and-interface-design</a></td>
<td align="center">Contract-first design, Hyrum's Law, One-Version Rule, error semantics, boundary validation</td>
<td align="center">Designing APIs, module boundaries, or public interfaces</td>
</tr>
</tbody>
</table>



<a name="readme-section-9"></a>

### Verify - Prove it works

<table align="center">
<thead>
<tr>
<th align="center">Skill</th>
<th align="center">What It Does</th>
<th align="center">Use When</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="skills/browser-testing-with-devtools/SKILL.md">browser-testing-with-devtools</a></td>
<td align="center">Chrome DevTools MCP for live runtime data - DOM inspection, console logs, network traces, performance profiling</td>
<td align="center">Building or debugging anything that runs in a browser</td>
</tr>
<tr>
<td align="center"><a href="skills/debugging-and-error-recovery/SKILL.md">debugging-and-error-recovery</a></td>
<td align="center">Five-step triage: reproduce, localize, reduce, fix, guard. Stop-the-line rule, safe fallbacks</td>
<td align="center">Tests fail, builds break, or behavior is unexpected</td>
</tr>
</tbody>
</table>



<a name="readme-section-10"></a>

### Review - Quality gates before merge

<table align="center">
<thead>
<tr>
<th align="center">Skill</th>
<th align="center">What It Does</th>
<th align="center">Use When</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="skills/code-review-and-quality/SKILL.md">code-review-and-quality</a></td>
<td align="center">Five-axis review, change sizing (~100 lines), severity labels (Nit/Optional/FYI), review speed norms, splitting strategies</td>
<td align="center">Before merging any change</td>
</tr>
<tr>
<td align="center"><a href="skills/code-simplification/SKILL.md">code-simplification</a></td>
<td align="center">Chesterton's Fence, Rule of 500, reduce complexity while preserving exact behavior</td>
<td align="center">Code works but is harder to read or maintain than it should be</td>
</tr>
<tr>
<td align="center"><a href="skills/security-and-hardening/SKILL.md">security-and-hardening</a></td>
<td align="center">OWASP Top 10 prevention, auth patterns, secrets management, dependency auditing, three-tier boundary system</td>
<td align="center">Handling user input, auth, data storage, or external integrations</td>
</tr>
<tr>
<td align="center"><a href="skills/performance-optimization/SKILL.md">performance-optimization</a></td>
<td align="center">Measure-first approach - Core Web Vitals targets, profiling workflows, bundle analysis, anti-pattern detection</td>
<td align="center">Performance requirements exist or you suspect regressions</td>
</tr>
</tbody>
</table>



<a name="readme-section-11"></a>

### Ship - Deploy with confidence

<table align="center">
<thead>
<tr>
<th align="center">Skill</th>
<th align="center">What It Does</th>
<th align="center">Use When</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="skills/git-workflow-and-versioning/SKILL.md">git-workflow-and-versioning</a></td>
<td align="center">Trunk-based development, atomic commits, change sizing (~100 lines), the commit-as-save-point pattern</td>
<td align="center">Making any code change (always)</td>
</tr>
<tr>
<td align="center"><a href="skills/ci-cd-and-automation/SKILL.md">ci-cd-and-automation</a></td>
<td align="center">Shift Left, Faster is Safer, feature flags, quality gate pipelines, failure feedback loops</td>
<td align="center">Setting up or modifying build and deploy pipelines</td>
</tr>
<tr>
<td align="center"><a href="skills/deprecation-and-migration/SKILL.md">deprecation-and-migration</a></td>
<td align="center">Code-as-liability mindset, compulsory vs advisory deprecation, migration patterns, zombie code removal</td>
<td align="center">Removing old systems, migrating users, or sunsetting features</td>
</tr>
<tr>
<td align="center"><a href="skills/documentation-and-adrs/SKILL.md">documentation-and-adrs</a></td>
<td align="center">Architecture Decision Records, API docs, inline documentation standards - document the <em>why</em></td>
<td align="center">Making architectural decisions, changing APIs, or shipping features</td>
</tr>
<tr>
<td align="center"><a href="skills/observability-and-instrumentation/SKILL.md">observability-and-instrumentation</a></td>
<td align="center">Structured logging, RED metrics, OpenTelemetry tracing, symptom-based alerting - instrument as you build</td>
<td align="center">Adding telemetry, or shipping anything that runs in production</td>
</tr>
<tr>
<td align="center"><a href="skills/shipping-and-launch/SKILL.md">shipping-and-launch</a></td>
<td align="center">Pre-launch checklists, feature flag lifecycle, staged rollouts, rollback procedures, monitoring setup</td>
<td align="center">Preparing to deploy to production</td>
</tr>
</tbody>
</table>



---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-12"></a>

## Agent Personas

Pre-configured specialist personas for targeted reviews:

<table align="center">
<thead>
<tr>
<th align="center">Agent</th>
<th align="center">Role</th>
<th align="center">Perspective</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="agents/code-reviewer.md">code-reviewer</a></td>
<td align="center">Senior Staff Engineer</td>
<td align="center">Five-axis code review with "would a staff engineer approve this?" standard</td>
</tr>
<tr>
<td align="center"><a href="agents/test-engineer.md">test-engineer</a></td>
<td align="center">QA Specialist</td>
<td align="center">Test strategy, coverage analysis, and the Prove-It pattern</td>
</tr>
<tr>
<td align="center"><a href="agents/security-auditor.md">security-auditor</a></td>
<td align="center">Security Engineer</td>
<td align="center">Vulnerability detection, threat modeling, OWASP assessment</td>
</tr>
<tr>
<td align="center"><a href="agents/web-performance-auditor.md">web-performance-auditor</a></td>
<td align="center">Web Performance Engineer</td>
<td align="center">Core Web Vitals audit with Quick/Deep modes and a metric-honesty rule; run it via <code>/webperf</code></td>
</tr>
</tbody>
</table>



See [docs/agents.md](docs/agents.md) for the decision matrix, orchestration rules, and how personas compose with skills and slash commands.

---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-13"></a>

## Reference Checklists

Quick-reference material that skills pull in when needed:

<table align="center">
<thead>
<tr>
<th align="center">Reference</th>
<th align="center">Covers</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><a href="references/definition-of-done.md">definition-of-done.md</a></td>
<td align="center">Project-wide standing bar every change clears, contrasted with per-task acceptance criteria</td>
</tr>
<tr>
<td align="center"><a href="references/testing-patterns.md">testing-patterns.md</a></td>
<td align="center">Test structure, naming, mocking, React/API/E2E examples, anti-patterns (JavaScript/TypeScript)</td>
</tr>
<tr>
<td align="center"><a href="references/security-checklist.md">security-checklist.md</a></td>
<td align="center">Pre-commit checks, auth, input validation, headers, CORS, OWASP Top 10</td>
</tr>
<tr>
<td align="center"><a href="references/performance-checklist.md">performance-checklist.md</a></td>
<td align="center">Core Web Vitals targets, frontend/backend checklists, measurement commands</td>
</tr>
<tr>
<td align="center"><a href="references/accessibility-checklist.md">accessibility-checklist.md</a></td>
<td align="center">Keyboard nav, screen readers, visual design, ARIA, testing tools</td>
</tr>
<tr>
<td align="center"><a href="references/observability-checklist.md">observability-checklist.md</a></td>
<td align="center">On-call questions, structured logging, RED/USE metrics, tracing, symptom-based alerting, pre-launch gate</td>
</tr>
<tr>
<td align="center"><a href="references/orchestration-patterns.md">orchestration-patterns.md</a></td>
<td align="center">Endorsed multi-persona orchestration patterns, anti-patterns, and the "personas don't invoke personas" rule</td>
</tr>
</tbody>
</table>



---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-14"></a>

## How Skills Work

Every skill follows a consistent anatomy:

<table align="center"><tbody><tr><td align="left"><pre><code>┌─────────────────────────────────────────────────┐&#10;│  SKILL.md                                       │&#10;│                                                 │&#10;│  ┌─ Frontmatter ─────────────────────────────┐  │&#10;│  │ name: lowercase-hyphen-name               │  │&#10;│  │ description: Guides agents through [task].│  │&#10;│  │              Use when…                    │  │&#10;│  └───────────────────────────────────────────┘  │                                                                                                &#10;│  Overview         → What this skill does        │&#10;│  When to Use      → Triggering conditions       │&#10;│  Process          → Step-by-step workflow       │&#10;│  Rationalizations → Excuses + rebuttals         │&#10;│  Red Flags        → Signs something's wrong     │&#10;│  Verification     → Evidence requirements       │&#10;└─────────────────────────────────────────────────┘&#10;</code></pre></td></tr></tbody></table>



**Key design choices:**

<table align="center"><tbody><tr><td align="center"><strong>Process, not prose.</strong> Skills are workflows agents follow, not reference docs they read. Each has steps, checkpoints, and exit criteria.</td></tr><tr><td align="center"><strong>Anti-rationalization.</strong> Every skill includes a table of common excuses agents use to skip steps (e.g., "I'll add tests later") with documented counter-arguments.</td></tr><tr><td align="center"><strong>Verification is non-negotiable.</strong> Every skill ends with evidence requirements - tests passing, build output, runtime data. "Seems right" is never sufficient.</td></tr><tr><td align="center"><strong>Progressive disclosure.</strong> The <code>SKILL.md</code> is the entry point. Supporting references load only when needed, keeping token usage minimal.</td></tr></tbody></table>


---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-15"></a>

## Project Structure

The portable core stays in shared directories. Host-specific paths are native discovery conventions, not branding aliases; renaming or merging them would break the tools that scan those exact locations.

<table align="center">
<thead>
<tr>
<th align="center">Layer / consumer</th>
<th align="center">Repository paths</th>
<th align="center">Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center">Shared workflow core</td>
<td align="center"><code>skills/</code> (25 skills)</td>
<td align="center">Portable <code>SKILL.md</code> workflows used by every integration</td>
</tr>
<tr>
<td align="center">Shared review material</td>
<td align="center"><code>agents/</code> (4 personas), <code>references/</code> (7 checklists)</td>
<td align="center">Specialist reviewers and pack-level checklists carried by whole-repo installs</td>
</tr>
<tr>
<td align="center">Claude Code adapter</td>
<td align="center"><code>.claude/commands/</code> (9 commands), <code>.claude-plugin/</code>, <code>hooks/</code></td>
<td align="center">Slash-command wrappers, marketplace metadata, and lifecycle hooks</td>
</tr>
<tr>
<td align="center">Gemini CLI adapter</td>
<td align="center"><code>.gemini/commands/</code> (9 commands)</td>
<td align="center">Gemini-native TOML command wrappers</td>
</tr>
<tr>
<td align="center">Antigravity CLI adapter</td>
<td align="center"><code>commands/</code> (9 commands), <code>plugin.json</code></td>
<td align="center">Legacy TOML wrappers and the root plugin manifest; see the <a href="docs/antigravity-setup.md#lifecycle-workflows-and-command-compatibility">known wrapper limitation</a></td>
</tr>
<tr>
<td align="center">Codex adapter</td>
<td align="center"><code>.codex-plugin/</code>, <code>.agents/plugins/</code></td>
<td align="center">Codex plugin metadata and marketplace registration; Codex consumes <code>skills/</code> directly</td>
</tr>
<tr>
<td align="center">GitHub Copilot CLI adapter</td>
<td align="center"><code>plugin.json</code></td>
<td align="center">Root plugin metadata; Copilot CLI discovers <code>skills/</code> by convention and does not register the lifecycle wrappers</td>
</tr>
<tr>
<td align="center">Contributor tooling</td>
<td align="center"><code>scripts/</code> (13 scripts), <code>evals/</code> (25 case files), <code>.github/workflows/</code></td>
<td align="center">Validation, routing evals, and CI</td>
</tr>
<tr>
<td align="center">Documentation</td>
<td align="center"><code>docs/</code></td>
<td align="center">Universal guidance and per-tool setup guides</td>
</tr>
</tbody>
</table>



Tools without a checked-in adapter directory install or copy the shared `skills/` core into their own native location. The [Quick Start](#quick-start) links the setup guide for each supported host.

---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-16"></a>

## Why Agent Skills?

AI coding agents default to the shortest path - which often means skipping specs, tests, security reviews, and the practices that make software reliable. Agent Skills gives agents structured workflows that enforce the same discipline senior engineers bring to production code.

Each skill encodes hard-won engineering judgment: *when* to write a spec, *what* to test, *how* to review, and *when* to ship. These aren't generic prompts - they're the kind of opinionated, process-driven workflows that separate production-quality work from prototype-quality work.

Skills bake in best practices from Google's engineering culture — including concepts from [Software Engineering at Google](https://abseil.io/resources/swe-book) and Google's [engineering practices guide](https://google.github.io/eng-practices/). You'll find Hyrum's Law in API design, the Beyonce Rule and test pyramid in testing, change sizing and review speed norms in code review, Chesterton's Fence in simplification, trunk-based development in git workflow, Shift Left and feature flags in CI/CD, and a dedicated deprecation skill treating code as a liability. These aren't abstract principles — they're embedded directly into the step-by-step workflows agents follow.

---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-17"></a>

## How it compares

Wondering how this stacks up against [Superpowers](https://github.com/obra/superpowers) or [Matt Pocock's skills](https://github.com/mattpocock/skills)? See **[docs/comparison.md](docs/comparison.md)** for an honest, side-by-side look at how the three are shaped differently and when to reach for each — including a link to a controlled [head-to-head experiment](https://www.linkedin.com/pulse/superpowers-vs-agent-skills-faster-shipping-safer-reasoning-om-mishra-dzakf/).

---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-18"></a>

## Contributing

Skills should be **specific** (actionable steps, not vague advice), **verifiable** (clear exit criteria with evidence requirements), **battle-tested** (based on real workflows), and **minimal** (only what's needed to guide the agent).

See [docs/skill-anatomy.md](docs/skill-anatomy.md) for the format specification, [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, and [docs/advanced-per-agent-configuration.md](docs/advanced-per-agent-configuration.md) for applying model routing, tool restrictions, and other per-agent runtime controls without breaking the portable `SKILL.md` frontmatter.

---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-19"></a>

## Team

agent-skills is built and maintained by:

<table align="center">
<thead>
<tr>
<th align="center"></th>
<th align="center">Name</th>
<th align="center">GitHub</th>
<th align="center">Role</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><img alt="Addy Osmani" height="60" src="https://github.com/addyosmani.png?size=120" width="60"/></td>
<td align="center"><strong>Addy Osmani</strong></td>
<td align="center"><a href="https://github.com/addyosmani">@addyosmani</a></td>
<td align="center">Creator</td>
</tr>
<tr>
<td align="center"><img alt="Federico Bartoli" height="60" src="https://github.com/federicobartoli.png?size=120" width="60"/></td>
<td align="center"><strong>Federico Bartoli</strong></td>
<td align="center"><a href="https://github.com/federicobartoli">@federicobartoli</a></td>
<td align="center">Collaborator</td>
</tr>
<tr>
<td align="center"><img alt="Joan León" height="60" src="https://github.com/nucliweb.png?size=120" width="60"/></td>
<td align="center"><strong>Joan León</strong></td>
<td align="center"><a href="https://github.com/nucliweb">@nucliweb</a></td>
<td align="center">Collaborator</td>
</tr>
</tbody>
</table>



---

<p align="center"><a href="#readme-index">↑ Back to index</a></p>

<a name="readme-section-20"></a>

## License

MIT - use these skills in your projects, teams, and tools.

<p align="center"><a href="#readme-index">↑ Back to index</a> · <a href="#readme-top">Back to top ↑</a></p>

</div>
<!-- project-centered:end -->
