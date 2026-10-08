'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runBehavioral } = require('./run-evals');

function withRepository(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'behavioral-eval-test-'));
  const files = {
    '.claude-plugin/plugin.json': JSON.stringify({ name: 'test-pack', version: '1.0.0', skills: './skills' }),
    'skills/alpha-skill/SKILL.md': '---\nname: alpha-skill\ndescription: Handles widgets. Use when changing widgets.\n---\n\nRead frameworks.md and ../../references/checklist.md.\n',
    'skills/alpha-skill/frameworks.md': 'Supporting framework\n',
    'skills/beta-skill/SKILL.md': '---\nname: beta-skill\ndescription: Reviews widgets. Use when reviewing widgets.\n---\n',
    'references/checklist.md': 'Shared checklist\n',
    'agents/reviewer.md': 'Review persona\n',
    'evals/fixtures/project/context.txt': 'Fixture context\n',
    'evals/cases/alpha-skill.json': JSON.stringify({
      skill_name: 'alpha-skill',
      evals: [{ id: 1, prompt: 'Inspect the fixture.', files: ['project'], expectations: ['The fixture is read'] }],
    }),
  };
  for (const [relative, content] of Object.entries(files)) {
    const dest = path.join(root, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  try { return callback(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

const grading = {
  expectations: [{ id: 1, text: 'The fixture is read', passed: true, evidence: 'Read tool result' }],
  summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
};

function fakeClaude(calls, failGrader = false) {
  return (command, args, options = {}) => {
    assert.equal(command, 'claude');
    calls.push({ args, options });
    if (args.includes('--version')) return '2.1.278 (Claude Code)\n';
    if (args.includes('--plugin-dir')) {
      const plugin = args[args.indexOf('--plugin-dir') + 1];
      const skill = path.join(plugin, 'skills', 'alpha-skill');
      assert.equal(fs.readFileSync(path.join(skill, 'frameworks.md'), 'utf8'), 'Supporting framework\n');
      assert.equal(fs.readFileSync(path.resolve(skill, '../../references/checklist.md'), 'utf8'), 'Shared checklist\n');
      assert.ok(fs.existsSync(path.join(plugin, 'skills', 'beta-skill', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(plugin, 'agents', 'reviewer.md')));
      assert.equal(fs.readFileSync(path.join(options.cwd, 'project', 'context.txt'), 'utf8'), 'Fixture context\n');
      // Package assets must not enter the fixture's commit history.
      assert.ok(!fs.existsSync(path.join(options.cwd, 'skills')));
      return '{"type":"system","subtype":"init","model":"executor-resolved"}\n{"type":"result","subtype":"success","result":"done"}\n';
    }
    if (failGrader) {
      const error = new Error('grader failed');
      error.stdout = 'partial grader output';
      error.stderr = 'failure diagnostic';
      throw error;
    }
    return JSON.stringify({ type: 'result', subtype: 'success', result: JSON.stringify(grading), modelUsage: { 'grader-resolved': { inputTokens: 1 } } });
  };
}

test('loads the complete plugin and persists explicit and observed model identities', () => withRepository((root) => {
  const calls = [];
  const result = runBehavioral('alpha-skill', {
    root, executorModel: 'executor-pinned', graderModel: 'grader-pinned', invokeClaude: fakeClaude(calls),
  });
  assert.equal(result.failures, 0);
  const base = path.join(result.runDir, 'alpha-skill.eval-1');
  const saved = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
  assert.equal(saved.run.executor_model_requested, 'executor-pinned');
  assert.equal(saved.run.grader_model_requested, 'grader-pinned');
  assert.equal(saved.run.executor_model, 'executor-resolved');
  assert.deepEqual(saved.run.grader_models, ['grader-resolved']);
  assert.equal(saved.run.claude_version, '2.1.278 (Claude Code)');
  assert.match(saved.run.package_sha256, /^[a-f0-9]{64}$/);
  assert.ok(fs.readFileSync(`${base}.trace.jsonl`, 'utf8').includes('executor-resolved'));
  assert.ok(fs.existsSync(`${base}.grader-response.json`));
  assert.ok(fs.existsSync(path.join(result.runDir, 'case.json')));
  assert.ok(fs.existsSync(path.join(result.runDir, 'fixtures', 'project', 'context.txt')));
  const executor = calls.find((call) => call.args.includes('--plugin-dir'));
  assert.equal(executor.args[executor.args.indexOf('--model') + 1], 'executor-pinned');
  const grader = calls.find((call) => call.args.includes('--output-format') && !call.args.includes('--plugin-dir'));
  assert.equal(grader.args[grader.args.indexOf('--model') + 1], 'grader-pinned');
  assert.equal(grader.args[grader.args.indexOf('--tools') + 1], '');
  assert.ok(grader.args.includes('--safe-mode'));
  assert.notEqual(grader.options.cwd, executor.options.cwd);
  assert.match(grader.options.input, /===TRACE START===/);
  assert.ok(!fs.existsSync(executor.options.cwd), 'fixture workspace is cleaned up');
  assert.ok(!fs.existsSync(grader.options.cwd), 'grader workspace is cleaned up');
}));

test('retains prior run evidence when the next grader fails', () => withRepository((root) => {
  const options = { root, executorModel: 'executor-pinned', graderModel: 'grader-pinned' };
  const first = runBehavioral('alpha-skill', { ...options, invokeClaude: fakeClaude([]) });
  const firstEvidence = fs.readFileSync(path.join(first.runDir, 'alpha-skill.eval-1.grading.json'), 'utf8');
  const calls = [];
  const second = runBehavioral('alpha-skill', { ...options, invokeClaude: fakeClaude(calls, true) });
  assert.equal(second.failures, 1);
  assert.notEqual(first.runDir, second.runDir);
  assert.equal(fs.readFileSync(path.join(first.runDir, 'alpha-skill.eval-1.grading.json'), 'utf8'), firstEvidence);
  const base = path.join(second.runDir, 'alpha-skill.eval-1');
  assert.ok(fs.existsSync(`${base}.trace.jsonl`));
  assert.equal(fs.readFileSync(`${base}.grader.stdout.txt`, 'utf8'), 'partial grader output');
  assert.equal(fs.readFileSync(`${base}.grader.stderr.txt`, 'utf8'), 'failure diagnostic');
  assert.equal(JSON.parse(fs.readFileSync(`${base}.run.json`, 'utf8')).status, 'failed');
  assert.ok(!fs.existsSync(calls.find((call) => call.args.includes('--plugin-dir')).options.cwd));
}));

test('rejects unpinned live runs before invoking the CLI or creating results', () => withRepository((root) => {
  let calls = 0;
  assert.throws(() => runBehavioral('alpha-skill', { root, invokeClaude: () => { calls++; } }), /executor-model.*grader-model/);
  assert.equal(calls, 0);
  assert.ok(!fs.existsSync(path.join(root, 'evals', 'results')));
}));

test('dry run is free and does not create evidence or invoke the CLI', () => withRepository((root) => {
  const result = runBehavioral('alpha-skill', { root, dryRun: true, invokeClaude: () => { throw new Error('unexpected CLI call'); } });
  assert.equal(result.failures, 0);
  assert.equal(result.runDir, null);
  assert.ok(!fs.existsSync(path.join(root, 'evals', 'results')));
}));

test('an executor error result is retained and never sent to the grader', () => withRepository((root) => {
  const calls = [];
  const provider = fakeClaude(calls);
  const result = runBehavioral('alpha-skill', {
    root, executorModel: 'executor-pinned', graderModel: 'grader-pinned',
    invokeClaude(command, args, options) {
      if (args.includes('--plugin-dir')) {
        calls.push({ args, options });
        return '{"type":"system","subtype":"init","model":"executor-resolved"}\n{"type":"result","subtype":"error_max_turns","is_error":true}\n';
      }
      return provider(command, args, options);
    },
  });
  assert.equal(result.failures, 1);
  assert.equal(calls.length, 2, 'only version check and executor ran');
  const base = path.join(result.runDir, 'alpha-skill.eval-1');
  assert.ok(fs.readFileSync(`${base}.trace.jsonl`, 'utf8').includes('error_max_turns'));
  assert.ok(!fs.existsSync(`${base}.grading.json`));
  assert.equal(JSON.parse(fs.readFileSync(`${base}.run.json`, 'utf8')).failure_phase, 'executor');
}));

test('malformed grading retains the full executor trace and grader response', () => withRepository((root) => {
  const provider = fakeClaude([]);
  const result = runBehavioral('alpha-skill', {
    root, executorModel: 'executor-pinned', graderModel: 'grader-pinned',
    invokeClaude(command, args, options) {
      if (!args.includes('--version') && !args.includes('--plugin-dir')) return 'broken JSON';
      return provider(command, args, options);
    },
  });
  assert.equal(result.failures, 1);
  const base = path.join(result.runDir, 'alpha-skill.eval-1');
  assert.equal(fs.readFileSync(`${base}.grader-response.json`, 'utf8'), 'broken JSON');
  assert.ok(fs.existsSync(`${base}.trace.jsonl`));
  assert.ok(!fs.existsSync(`${base}.grading.json`));
}));

test('duplicate case IDs fail before any provider call or result directory', () => withRepository((root) => {
  const caseFile = path.join(root, 'evals', 'cases', 'alpha-skill.json');
  const data = JSON.parse(fs.readFileSync(caseFile, 'utf8'));
  data.evals.push({ ...data.evals[0] });
  fs.writeFileSync(caseFile, JSON.stringify(data));
  assert.throws(() => runBehavioral('alpha-skill', {
    root, executorModel: 'executor-pinned', graderModel: 'grader-pinned',
    invokeClaude: () => { throw new Error('unexpected provider call'); },
  }), /unique positive integers/);
  assert.ok(!fs.existsSync(path.join(root, 'evals', 'results')));
}));

test('provisional execution cases cannot spend tokens through the live path', () => withRepository((root) => {
  const caseFile = path.join(root, 'evals', 'cases', 'alpha-skill.json');
  const data = JSON.parse(fs.readFileSync(caseFile, 'utf8'));
  data.evals[0].trust_level = 'provisional';
  fs.writeFileSync(caseFile, JSON.stringify(data));
  assert.throws(() => runBehavioral('alpha-skill', {
    root, executorModel: 'executor-pinned', graderModel: 'grader-pinned',
    invokeClaude: () => { throw new Error('unexpected provider call'); },
  }), /still provisional/);
  assert.ok(!fs.existsSync(path.join(root, 'evals', 'results')));
}));

test('case and input snapshots are stable across runs and track changed fixture content', () => withRepository((root) => {
  const options = { root, executorModel: 'executor-pinned', graderModel: 'grader-pinned' };
  const first = runBehavioral('alpha-skill', { ...options, invokeClaude: fakeClaude([]) });
  const second = runBehavioral('alpha-skill', { ...options, invokeClaude: fakeClaude([]) });
  const readMeta = (result) => JSON.parse(fs.readFileSync(path.join(result.runDir, 'run.json'), 'utf8'));
  assert.notEqual(first.runDir, second.runDir);
  for (const field of ['package_sha256', 'fixtures_sha256', 'case_sha256']) assert.equal(readMeta(first)[field], readMeta(second)[field]);
  fs.writeFileSync(path.join(root, 'evals', 'fixtures', 'project', 'context.txt'), 'Changed fixture\n');
  const third = runBehavioral('alpha-skill', {
    ...options,
    invokeClaude(command, args) {
      if (args.includes('--version')) return '2.1.278 (Claude Code)';
      if (args.includes('--plugin-dir')) return '{"type":"result","subtype":"success","result":"done"}\n';
      return JSON.stringify({ type: 'result', subtype: 'success', result: JSON.stringify(grading) });
    },
  });
  assert.notEqual(readMeta(first).fixtures_sha256, readMeta(third).fixtures_sha256);
  assert.equal(readMeta(first).package_sha256, readMeta(third).package_sha256);
  assert.equal(fs.readFileSync(path.join(first.runDir, 'fixtures', 'project', 'context.txt'), 'utf8'), 'Fixture context\n');
}));

test('dialogue evals work without fixtures and honor any declared context files', () => withRepository((root) => {
  for (const files of [[], ['project']]) {
    const caseFile = path.join(root, 'evals', 'cases', 'alpha-skill.json');
    const data = JSON.parse(fs.readFileSync(caseFile, 'utf8'));
    data.evals[0].kind = 'dialogue';
    data.evals[0].files = files;
    fs.writeFileSync(caseFile, JSON.stringify(data));
    const result = runBehavioral('alpha-skill', {
      root, executorModel: 'executor-pinned', graderModel: 'grader-pinned',
      invokeClaude(command, args, options) {
        if (args.includes('--version')) return '2.1.278 (Claude Code)';
        if (args.includes('--plugin-dir')) {
          if (files.length) assert.equal(fs.readFileSync(path.join(options.cwd, 'project', 'context.txt'), 'utf8'), 'Fixture context\n');
          else assert.deepEqual(fs.readdirSync(options.cwd), []);
          return '{"type":"system","subtype":"init","model":"executor-resolved"}\n{"type":"result","subtype":"success","result":"done"}\n';
        }
        assert.match(options.input, /Judge conversational behavior/);
        assert.match(options.input, /Do not require file edits/);
        return JSON.stringify({ type: 'result', subtype: 'success', result: JSON.stringify(grading) });
      },
    });
    assert.equal(result.failures, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(result.runDir, 'alpha-skill.eval-1.run.json'), 'utf8')).kind, 'dialogue');
  }
}));
