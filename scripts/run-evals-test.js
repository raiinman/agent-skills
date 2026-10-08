#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { materializeWorkspace, snapshotWorkspace, runBehavioral, parseGrading, clearGradingSlot, persistGradingOutcome, extractExecutorModel, tokenize, buildCorpus, rankSkills } = require('./run-evals');

const RUNNER = path.join(__dirname, 'run-evals.js');

test('routing bridges common abbreviations without conflating authentication and authorization', () => {
  for (const [short, long] of [['docs', 'documentation'], ['doc', 'document'], ['config', 'configuration'],
    ['auth', 'authentication'], ['deps', 'dependencies'], ['repo', 'repository']]) {
    assert.deepEqual(tokenize(short), tokenize(long), `${short} should match ${long}`);
  }
  assert.notDeepEqual(tokenize('authentication'), tokenize('authorization'));
});

test('realistic clipped prompts route to the same owning skills as their long forms', () => {
  const skills = fs.readdirSync(path.join(__dirname, '..', 'skills')).map((name) => ({
    name,
    description: fs.readFileSync(path.join(__dirname, '..', 'skills', name, 'SKILL.md'), 'utf8')
      .match(/^description: (.+)$/m)[1],
  }));
  const corpus = buildCorpus(skills);
  for (const [prompt, owner] of [
    ['Add auth to our API endpoints', 'security-and-hardening'],
    ['Our docs are out of date with the code', 'documentation-and-adrs'],
  ]) {
    assert.ok(rankSkills(prompt, corpus).slice(0, 3).some((item) => item.name === owner), prompt);
  }
});

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeSkill(root, name, description) {
  const dir = path.join(root, 'skills', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
  );
}

function behavioralEval(files = ['project/context.txt']) {
  return {
    id: 1,
    prompt: 'Inspect the attached project and complete the requested work.',
    expected_output: 'A verified result grounded in the attached project',
    files,
    expectations: ['The attached project is inspected before reporting a result'],
  };
}

function completeCase(skillName, positivePrompt, topK = 1, files) {
  return {
    skill_name: skillName,
    trigger: {
      positive: [1, 2, 3].map(() => ({ prompt: positivePrompt, top_k: topK })),
      negative: [
        { prompt: 'unrelated banana request' },
        { prompt: 'unrelated orange request' },
      ],
    },
    evals: [behavioralEval(files)],
  };
}

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-run-evals-test-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evals', 'cases'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evals', 'fixtures', 'project'), { recursive: true });
  fs.copyFileSync(RUNNER, path.join(root, 'scripts', 'run-evals.js'));
  fs.mkdirSync(path.join(root, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'lib', 'eval-backends.js'), path.join(root, 'scripts', 'lib', 'eval-backends.js'));
  fs.copyFileSync(path.join(__dirname, 'lib', 'invoke-cli.js'), path.join(root, 'scripts', 'lib', 'invoke-cli.js'));
  fs.writeFileSync(path.join(root, 'evals', 'fixtures', 'project', 'context.txt'), 'fixture\n');
  return root;
}

function run(root, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'run-evals.js'), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('accepts a complete and consistent grader result', () => {
  const raw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed in the trace' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed in the trace' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });

  assert.deepEqual(parseGrading(raw, ['first expectation', 'second expectation']), JSON.parse(raw));
});

test('rejects grader results that omit expectations', () => {
  const raw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed in the trace' },
    ],
    summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
  });

  assert.equal(parseGrading(raw, ['first expectation', 'second expectation']), null);
});

test('rejects null expectation entries without throwing', () => {
  const cases = [
    { results: [null], declared: ['first expectation'] },
    { results: [{ id: 1, text: 'first expectation', passed: true, evidence: 'observed' }, null], declared: ['first expectation', 'second expectation'] },
  ];
  for (const { results, declared } of cases) {
    const raw = JSON.stringify({
      expectations: results,
      summary: {
        passed: results.length - 1,
        failed: 1,
        total: results.length,
        pass_rate: (results.length - 1) / results.length,
      },
    });

    assert.equal(parseGrading(raw, declared), null);
  }
});

test('rejects incomplete or inconsistent grader summaries', () => {
  const declared = ['expected behavior'];
  const expectation = { id: 1, text: 'expected behavior', passed: false, evidence: 'not observed' };
  const cases = [
    {
      expectations: [],
      summary: { passed: 0, failed: 0, total: 0, pass_rate: 0 },
      declared: [],
    },
    {
      expectations: [{ id: 1, text: 'expected behavior', passed: false }],
      summary: { passed: 0, failed: 1, total: 1, pass_rate: 0 },
      declared,
    },
    {
      expectations: [expectation],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      declared,
    },
    {
      expectations: [expectation],
      summary: { passed: 0, total: 1, pass_rate: 0 },
      declared,
    },
    {
      expectations: [expectation],
      summary: { passed: 0, failed: 1, total: 1 },
      declared,
    },
  ];

  for (const { declared: d, ...grading } of cases) {
    assert.equal(parseGrading(JSON.stringify(grading), d), null);
  }
});

test('fails when a skill has no eval case file', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /no eval case file/);
});

test('fails when an eval case is below the required minimums', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), {
    skill_name: 'alpha-skill',
    trigger: {
      positive: [{ prompt: 'change alpha widget', top_k: 1 }],
      negative: [],
    },
    evals: [behavioralEval()],
  });

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /below required minimums/);
});

test('fails when a behavioral eval references a missing fixture', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  writeJson(
    path.join(root, 'evals', 'cases', 'alpha-skill.json'),
    completeCase('alpha-skill', 'change alpha widget', 1, ['missing/project.txt']),
  );

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /fixture not found/);
});

test('requires fixtures for execution evals', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  writeJson(
    path.join(root, 'evals', 'cases', 'alpha-skill.json'),
    completeCase('alpha-skill', 'change alpha widget', 1, []),
  );

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /needs a non-empty files\[\] fixture list/);
});

test('allows dialogue evals without fixtures', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue' }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects provisional execution evals', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals[0].trust_level = 'provisional';
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /is still provisional/);
});

test('allows dialogue evals with a legacy provisional marker', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue', trust_level: 'provisional' }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects unknown behavioral eval kinds', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals[0].kind = 'conversation';
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /unknown kind "conversation"/);
});

test('dry-runs a fixtureless dialogue eval', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue' }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root, ['--behavioral', 'alpha-skill', '--dry-run']);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /dialogue transcript/);
});

test('enforces the configured rank-1 floor', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles widget work. Use when implementing widget changes.');
  writeSkill(
    root,
    'beta-skill',
    'Diagnoses urgent widget failures in production. Use when repairing urgent widget failures.',
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'alpha-skill.json'),
    completeCase('alpha-skill', 'urgent widget failure production', 2),
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'beta-skill.json'),
    completeCase('beta-skill', 'repair urgent widget failure', 1),
  );

  const passing = run(root, ['--min-rank1', '50']);
  const failing = run(root, ['--min-rank1', '60']);

  assert.equal(passing.status, 0, passing.stdout + passing.stderr);
  assert.equal(failing.status, 1, failing.stdout + failing.stderr);
  assert.match(failing.stdout, /below required 60%/);
});

test('rejects an invalid rank-1 floor', () => {
  const root = makeSandbox();

  const result = run(root, ['--min-rank1', '101']);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /--min-rank1 must be a number from 0 to 100/);
});

test('requires both explicit model selections before a live behavioral run', () => {
  const root = makeSandbox();
  for (const args of [[], ['--executor-model', 'pinned-executor'], ['--grader-model', 'pinned-grader']]) {
    const result = run(root, ['--behavioral', 'alpha-skill', ...args]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /require --executor-model and --grader-model/);
    assert.equal(fs.existsSync(path.join(root, 'evals', 'results')), false);
  }
});

test('rejects missing model values and model options on deterministic runs', () => {
  const root = makeSandbox();
  const missing = run(root, ['--behavioral', 'alpha-skill', '--dry-run', '--executor-model', '--grader-model', 'pinned']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--executor-model needs a model ID/);
  const deterministic = run(root, ['--executor-model', 'pinned']);
  assert.equal(deterministic.status, 1);
  assert.match(deterministic.stderr, /only to --behavioral/);
});

test('rejects duplicate or non-positive IDs in deterministic case validation', () => {
  for (const id of [0, -1, 1]) {
    const root = makeSandbox();
    writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
    const data = completeCase('alpha-skill', 'change alpha widget');
    data.evals.push({ ...data.evals[0], id });
    writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), data);
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /does not match evals.json schema/);
  }
});

// ---------- parseGrading expectation-binding tests ----------

test('accepts reordered-but-complete grader results', () => {
  const expectations = ['first expectation', 'second expectation'];
  const raw = JSON.stringify({
    expectations: [
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed in the trace' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  const result = parseGrading(raw, expectations);
  assert.notEqual(result, null);
  assert.equal(result.summary.passed, 1);
  assert.equal(result.summary.failed, 1);
});

test('rejects duplicate grader results for the same expectation', () => {
  const expectations = ['first expectation', 'second expectation'];
  // Valid baseline: each id appears exactly once
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  assert.notEqual(parseGrading(validRaw, expectations), null);

  // Duplicate: id 1 appears twice, id 2 is missing
  const dupRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed again' },
    ],
    summary: { passed: 2, failed: 0, total: 2, pass_rate: 1 },
  });
  assert.equal(parseGrading(dupRaw, expectations), null);
});

test('rejects grader results whose ids are not in the declared set', () => {
  const expectations = ['first expectation', 'second expectation'];
  // Valid baseline
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  assert.notEqual(parseGrading(validRaw, expectations), null);

  // id 3 is out of range 1..2
  const badIdRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 3, text: 'unknown expectation', passed: false, evidence: 'not found' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  assert.equal(parseGrading(badIdRaw, expectations), null);
});

test('rejects a result set that omits a declared expectation', () => {
  const expectations = ['first expectation', 'second expectation', 'third expectation'];
  // Valid baseline
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: true, evidence: 'observed' },
      { id: 3, text: 'third expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 2, failed: 1, total: 3, pass_rate: 2 / 3 },
  });
  assert.notEqual(parseGrading(validRaw, expectations), null);

  // Only 2 results for 3 expectations (id 3 omitted)
  const partialRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: true, evidence: 'observed' },
    ],
    summary: { passed: 2, failed: 0, total: 2, pass_rate: 1 },
  });
  assert.equal(parseGrading(partialRaw, expectations), null);
});

test('derives pass_rate from counters rather than trusting the grader value', () => {
  const expectations = ['first expectation', 'second expectation'];
  // Correct pass_rate should be accepted
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  const valid = parseGrading(validRaw, expectations);
  assert.notEqual(valid, null);
  assert.equal(valid.summary.pass_rate, 0.5);

  // Wrong pass_rate with correct counters: accepted, but recomputed
  const wrongRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.999 },
  });
  const corrected = parseGrading(wrongRaw, expectations);
  assert.notEqual(corrected, null);
  assert.equal(corrected.summary.pass_rate, 0.5);
  // The integer counters stay exact checks
  assert.equal(corrected.summary.passed, 1);
  assert.equal(corrected.summary.failed, 1);
});

test('replaces paraphrased grader text with the declared expectation', () => {
  const expectations = ['first expectation', 'second expectation'];
  const raw = JSON.stringify({
    expectations: [
      { id: 2, text: 'the agent did the second thing', passed: false, evidence: 'not observed' },
      { id: 1, text: 'roughly the first one', passed: true, evidence: 'observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });

  const result = parseGrading(raw, expectations);
  assert.notEqual(result, null);
  assert.equal(result.expectations.find((r) => r.id === 1).text, 'first expectation');
  assert.equal(result.expectations.find((r) => r.id === 2).text, 'second expectation');
});

// ---------- persistGradingOutcome stale-cleanup tests ----------

test('rejected grading writes raw output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-cleanup-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');

    const result = persistGradingOutcome(base, null, 'unparseable grader output');

    assert.equal(result, false);
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), true, 'raw output must be written');
    assert.equal(fs.readFileSync(`${base}.grading.raw.txt`, 'utf8'), 'unparseable grader output');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejected grading succeeds even when no prior grading.json exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-cleanup-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');

    const result = persistGradingOutcome(base, null, 'bad output');

    assert.equal(result, false);
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('accepted grading writes grading.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-cleanup-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };

    const result = persistGradingOutcome(base, grading, 'unused');

    assert.equal(result, true);
    const written = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
    assert.deepEqual(written, grading);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- upfront slot-clearing tests ----------

test('a grader that throws leaves no result file behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-crash-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    // Stale files from a prior run
    fs.writeFileSync(`${base}.grading.json`, '{"previous":"run"}\n');
    fs.writeFileSync(`${base}.grading.raw.txt`, 'previous raw output');

    clearGradingSlot(base);

    // Executor or grader crashes — persistGradingOutcome is never called

    assert.equal(fs.existsSync(`${base}.grading.json`), false, 'stale grading.json must not survive a crash');
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), false, 'stale grading.raw.txt must not survive a crash');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('successful grading leaves no stale raw file behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-success-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    // Stale raw from a prior rejected run
    fs.writeFileSync(`${base}.grading.raw.txt`, 'previous raw output');

    clearGradingSlot(base);

    // Successful grading
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };
    persistGradingOutcome(base, grading, 'unused');

    assert.equal(fs.existsSync(`${base}.grading.json`), true, 'grading.json must be written');
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), false, 'stale grading.raw.txt must not survive');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- extractExecutorModel tests ----------

test('extracts model from the stream-json init event', () => {
  const trace = [
    '{"type":"system","subtype":"init","model":"claude-sonnet-4-6-20250514","session_id":"abc"}',
    '{"type":"assistant","message":{"id":"msg_1","content":[{"type":"text","text":"Hi"}]}}',
    '{"type":"result","subtype":"success","result":"Hi"}',
  ].join('\n');

  assert.equal(extractExecutorModel(trace), 'claude-sonnet-4-6-20250514');
});

test('returns null when the trace has no init event', () => {
  const trace = [
    '{"type":"assistant","message":{"id":"msg_1","content":[]}}',
    '{"type":"result","subtype":"success","result":"done"}',
  ].join('\n');

  assert.equal(extractExecutorModel(trace), null);
});

test('returns null when the init event has no model field', () => {
  const trace = '{"type":"system","subtype":"init","session_id":"abc"}\n';

  assert.equal(extractExecutorModel(trace), null);
});

test('tolerates non-JSON lines in the trace', () => {
  const trace = [
    'not json',
    '{"type":"system","subtype":"init","model":"claude-opus-4-6","session_id":"abc"}',
  ].join('\n');

  assert.equal(extractExecutorModel(trace), 'claude-opus-4-6');
});

// ---------- persistGradingOutcome run identity tests ----------

test('accepted grading includes run metadata when provided', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-run-meta-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };
    const runMeta = {
      executor_model: 'claude-sonnet-4-6-20250514',
      grader_model: 'unknown',
      timestamp: '2026-09-21T00:00:00.000Z',
    };

    persistGradingOutcome(base, grading, 'unused', runMeta);

    const written = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
    assert.deepEqual(written.run, runMeta);
    assert.deepEqual(written.expectations, grading.expectations);
    assert.deepEqual(written.summary, grading.summary);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('accepted grading omits run key when no metadata is provided', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-no-meta-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };

    persistGradingOutcome(base, grading, 'unused');

    const written = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
    assert.equal('run' in written, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('materializes a git baseline and applies a working-tree patch', () => {
  const workspace = materializeWorkspace({ files: ['git-workflow-and-versioning'] });
  try {
    const status = spawnSync('git', ['status', '--short'], { cwd: workspace, encoding: 'utf8' });
    const commits = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: workspace, encoding: 'utf8' });

    assert.equal(status.status, 0, status.stdout + status.stderr);
    assert.match(status.stdout, / M git-workflow-and-versioning\/app\.js/);
    assert.equal(commits.stdout.trim(), '1');
    assert.equal(fs.existsSync(path.join(workspace, '.eval')), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('fixture setup does not launch background maintenance that can outlive cleanup', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-maintenance-test-'));
  const globalConfig = path.join(scratch, 'gitconfig');
  const traceFile = path.join(scratch, 'trace.jsonl');
  fs.writeFileSync(globalConfig, '[maintenance]\n\tauto = true\n\tautoDetach = true\n');
  const previous = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_TRACE2_EVENT: process.env.GIT_TRACE2_EVENT };
  let workspace;
  try {
    process.env.GIT_CONFIG_GLOBAL = globalConfig;
    process.env.GIT_TRACE2_EVENT = traceFile;
    workspace = materializeWorkspace({ files: ['git-workflow-and-versioning'] });
    assert.equal(fs.existsSync(traceFile), false, 'setup must not inherit Git diagnostic output destinations');
    const probe = spawnSync('git', ['-c', 'user.name=Probe', '-c', 'user.email=probe@example.invalid',
      'commit', '--allow-empty', '-m', 'maintenance probe'], {
      cwd: workspace, encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: path.join(workspace, '.git', 'eval-policy', 'empty-config') },
    });
    assert.equal(probe.status, 0, probe.stdout + probe.stderr);
    const events = fs.readFileSync(traceFile, 'utf8').trim().split('\n').map(JSON.parse);
    const maintenance = events.filter((event) => event.event === 'child_start' &&
      event.argv.some((arg) => arg === 'maintenance' || arg === 'gc'));
    assert.deepEqual(maintenance, [], 'temporary fixture commits must not spawn maintenance');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) process.env[name] = value;
    return callback();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('real Git setup ignores global hooks, templates, signing, excludes, and injected config', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-git-isolation-'));
  const fixtures = path.join(scratch, 'fixtures');
  const hooks = path.join(scratch, 'hooks');
  const templates = path.join(scratch, 'templates');
  const config = path.join(scratch, 'global-config');
  const excludes = path.join(scratch, 'excludes');
  let workspace;
  try {
    fs.mkdirSync(path.join(fixtures, 'project'), { recursive: true });
    fs.writeFileSync(path.join(fixtures, 'project', 'context.txt'), 'EXPECTED FIXTURE\r\n');
    fs.mkdirSync(hooks);
    const hook = '#!/bin/sh\nprintf "HOOK CHANGED INPUT\\n" > project/context.txt\ngit add project/context.txt\n';
    fs.writeFileSync(path.join(hooks, 'pre-commit'), hook, { mode: 0o755 });
    fs.mkdirSync(path.join(templates, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(templates, 'hooks', 'pre-commit'), hook, { mode: 0o755 });
    fs.writeFileSync(path.join(templates, 'template-proof'), 'unwanted template');
    fs.writeFileSync(excludes, '*.txt\n');
    const gitPath = (value) => value.replaceAll('\\', '/');
    fs.writeFileSync(config, `[core]\n\thooksPath = "${gitPath(hooks)}"\n\texcludesFile = "${gitPath(excludes)}"\n\tautocrlf = true\n[commit]\n\tgpgSign = true\n[gpg]\n\tprogram = missing-eval-signing-tool\n`);
    withEnvironment({ GIT_CONFIG_GLOBAL: config, GIT_CONFIG_SYSTEM: config, GIT_TEMPLATE_DIR: templates,
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: hooks }, () => {
      workspace = materializeWorkspace({ files: ['project'] }, fixtures);
      assert.equal(fs.readFileSync(path.join(workspace, 'project', 'context.txt'), 'utf8'), 'EXPECTED FIXTURE\r\n');
      assert.equal(fs.existsSync(path.join(workspace, '.git', 'template-proof')), false);
    });
    const env = { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_SYSTEM: config, GIT_CONFIG_NOSYSTEM: '1' };
    const show = spawnSync('git', ['show', 'HEAD:project/context.txt'], { cwd: workspace, env, encoding: 'utf8' });
    assert.equal(show.status, 0, show.stderr);
    assert.equal(show.stdout, 'EXPECTED FIXTURE\r\n', 'committed bytes must match archived inputs');
    const commit = spawnSync('git', ['commit', '--allow-empty', '-m', 'executor save point'], { cwd: workspace, env, encoding: 'utf8' });
    assert.equal(commit.status, 0, commit.stderr);
    assert.equal(fs.readFileSync(path.join(workspace, 'project', 'context.txt'), 'utf8'), 'EXPECTED FIXTURE\r\n', 'local hook/signing policy persists for executor commits');
  } finally {
    if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('fixture setup rejects embedded Git metadata rather than reinitializing it', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-embedded-git-'));
  try {
    fs.mkdirSync(path.join(scratch, 'project', '.git'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'project', '.git', 'config'), '[core]\n\thooksPath = hostile\n');
    assert.throws(() => materializeWorkspace({ files: ['project'] }, scratch), /Git metadata/);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('a selected ordinary fixture leaf cannot traverse an external linked ancestor', () => {
  const root = makeSandbox();
  try {
    const fixtures = path.join(root, 'evals', 'fixtures');
    const outside = path.join(root, 'outside-fixtures');
    fs.mkdirSync(path.join(outside, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'nested', 'private.txt'), 'outside fixture boundary\n');
    fs.symlinkSync(outside, path.join(fixtures, 'project', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const selected = 'project/linked/nested/private.txt';
    assert.equal(fs.lstatSync(path.join(fixtures, selected)).isFile(), true,
      'the selected leaf itself is ordinary; its ancestor is the forbidden link');
    assert.throws(() => materializeWorkspace({ files: [selected] }, fixtures), /must not traverse symbolic links/);

    writeSkill(root, 'alpha-skill', 'Handles widgets.');
    writeJson(path.join(root, '.claude-plugin', 'plugin.json'), { name: 'eval-test', version: '1.0.0' });
    writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), {
      skill_name: 'alpha-skill', evals: [behavioralEval([selected])],
    });
    let calls = 0;
    assert.throws(() => runBehavioral('alpha-skill', {
      root, executorModel: 'fake-executor', graderModel: 'fake-grader',
      invokeClaude: () => { calls++; throw new Error('CLI must not be called'); },
    }), /must not traverse symbolic links/);
    assert.equal(calls, 0, 'fixture rejection must precede even CLI version detection');
    assert.equal(fs.existsSync(path.join(root, 'evals', 'results')), false,
      'invalid fixture bytes and package inputs must not be snapshotted');
    assert.equal(fs.readFileSync(path.join(outside, 'nested', 'private.txt'), 'utf8'), 'outside fixture boundary\n');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('linked fixture roots and package-relative eval ancestors fail before snapshots or CLI calls', () => {
  for (const relative of ['evals/fixtures', 'evals']) {
    const root = makeSandbox();
    try {
      writeSkill(root, 'alpha-skill', 'Handles widgets.');
      writeJson(path.join(root, '.claude-plugin', 'plugin.json'), { name: 'eval-test', version: '1.0.0' });
      writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), {
        skill_name: 'alpha-skill', evals: [behavioralEval()],
      });
      const linkedDirectory = path.join(root, relative);
      const outside = path.join(root, 'outside-selected-directory');
      fs.renameSync(linkedDirectory, outside);
      fs.symlinkSync(outside, linkedDirectory, process.platform === 'win32' ? 'junction' : 'dir');
      assert.equal(fs.lstatSync(path.join(root, 'evals', 'fixtures', 'project', 'context.txt')).isFile(), true);
      if (relative === 'evals/fixtures') {
        assert.throws(() => materializeWorkspace({ files: ['project/context.txt'] }, linkedDirectory), /ordinary directory/,
          'a caller-supplied fixture root itself must not be linked');
      }
      let calls = 0;
      assert.throws(() => runBehavioral('alpha-skill', {
        root, executorModel: 'fake-executor', graderModel: 'fake-grader',
        invokeClaude: () => { calls++; throw new Error('CLI must not be called'); },
      }), /ordinary directory/, relative);
      assert.equal(calls, 0, `${relative} rejection must precede CLI version detection`);
      assert.equal(fs.existsSync(path.join(root, 'evals', 'results')), false,
        `${relative} rejection must precede input snapshots`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('workspace evidence records archive omissions rather than silently claiming completeness', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-evidence-limit-'));
  try {
    const source = path.join(scratch, 'source');
    const destination = path.join(scratch, 'archive');
    fs.mkdirSync(path.join(source, '.git'), { recursive: true });
    fs.writeFileSync(path.join(source, '.git', 'config'), 'not artifact evidence');
    fs.writeFileSync(path.join(source, 'small.txt'), 'abc');
    fs.writeFileSync(path.join(source, 'z-large.txt'), 'too large');
    const result = snapshotWorkspace(source, destination, 3);
    assert.equal(result.complete, false);
    assert.equal(result.retained_bytes, 3);
    assert.equal(fs.readFileSync(path.join(destination, 'small.txt'), 'utf8'), 'abc');
    assert.equal(fs.existsSync(path.join(destination, '.git')), false);
    assert.equal(fs.existsSync(path.join(destination, 'z-large.txt')), false);
    assert.equal(result.entries.find((entry) => entry.path === 'z-large.txt').reason, 'archive-size-limit');
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('fake executor retains exact initial patch and final files even when execution fails', () => {
  const root = makeSandbox();
  const context = path.join(root, 'evals', 'fixtures', 'project', 'context.txt');
  try {
    writeSkill(root, 'alpha-skill', 'Handles widgets.');
    writeJson(path.join(root, '.claude-plugin', 'plugin.json'), { name: 'eval-test', version: '1.0.0' });
    writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), { skill_name: 'alpha-skill', evals: [behavioralEval(['project'])] });
    fs.mkdirSync(path.join(path.dirname(context), '.eval'));
    fs.writeFileSync(path.join(path.dirname(context), '.eval', 'working-tree.patch'),
      'diff --git a/project/context.txt b/project/context.txt\n--- a/project/context.txt\n+++ b/project/context.txt\n@@ -1 +1 @@\n-fixture\n+patched input\n');
    const result = withEnvironment({ GIT_DIR: path.join(root, 'wrong-repository'), GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: 'wrong-hooks' }, () => runBehavioral('alpha-skill', {
      root, executorModel: 'fake-executor', graderModel: 'fake-grader',
      invokeClaude: (_command, args, options) => {
        if (args.includes('--version')) return 'fake CLI';
        assert.equal(options.env.GIT_DIR, undefined);
        assert.equal(options.env.GIT_CONFIG_COUNT, undefined);
        assert.equal(fs.readFileSync(path.join(options.cwd, 'project', 'context.txt'), 'utf8'), 'patched input\n');
        fs.writeFileSync(path.join(options.cwd, 'project', 'context.txt'), 'executor changed input\n');
        fs.writeFileSync(path.join(options.cwd, 'new.txt'), 'untracked result\n');
        const monitor = path.join(options.cwd, '.git', 'evidence-probe.js');
        fs.writeFileSync(monitor, `require('node:fs').writeFileSync(${JSON.stringify(path.join(root, 'unsafe-evidence-probe'))}, 'executed'); process.stdout.write('token\\0\\0');`);
        const configure = spawnSync('git', ['config', '--local', 'core.fsmonitor',
          `"${process.execPath.replaceAll('\\', '/')}" "${monitor.replaceAll('\\', '/')}"`],
        { cwd: options.cwd, env: options.env, encoding: 'utf8' });
        assert.equal(configure.status, 0, configure.stderr);
        const failure = new Error('fake execution failure');
        failure.stdout = 'partial trace';
        throw failure;
      },
    }));
    assert.equal(result.failures, 1);
    const base = path.join(result.runDir, 'alpha-skill.eval-1');
    assert.equal(fs.readFileSync(path.join(`${base}.initial-workspace`, 'project', 'context.txt'), 'utf8'), 'patched input\n');
    assert.equal(fs.readFileSync(path.join(`${base}.final-workspace`, 'project', 'context.txt'), 'utf8'), 'executor changed input\n');
    assert.equal(fs.readFileSync(path.join(`${base}.final-workspace`, 'new.txt'), 'utf8'), 'untracked result\n');
    assert.equal(fs.existsSync(path.join(`${base}.initial-workspace`, 'project', '.eval')), false);
    const meta = JSON.parse(fs.readFileSync(`${base}.run.json`, 'utf8'));
    assert.match(meta.baseline_commit, /^[a-f0-9]{40,64}$/);
    assert.match(meta.initial_workspace_sha256, /^[a-f0-9]{64}$/);
    assert.match(meta.final_workspace_sha256, /^[a-f0-9]{64}$/);
    assert.notEqual(meta.initial_workspace_sha256, meta.final_workspace_sha256);
    assert.equal(meta.initial_workspace_complete, true);
    assert.equal(meta.final_workspace_complete, true);
    assert.equal(meta.final_commit, meta.baseline_commit);
    assert.equal(fs.existsSync(path.join(root, 'unsafe-evidence-probe')), false,
      'evidence collection must not execute model-controlled Git configuration');
    assert.equal(fs.readFileSync(`${base}.executor.stdout.txt`, 'utf8'), 'partial trace');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('workspace evidence never follows an executor-created link outside the workspace', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-evidence-link-'));
  try {
    const source = path.join(scratch, 'source');
    const outside = path.join(scratch, 'outside');
    const archive = path.join(scratch, 'archive');
    fs.mkdirSync(source);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'private.txt'), 'must not be archived');
    fs.symlinkSync(outside, path.join(source, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = snapshotWorkspace(source, archive);
    assert.equal(result.complete, false);
    assert.equal(result.entries[0].type, 'symlink');
    assert.equal(fs.existsSync(path.join(archive, 'external', 'private.txt')), false);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('workspace evidence omits a file that grows between inspection and opening', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-evidence-growth-'));
  try {
    const source = path.join(scratch, 'source');
    const archive = path.join(scratch, 'archive');
    fs.mkdirSync(source);
    const file = path.join(source, 'growing.log');
    fs.writeFileSync(file, 'a');
    const originalLstat = fs.lstatSync;
    let grew = false;
    t.mock.method(fs, 'lstatSync', (...args) => {
      const inspected = originalLstat(...args);
      if (args[0] === file && !grew) {
        grew = true;
        fs.appendFileSync(file, 'x'.repeat(128 * 1024));
      }
      return inspected;
    });
    const result = snapshotWorkspace(source, archive, 3);
    assert.equal(grew, true);
    assert.equal(result.retained_bytes, 0);
    assert.equal(result.complete, false);
    assert.equal(result.entries[0].reason, 'source-changed');
    assert.equal(fs.existsSync(path.join(archive, 'growing.log')), false);
  } finally {
    t.mock.restoreAll();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('workspace evidence bounds reads and omits growth after the file is opened', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-evidence-read-growth-'));
  try {
    const source = path.join(scratch, 'source');
    const archive = path.join(scratch, 'archive');
    fs.mkdirSync(source);
    const file = path.join(source, 'growing.log');
    fs.writeFileSync(file, 'abc');
    const originalRead = fs.readSync;
    let grew = false;
    let requestedBytes = 0;
    t.mock.method(fs, 'readSync', (...args) => {
      if (!grew) {
        grew = true;
        fs.appendFileSync(file, 'x'.repeat(128 * 1024));
      }
      requestedBytes += args[3];
      return originalRead(...args);
    });
    const result = snapshotWorkspace(source, archive, 3);
    assert.equal(grew, true);
    assert.ok(requestedBytes <= 3, `collector requested ${requestedBytes} bytes against a 3-byte capacity`);
    assert.equal(result.retained_bytes, 0);
    assert.equal(result.complete, false);
    assert.equal(result.entries[0].reason, 'source-changed');
    assert.equal(fs.existsSync(path.join(archive, 'growing.log')), false);
  } finally {
    t.mock.restoreAll();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('workspace evidence does not read a replacement leaf with the same size', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-evidence-replaced-leaf-'));
  try {
    const source = path.join(scratch, 'source');
    const archive = path.join(scratch, 'archive');
    fs.mkdirSync(source);
    const file = path.join(source, 'result.txt');
    fs.writeFileSync(file, 'old');
    const originalLstat = fs.lstatSync;
    const originalRead = fs.readSync;
    let replaced = false;
    let reads = 0;
    t.mock.method(fs, 'lstatSync', (...args) => {
      const inspected = originalLstat(...args);
      if (args[0] === file && !replaced) {
        replaced = true;
        fs.renameSync(file, path.join(scratch, 'original-leaf'));
        fs.writeFileSync(file, 'new');
      }
      return inspected;
    });
    t.mock.method(fs, 'readSync', (...args) => { reads++; return originalRead(...args); });
    const result = snapshotWorkspace(source, archive, 3);
    assert.equal(replaced, true);
    assert.equal(reads, 0, 'replacement content must be rejected before descriptor reads');
    assert.equal(result.retained_bytes, 0);
    assert.equal(result.complete, false);
    assert.equal(result.entries[0].reason, 'source-changed');
    assert.equal(fs.existsSync(path.join(archive, 'result.txt')), false);
  } finally {
    t.mock.restoreAll();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('workspace evidence rejects a raced symlink leaf without reading its target', { skip: process.platform === 'win32' }, (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-evidence-raced-link-'));
  try {
    const source = path.join(scratch, 'source');
    const archive = path.join(scratch, 'archive');
    fs.mkdirSync(source);
    const file = path.join(source, 'result.txt');
    const outside = path.join(scratch, 'private.txt');
    fs.writeFileSync(file, 'old');
    fs.writeFileSync(outside, 'private');
    const originalLstat = fs.lstatSync;
    const originalRead = fs.readSync;
    let replaced = false;
    let reads = 0;
    t.mock.method(fs, 'lstatSync', (...args) => {
      const inspected = originalLstat(...args);
      if (args[0] === file && !replaced) {
        replaced = true;
        fs.unlinkSync(file);
        fs.symlinkSync(outside, file);
      }
      return inspected;
    });
    t.mock.method(fs, 'readSync', (...args) => { reads++; return originalRead(...args); });
    const result = snapshotWorkspace(source, archive, 8);
    assert.equal(reads, 0);
    assert.equal(result.retained_bytes, 0);
    assert.equal(result.complete, false);
    assert.equal(result.entries[0].reason, 'source-changed');
    assert.equal(fs.existsSync(path.join(archive, 'result.txt')), false);
  } finally {
    t.mock.restoreAll();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
