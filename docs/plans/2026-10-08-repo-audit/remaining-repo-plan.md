# Remaining Agent Skills Repo Plan

**Status: Implementation deferred at your request. This draft remains unapproved; implementation has not started.**

Review date: 2026-10-08. Baseline: `22848dae4944572260933fda6a4f6d2912ec1fb4` on `improve/hook-and-eval-safety`. Completed PRs [1](https://github.com/raiinman/agent-skills/pull/1), [2](https://github.com/raiinman/agent-skills/pull/2), [3](https://github.com/raiinman/agent-skills/pull/3), [4](https://github.com/raiinman/agent-skills/pull/4), and [5](https://github.com/raiinman/agent-skills/pull/5) are the starting point and are excluded from this remaining-work plan. A contradiction still present elsewhere after an earlier fix is recorded as a remaining finding.

## Goal and completed review

Improve correctness, preservation of user work, verification, and maintainability of the existing 25-skill pack. Preserve the focused personal fork, upstream-compatible skill identities/formats, Codex-first support, portable inherited integrations, proportional workflows, and verified per-task commits.

Every tracked file was reviewed: **218 reviewed, 218 unique, zero missing or extra**. Coverage comprises 39 skill/reference files, 115 runtime/evaluation files, and 64 documentation/command/persona/configuration files. This is a complete read-only file review; native behavior in every third-party host and paid model outcomes were not measured.

- [Complete file ledger](remaining-repo-review.csv)
- [Detailed findings, evidence, locations, confidence and verification proposals](remaining-repo-findings.json)

Existing free checks pass: 218 Node tests with one Windows platform skip, 34 Python cache tests with three platform skips, all five validators, and 143 deterministic routing checks. The routing result is 90/91 rank-1 prompts. These passing checks do not cover all newly found failures.

## Decisions settled through grilling

1. Improve existing capabilities; keep new capabilities as optional proposals.
2. Prioritize correct, verifiable outcomes and preservation of user work.
3. Record sound areas explicitly and avoid speculative edits.
4. Permit minimal, pinned development dependencies when justified.
5. Generate repeated catalog listings from one source, with a CI drift check.
6. Support scripted multi-turn evaluations, suitable fixtures, and artifact-aware grading.
7. Keep the existing severity taxonomy. Unresolved Critical and Required findings block shipping unless the user explicitly accepts a recorded deferral.
8. Compile/run locally runnable examples, test risky behavior, and label fragments/external prerequisites.
9. Include historical transcript regrading after reliability/provenance repairs.
10. Pin tested provider CLI versions, document tested Node/Python requirements, and update deliberately.

Earlier choices remain: whole native Codex plugin distribution; `raiinman-agent-skills` identity; Gemini runtime verification later; free checks by default; paid provider/model comparisons only on a separate explicit request. This plan does not authorize such calls.

## Implementation contract

After approval, create a new implementation branch from the baseline. Preserve existing PRs and unrelated work. Use logical verified commits per task, and reviewable draft PRs in the personal fork. Existing drafts are not merged or closed as part of this plan.

Use small, maintained JavaScript YAML/TOML parsers selected against current official documentation, exact dependency versions, a lockfile, and a private contributor-tooling package. Installed skills do not require contributor dependencies merely to load.

Use validated skill frontmatter as the catalog source. Add only the necessary catalog metadata under the standards-supported metadata field, retaining existing phase definitions. Generator-owned blocks will be clearly delimited; human-authored guidance outside those blocks is preserved. Sound skill bodies may receive catalog metadata without speculative workflow rewrites.

Native installation checks use isolated temporary profiles or hosted runners, never overwrite the user's real profile, and never invoke models. Third-party guide corrections are documentation/schema verified unless a native free check is actually performed; supported, tested, and inherited/unverified status remain distinct.

## Ordered tasks and acceptance checks

### Phase 1: Preserve work and establish trustworthy validation

**T01 — Repair the quality-floor helper (C01, C02).**

Handle Git paths without C-quoted-path assumptions, distinguish IO failures from violations, and emit rule/path/line diagnostics without source values.

Acceptance: actual Git fixtures cover ordinary/Unicode/quoted filenames, untracked/staged/tracked changes, missing-file errors, skipped tests, weakened constraints, and fake secret sentinels. Violations and execution errors never become a clean result; diagnostics contain no source value.

Dependencies: none. Likely files: floor-guard reference and its actual-script tests.

**T02 — Validate real YAML and TOML semantics (RT-B1, RT-B2).**

Introduce a shared semantic frontmatter reader and proper TOML parsing. Preserve top-level field scope, validate required fields/types, retain documented anatomy exceptions, and make parser/schema claims accurate.

Acceptance: nested metadata cannot override name/description; malformed quotes and unterminated TOML bodies fail; valid quoted/folded forms and all current files pass. Required procedural anatomy and its accepted headings are made consistent with the contribution contract.

Dependencies: none. Likely files: contributor package/lockfile, lint library, command validator, routing description loader and tests.

**T03 — Unify eval input and CLI validation (RT-B3, RT-E2).**

Use one case-validation contract for deterministic/live/dry-run entry points; reject unknown flags and malformed values. Define backend terminal-event rules and fail closed for incomplete evidence without claiming unmeasured native ordering.

Acceptance: malformed/null cases, empty strings, invalid thresholds/top-k, duplicate IDs and unfinished fake traces fail with actionable diagnostics before model invocation. Current cases remain valid; the 95% routing floor stays unchanged.

Dependencies: T02.

**T04 — Repair fixture setup and journal setup failures (RT-B4, RT-B5).**

Make declared setup patches work for both directory and nested explicit-file selections; consume setup controls rather than exposing them as ordinary fixture inputs. Journal a run before fallible snapshot/setup stages.

Acceptance: real Git nested-file cases apply the intended patch after the baseline, do not commit or retain setup-control files, and preserve all other fixture inputs. Missing manifests/snapshot errors retain a failed run record without invoking a model.

Dependencies: T03. Likely files: eval runner, case/setup contract, runner tests.

**Checkpoint:** Guard regressions and parser/input/setup tests pass. The original free suite still passes. No previously repaired session, cache, Git, path, or evidence protections regress.

### Phase 2: Correct skill behavior and review contracts

**T05 — Repair unsafe React and public-response examples (C03–C06, O03, O06).**

Use a real React error boundary, bind refetch correctly, preserve independent successful mutations during optimistic rollback, and project public users through an explicit allowlist. Make accessibility and production-session prerequisites explicit where examples rely on them.

Acceptance: compile relevant examples; observe an actual child-render failure reaching its fallback; exercise two overlapping mutations with one failure; newly introduced sensitive properties never appear in public output. Fragments declare the environment they require.

Dependencies: T02. Likely files: debugging/frontend skills, hardening patterns, example fixtures/tests.

**T06 — Reconcile workflow exit criteria and atomicity (C07–C10, O01, O05).**

Remove residual hard file-count gates; keep dependent replacement edits in working commits; distinguish reversible schema changes from tested destructive-data recovery; honor delegated decisions consistently. Keep mutation experiments out of an untouched review checkout and identify illustrative budgets as project-dependent.

Acceptance: inspect all matching checklists/tables/examples for the same contract; a mechanical multi-file task remains permissible; replacement does not prescribe a broken intermediate commit; review-only and irreversible-migration examples preserve user work and report their real limits.

Dependencies: none. Likely files: planning/spec/incremental/interview/review guidance and relevant references.

**T07 — Standardize review synthesis and plugin dispatch (D01, D02, C19).**

Carry the existing severity taxonomy across personas and all command adapters, use plugin-scoped identifiers where required, and distinguish supported local-agent fields from plugin-agent restrictions.

Acceptance: a synthetic Required-only review blocks shipping; a permitted explicit deferral is retained in the summary; optional/nit findings remain advisory. Dispatch identifiers match discovered or officially documented registrations, with native catalog checks separated from model behavior.

Dependencies: T06. Likely files: three command surfaces, personas, orchestration and agent docs.

**T08 — Correct remaining technical examples and capture contracts (C12–C18, C20, C21, D10, D11).**

Correct fixed-window terminology, query-plan diagnosis, HTML label syntax, E2E selectors/target nodes, fork-preview secret assumptions, dependency-cache descriptions, sparse-array rewrite preconditions, and runbook steps/metric scope. Preserve sensitive-page no-store policy. Separate standalone Lighthouse performance reports from MCP non-performance audits and performance traces.

Acceptance: targeted behavioral/HTML/browser/configuration checks exercise the corrected claims; missing metrics remain unmeasured; fork PR validation works without secrets; sensitive-response policy is preserved. Conditional array/markup assumptions are stated rather than presented as universal guarantees.

Dependencies: T02 and T05 where shared example infrastructure is needed. C13/D11 are one overlapping no-store issue, not two separate fixes.

### Phase 3: Make installation, documentation and maintenance dependable

**T09 — Repair consumer setup and inherited host guides (D03–D07, D09, D12, C11, O04, M03).**

Correct Gemini schema/settings examples, Cursor rule paths, OpenCode platform/convention claims, and modern Windsurf/Devin guidance. Preserve existing instruction files, stop copying repository-scoped AGENTS.md, and correct the broken shared-reference workaround. Use thin, consistent consumer policy templates and explicit support-status labels.

Acceptance: temporary consumer projects keep sentinel instructions unchanged; documented references/helpers resolve in the declared supported layout; examples match current official schemas/paths; rule files fit documented limits. No unsupported host is silently called runtime-verified. Full-pack distribution remains supported; standalone bundles remain optional.

Dependencies: T06 and T07. Likely files: host guides, README/getting-started/anatomy/contribution docs, root conventions and setup examples.

**T10 — Generate the catalog and contributor inventories (M01, RT-M3).**

Generate repeated skill/phase lists and issue-form choices from validated catalog metadata. Derive or check runtime/check/script inventory claims, and replace the stale 100% routing statement with truthful measured reporting.

Acceptance: all 25 skills, including constraint-driven-development, appear on every applicable generated surface; unknown/duplicate/missing entries fail; regeneration is deterministic; intentional drift fails CI; unrelated prose survives.

Dependencies: T02; serialize changes to shared skill/docs files after T06–T09 rather than letting concurrent writers overwrite one another.

**T11 — Test the actual candidate installation and pin tools (D08, M02).**

Install the candidate through a temporary local-source marketplace or native equivalent; assert installed file/manifest identity against the checkout. Retain Claude compatibility checks and add the supported native Codex path where free catalog/install inspection permits it. Pin tested CLI versions and record actual versions/runtime requirements.

Acceptance: a candidate-only sentinel cannot be satisfied by installing the default branch; all 25 skills and shared resources are present; the required-check contract includes hook regressions; remote distribution smoke checks are labeled separately. No model calls or real-user-profile writes occur. Changes to account branch-protection settings or main-branch merges are outside this implementation contract.

Dependencies: T02 and T09; CI integration is owned centrally.

**T12 — Consolidate portable free verification (RT-B6, RT-E3, M01).**

Provide one documented free verification entry point, clean every test-created temporary root, make mode assertions portable, and test the real version validator's negative cases.

Acceptance: the same supported verification command runs on Linux/macOS/Windows, reports named platform skips, leaves no leaked fixture directories, catches manifest mismatch/missing-file errors, and cannot invoke a paid backend by default.

Dependencies: T02, T03 and T11.

### Phase 4: Make behavioral evaluation capable of measuring its claims

**T13 — Bound evidence collection beyond file bytes (RT-E1).**

Add explicit entry/depth/manifest/collection budgets while preserving existing byte and leaf-identity safeguards. Document resource defaults, exercise small limits deterministically, and prioritize declared required artifacts so dependency trees do not silently crowd them out.

Acceptance: empty-file/deep trees stop within configured bounds, omissions and incomplete evidence remain explicit, retained hashes stay correct, and unavailable required artifacts cannot silently be graded as established.

Dependencies: T04.

**T14 — Make case prerequisites and fixtures executable (RT-M2).**

Declare required backend/tool/browser/build capabilities and preflight before spending model tokens. Supply minimal viable UI/build/server scaffolds where the existing task requires them, preserving intentionally planted task defects.

Acceptance: eligible fixture projects start/compile using their declared setup; missing capabilities produce an explicit not-run/unavailable result with zero executor/grader calls; browser evidence is required when the rubric asks for it.

Dependencies: T03, T04, T05 and T12.

**T15 — Support scripted multi-turn and artifact-aware cases (RT-M1).**

Represent scripted user turns explicitly, retain per-turn inputs/events/status/model observations, and bind artifact expectations to actual workspace evidence. Preserve backwards compatibility for valid single-turn cases. Before enabling a native multi-turn adapter, establish the pinned CLI's documented session/resume protocol and its workspace, permission, approval, and model-context continuity using current official documentation and free inspection. Unsupported or uncertain adapters decline multi-turn before executor or grader calls.

Acceptance: fake backend runs prove ordered turns, appropriate stop/approval behavior, turn limits, failure retention and final artifact binding; conversation-only cases remain conversation-only; artifact cases do not waive their file/command criteria. Fake tests verify our bookkeeping, not native session continuity. Live provider conversation behavior remains separately unmeasured until explicitly requested. If the documented protocol cannot meet the case contract, report that adapter as unsupported rather than claiming complete native support.

Dependencies: T03, T04, T13 and T14.

**T16 — Add historical transcript regrading.**

Record stable trace/evidence fingerprints at creation, validate task/provenance compatibility, run only the selected grader against retained evidence, and keep every grading attempt separate.

Acceptance: changed/tampered inputs are rejected before grading, no executor runs, originals remain unchanged, requested/observed identities stay honest, and results are labeled historical rather than evidence of newly changed skill behavior. Older records without sufficient fingerprints are explicitly unsupported or qualified; they are not silently certified.

Dependencies: T04, T13 and T15. Tests use fake responses; actual regrading calls need a separate explicit request.

### Phase 5: Close the entire selected scope

**T17 — Finish runnable-example coverage and integrated review.**

Classify every published example as locally runnable, a declared fragment, or an external-service recipe. Attach appropriate compile/behavior/schema checks to runnable examples, maintain the complete finding-to-task/evidence register, and run the consolidated suite plus final exact-head CI.

Acceptance: every selected finding is fixed with evidence or explicitly resolved through an accepted clarification/deferral; no runnable example is called tested without a receipt; all generated surfaces are current; source/package compatibility is preserved; native/model limitations remain explicit. Final handoff includes commits/PRs, verified results, accepted deferrals, and still-unmeasured behavior.

Dependencies: T01–T16.

## Parallel work and ownership

Use all three available subagent slots where tasks are independent. Separate guard/content, metadata/docs/catalog, and eval-runtime ownership. One owner integrates dependency manifests/lockfiles and CI. Serialize generator writes across skill bodies/documents after the corresponding content edits; never let agents concurrently rewrite a shared file. Use independent adversarial review for risky guard/evidence/rollback changes and merge reports centrally.

There is no artificial five-file cap. Task boundaries follow independent outcomes and verification. Checkpoints record evidence; they do not request repeated approval for already-approved work.

## Optional proposals and explicitly deferred measurements

These remain outside the selected implementation scope: new top-level skills, repository-memory/learning systems, multi-agent artifact registries, HUMAN.md protocols, generated standalone bundles, and additional native host integrations.

Natural Codex plugin routing, plugin-versus-baseline outcome comparisons, Gemini runtime behavior, and comparative model performance require separately scoped evaluation. Paid runs are never implied by approval of this plan. Broad third-party competitive claims will be dated, qualified, or removed when unsupported rather than advertised as measured.

## Approval boundary

Your approval would authorize the selected T01–T17 source/test/documentation changes, justified pinned contributor dependencies, isolated free checks/install inspections, logical commits, and draft PR delivery in your fork. It would not authorize paid model runs, real-user-profile installation, deployment, main-branch merging, upstream publication, or unrelated new capabilities.

**No implementation begins until you explicitly approve this plan.**


## Individual review verdicts for all 25 skills

Sound workflow bodies stay unchanged except justified catalog metadata. Resource/example findings are distinguished from defects in the core workflow.

| Skill | Remaining review verdict |
|---|---|
| api-and-interface-design | No confirmed defect; O02 conditional idempotency guidance |
| browser-testing-with-devtools | No confirmed defect; O04 host setup routing |
| ci-cd-and-automation | C17, C18 |
| code-review-and-quality | No confirmed runtime defect; O01 review/mutation scope |
| code-simplification | C20; impact depends on accepted array contract |
| constraint-driven-development | Workflow sound; referenced helper defects C01, C02 |
| context-engineering | C11; heuristic calibration O05 |
| debugging-and-error-recovery | C03 |
| deprecation-and-migration | Sound after prior fixes; canonical recovery wording exposes C09 elsewhere |
| documentation-and-adrs | C12 |
| doubt-driven-development | Sound; no forced change |
| frontend-ui-engineering | C04, C05; O03 accessibility evidence, O05 size heuristic |
| git-workflow-and-versioning | Sound after prior fixes; O05 size heuristic only |
| idea-refine | Sound; phase/trigger overlap decision only |
| incremental-implementation | C08, C09 |
| interview-me | C10 residual contradictory table |
| observability-and-instrumentation | C21 |
| performance-optimization | C14 shared diagnosis; O05 budget calibration |
| planning-and-task-breakdown | C07 residual checklist contradiction |
| security-and-hardening | Rules sound after prior fixes; response pattern C06 and O06 prerequisites in local resource |
| shipping-and-launch | Sound after prior fixes; deployment policies are project choices |
| source-driven-development | Sound version detection and content trust after prior fixes |
| spec-driven-development | C07 duplicated task cap |
| test-driven-development | Sound characterization/proportionality after prior fixes |
| using-agent-skills | Sound proportional scope and existing authorization |

## Finding to task register

The detailed JSON supplies exact locations, evidence, confidence, remedies and verification proposals. C13 and D11 are duplicate cross-review coverage of one no-store issue. Conditional findings are clarified or bounded rather than advertised as proven defects in unseen applications.

| Finding | Remaining issue or opportunity | Planned disposition |
|---|---|---|
| C01 | Git-quoted paths silently evade the floor guard | T01 |
| C02 | Violation diagnostics expose matched source values despite redaction contract | T01 |
| C03 | The graceful-degradation try/catch cannot catch a child React render failure | T05 |
| C04 | The data-container error branch references undeclared refetch | T05 |
| C05 | Optimistic whole-list rollback erases unrelated successful mutations | T05 |
| C06 | Public-user projection is a denylist that leaks new sensitive fields | T05 |
| C07 | Mandatory five-file exit gate contradicts proportional task sizing | T06 |
| C08 | Separating deletion and replacement creates broken intermediate commits | T06 |
| C09 | Unconditional down-migration requirement conflicts with destructive data recovery | T06 |
| C10 | Rationalization table still requires re-asking delegated decisions | T06 |
| C11 | Cursor project-rule filename extension is wrong | T09 |
| C12 | The example comment falsely calls a fixed-window reset a sliding window | T08 |
| C13 | Blanket removal of Cache-Control no-store sacrifices sensitive-page policy for outdated bfcache guidance | T08 |
| C14 | Query-plan diagnosis treats estimation error as proof of stale statistics | T08 |
| C15 | The HTML label example uses JSX-only htmlFor | T08 |
| C16 | E2E example confuses list-item text with accessible name and asserts CSS on the wrong node | T08 |
| C17 | The preview job still requires a repository secret on every fork PR | T08 |
| C18 | setup-node cache is incorrectly described as caching node_modules | T08 |
| C19 | Subagent MCP-frontmatter claim contradicts this pack's plugin restrictions | T07 |
| C20 | Array loop-to-filter rewrite changes sparse-array error behavior | T08 |
| C21 | The minimum runbook references a nonexistent Step 2 and compares global sessions to one pool | T08 |
| O01 | Scope mutation experiments and make review-only checkout preservation explicit | T06 |
| O02 | Specify idempotency-key security scope and unknown-outcome reconciliation | Deferred conditional clarification |
| O03 | Show accessible names in the primary task-item example | T05 |
| O04 | Use host-native MCP setup routing for Codex-first installs | T09 |
| O05 | Label task-size, UI-size and performance budgets as project-specific heuristics | T06 |
| O06 | Name production Express session-store and proxy prerequisites | T05 |
| RT-B1 | Frontmatter parsing has false accepts and false rejects | T02 |
| RT-B2 | Command validator accepts broken TOML prompt bodies | T02 |
| RT-B3 | Unknown CLI flags silently bypass requested routing controls | T03 |
| RT-B4 | Nested explicit-file fixtures silently skip declared setup patches | T04 |
| RT-B5 | Setup snapshot failures leave unjournaled partial run directories | T04 |
| RT-B6 | Two test fixture factories leak temporary directories | T12 |
| RT-M1 | Single-turn dialogue execution cannot establish all declared dialogue outcomes | T15 |
| RT-M2 | Some behavioral tasks lack executable scaffolds or declared backend prerequisites | T14 |
| RT-M3 | Documented checked-in routing baseline is stale | T10 |
| RT-E1 | Bound archive traversal and manifest growth as well as file bytes | T13 |
| RT-E2 | Unify case validation and strengthen malformed-evidence parity | T03 |
| RT-E3 | Make free verification more portable and maintainable | T12 |
| D01 | host integration; see detailed evidence record | T07 |
| D02 | review contract; see detailed evidence record | T07 |
| D03 | invalid runnable example; see detailed evidence record | T09 |
| D04 | configuration documentation; see detailed evidence record | T09 |
| D05 | instruction scope; see detailed evidence record | T09 |
| D06 | setup data preservation; see detailed evidence record | T09 |
| D07 | portability/documentation; see detailed evidence record | T09 |
| D08 | CI verification; see detailed evidence record | T11 |
| D09 | host guide modernization; see detailed evidence record | T09 |
| D10 | current tooling contract; see detailed evidence record | T08 |
| D11 | security/performance guidance; see detailed evidence record | T08 |
| D12 | OpenCode integration; see detailed evidence record | T09 |
| M01 | Catalog, runtime and contributor-check inventory drift | T10, T12 |
| M02 | Unpinned CI tools and required-check contract | T11 |
| M03 | Inherited host-template policy drift and dated support claims | T09 |

O02 remains a conditional API-idempotency clarification: actor/key/replay behavior is unshown, so no actual security failure is claimed. Revisit it against a concrete integration rather than invent an implementation. Task T16 was explicitly selected during grilling; its justification is the retained-evidence regrading proposal, not a claimed current runtime bug.
