'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runBehavioral } = require('./run-evals');

const grade = {
  expectations: [{ id: 1, text: 'The fixture is read', passed: true, evidence: 'observed command output' }],
  summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
};

function withRepository(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-eval-test-'));
  const files = {
    '.codex-plugin/plugin.json': JSON.stringify({ name: 'codex-test-pack', version: '1.0.0', skills: './skills/' }),
    'skills/alpha-skill/SKILL.md': '---\nname: alpha-skill\ndescription: Handles widgets. Use when changing widgets.\n---\nRead frameworks.md and ../../references/checklist.md.\n',
    'skills/alpha-skill/frameworks.md': 'Supporting framework\n',
    'references/checklist.md': 'Shared checklist\n',
    'evals/fixtures/project/context.txt': 'Fixture context\n',
    'evals/cases/alpha-skill.json': JSON.stringify({ skill_name: 'alpha-skill', evals: [
      { id: 1, prompt: 'Inspect the fixture.', files: ['project'], expectations: ['The fixture is read'] },
    ] }),
  };
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  }
  try { return callback(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function trace(finalText = 'done', terminal = 'turn.completed', model) {
  return [
    JSON.stringify({ type: 'thread.started', thread_id: 'test-thread', ...(model ? { model } : {}) }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item-1', type: 'agent_message', text: finalText } }),
    JSON.stringify({ type: terminal, usage: { input_tokens: 1, output_tokens: 1 } }),
  ].join('\n') + '\n';
}

function fakeCodex(calls, terminal = 'turn.completed') {
  return (command, args, options) => {
    assert.equal(command, 'codex', 'no Claude dependency for Codex-backed runs');
    calls.push({ args, options });
    if (args.includes('--version')) return 'codex-cli 0.151.0\n';
    assert.equal(args[0], 'exec');
    assert.ok(args.includes('--json'));
    assert.ok(args.includes('--ephemeral'));
    assert.ok(args.includes('--ignore-user-config'));
    assert.equal(args.at(-1), '-', 'prompt is passed on stdin, not through shell interpolation');
    assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
    assert.equal(args[args.indexOf('--model') + 1], args.includes('--output-schema') ? 'grader-pinned' : 'executor-pinned');
    if (args.includes('--output-schema')) {
      assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
      const schema = JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema') + 1], 'utf8'));
      assert.equal(schema.type, 'object');
      assert.deepEqual(schema.required, ['expectations', 'summary']);
      assert.match(options.input, /===TRACE START===/);
      assert.ok(args.includes('shell_tool'));
      assert.ok(args.includes('multi_agent'));
      return trace(JSON.stringify(grade));
    }
    assert.equal(args[args.indexOf('--sandbox') + 1], 'workspace-write');
    assert.equal(args[args.indexOf('--add-dir') + 1], path.join(options.cwd, '.git'));
    assert.match(options.input, /\$alpha-skill/);
    const skillMatch = options.input.match(/Skill file: (.+)\n/);
    assert.ok(skillMatch, 'the complete skill is selected by its exact snapshotted path');
    const skill = path.dirname(skillMatch[1]);
    assert.equal(fs.readFileSync(path.join(skill, 'frameworks.md'), 'utf8'), 'Supporting framework\n');
    assert.equal(fs.readFileSync(path.resolve(skill, '../../references/checklist.md'), 'utf8'), 'Shared checklist\n');
    assert.equal(fs.readFileSync(path.join(options.cwd, 'project/context.txt'), 'utf8'), 'Fixture context\n');
    assert.ok(!fs.existsSync(path.join(options.cwd, 'skills')));
    return trace('done', terminal);
  };
}

test('Codex executes and grades with native events, explicit models, and retained evidence', () => withRepository((root) => {
  const calls = [];
  const result = runBehavioral('alpha-skill', {
    root, backend: 'codex', executorModel: 'executor-pinned', graderModel: 'grader-pinned', invokeCodex: fakeCodex(calls),
  });
  assert.equal(result.failures, 0);
  assert.equal(calls.length, 3);
  const base = path.join(result.runDir, 'alpha-skill.eval-1');
  const saved = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
  assert.equal(saved.run.backend, 'codex');
  assert.equal(saved.run.codex_version, 'codex-cli 0.151.0');
  assert.equal(saved.run.skill_loading, 'explicit-path');
  assert.equal(saved.run.executor_model, null, 'unreported resolved model must not be inferred from requested model');
  assert.deepEqual(saved.run.grader_models, []);
  assert.equal(saved.run.grader_model, null);
  assert.ok(fs.readFileSync(`${base}.trace.jsonl`, 'utf8').includes('turn.completed'));
  assert.ok(fs.existsSync(`${base}.grader-response.jsonl`));
  for (const call of calls.filter((call) => call.args.includes('exec'))) assert.ok(!fs.existsSync(call.options.cwd));
}));

test('failed Codex turns never reach the grader', () => withRepository((root) => {
  const calls = [];
  const result = runBehavioral('alpha-skill', {
    root, backend: 'codex', executorModel: 'executor-pinned', graderModel: 'grader-pinned', invokeCodex: fakeCodex(calls, 'turn.failed'),
  });
  assert.equal(result.failures, 1);
  assert.equal(calls.length, 2);
  const base = path.join(result.runDir, 'alpha-skill.eval-1');
  assert.ok(fs.readFileSync(`${base}.trace.jsonl`, 'utf8').includes('turn.failed'));
  assert.ok(!fs.existsSync(`${base}.grading.json`));
}));

test('Codex dry-run needs no Claude manifest or provider calls', () => withRepository((root) => {
  const result = runBehavioral('alpha-skill', {
    root, backend: 'codex', dryRun: true, invokeCodex: () => { throw new Error('unexpected provider call'); },
  });
  assert.equal(result.failures, 0);
  assert.equal(result.runDir, null);
  assert.ok(!fs.existsSync(path.join(root, 'evals/results')));
}));

test('an unknown backend fails before any provider call', () => withRepository((root) => {
  assert.throws(() => runBehavioral('alpha-skill', {
    root, backend: 'unknown', executorModel: 'executor-pinned', graderModel: 'grader-pinned',
    invokeCodex: () => { throw new Error('unexpected provider call'); },
  }), /Unsupported.*backend/);
}));

for (const [label, incomplete] of [
  ['missing completion', trace().split('\n').slice(0, -2).join('\n') + '\n'],
  ['a subsequent unfinished turn', trace() + JSON.stringify({ type: 'turn.started' }) + '\n'],
]) {
  test(`Codex rejects ${label} and never grades it`, () => withRepository((root) => {
    const calls = [];
    const invoke = fakeCodex(calls);
    const result = runBehavioral('alpha-skill', {
      root, backend: 'codex', executorModel: 'executor-pinned', graderModel: 'grader-pinned',
      invokeCodex: (command, args, options) => {
        const raw = invoke(command, args, options);
        return args.includes('exec') && !args.includes('--output-schema') ? incomplete : raw;
      },
    });
    assert.equal(result.failures, 1);
    assert.equal(calls.length, 2);
    assert.ok(!fs.existsSync(path.join(result.runDir, 'alpha-skill.eval-1.grading.json')));
  }));
}

for (const [label, invalid] of [
  ['a failed grader turn', trace(JSON.stringify(grade), 'turn.failed')],
  ['a completed turn without an assistant message', JSON.stringify({ type: 'turn.completed' }) + '\n'],
  ['an invalid grading payload', trace('{invalid JSON')],
]) {
  test(`Codex retains ${label} as evidence without a passing grade`, () => withRepository((root) => {
    const calls = [];
    const invoke = fakeCodex(calls);
    const result = runBehavioral('alpha-skill', {
      root, backend: 'codex', executorModel: 'executor-pinned', graderModel: 'grader-pinned',
      invokeCodex: (command, args, options) => {
        const raw = invoke(command, args, options);
        return args.includes('--output-schema') ? invalid : raw;
      },
    });
    assert.equal(result.failures, 1);
    const base = path.join(result.runDir, 'alpha-skill.eval-1');
    assert.equal(fs.readFileSync(`${base}.grader-response.jsonl`, 'utf8'), invalid);
    assert.ok(!fs.existsSync(`${base}.grading.json`));
    assert.equal(JSON.parse(fs.readFileSync(`${base}.run.json`, 'utf8')).status, 'failed');
  }));
}

test('Codex records reported model identities independently from requested IDs', () => withRepository((root) => {
  const calls = [];
  const invoke = fakeCodex(calls);
  const result = runBehavioral('alpha-skill', {
    root, backend: 'codex', executorModel: 'executor-pinned', graderModel: 'grader-pinned',
    invokeCodex: (command, args, options) => {
      const raw = invoke(command, args, options);
      if (!args.includes('exec')) return raw;
      return args.includes('--output-schema')
        ? trace(JSON.stringify(grade), 'turn.completed', 'grader-observed')
        : trace('done', 'turn.completed', 'executor-observed');
    },
  });
  const saved = JSON.parse(fs.readFileSync(path.join(result.runDir, 'alpha-skill.eval-1.grading.json'), 'utf8'));
  assert.equal(saved.run.executor_model, 'executor-observed');
  assert.equal(saved.run.grader_model, 'grader-observed');
  assert.equal(saved.run.executor_model_requested, 'executor-pinned');
  assert.equal(saved.run.grader_model_requested, 'grader-pinned');
}));
