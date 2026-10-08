'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CLAUDE_TOOLS = 'Skill,Agent,Read,Glob,Grep,Edit,Write,Bash,WebFetch,WebSearch';

function events(raw) {
  return raw.split('\n').flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function observedModels(value) {
  return [...new Set([
    ...(typeof value?.model === 'string' ? [value.model] : []),
    ...(typeof value?.message?.model === 'string' ? [value.message.model] : []),
    ...Object.keys(value?.modelUsage || {}),
    ...Object.keys(value?.model_usage || {}),
  ])].sort();
}

function modelEvidence(traceEvents) {
  const models = [...new Set(traceEvents.flatMap(observedModels))].sort();
  return { models, model: models.length === 1 ? models[0] : null };
}

function extractExecutorModel(trace) {
  return events(trace).find((event) => event?.type === 'system' && event.subtype === 'init')?.model || null;
}

const GRADING_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['expectations', 'summary'],
  properties: {
    expectations: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['id', 'text', 'passed', 'evidence'],
      properties: { id: { type: 'integer' }, text: { type: 'string' }, passed: { type: 'boolean' }, evidence: { type: 'string' } },
    } },
    summary: { type: 'object', additionalProperties: false, required: ['passed', 'failed', 'total', 'pass_rate'],
      properties: { passed: { type: 'integer' }, failed: { type: 'integer' }, total: { type: 'integer' }, pass_rate: { type: 'number' } },
    },
  },
};

function codexArgs(model, sandbox) {
  return ['exec', '--json', '--ephemeral', '--ignore-user-config', '--model', model,
    '--sandbox', sandbox, '--skip-git-repo-check', '--config', 'approval_policy="never"',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks', '--disable', 'memories', '--disable', 'goals'];
}

function codexExecution(raw) {
  const traceEvents = events(raw);
  const terminal = traceEvents.findLast((event) => ['turn.started', 'turn.completed', 'turn.failed'].includes(event?.type));
  return { ...modelEvidence(traceEvents), success: terminal?.type === 'turn.completed' };
}

function getEvalBackend(name) {
  if (name === 'claude') return {
    name, command: 'claude', manifestFile: '.claude-plugin/plugin.json', skillLoading: 'plugin-dir', graderExtension: 'json',
    executorArguments({ model, packageDir, skillName, manifest }) {
      return ['-p', '--verbose', '--output-format', 'stream-json', '--model', model, '--plugin-dir', packageDir,
        '--setting-sources', '', '--no-session-persistence', '--permission-mode', 'acceptEdits',
        '--tools', CLAUDE_TOOLS, '--allowedTools', CLAUDE_TOOLS,
        '--append-system-prompt', `Use the ${manifest.name}:${skillName} skill from the loaded plugin for this task. Its supporting files are in ${path.join(packageDir, 'skills', skillName)}. Respect the requested scope.`];
    },
    executorPrompt({ prompt }) { return prompt; },
    graderArguments({ model }) {
      return ['-p', '--output-format', 'json', '--model', model, '--safe-mode', '--no-session-persistence',
        '--tools', '', '--disallowedTools', 'mcp__*'];
    },
    parseExecution(raw) {
      const traceEvents = events(raw);
      const terminal = traceEvents.findLast((event) => event?.type === 'result');
      return { ...modelEvidence(traceEvents), model: extractExecutorModel(raw), success: terminal?.subtype === 'success' && !terminal.is_error };
    },
    parseGrading(raw) {
      const envelope = JSON.parse(raw);
      return { ...modelEvidence([envelope]), text: envelope?.result,
        success: !envelope?.is_error && envelope?.subtype === 'success' && typeof envelope.result === 'string' };
    },
  };
  if (name === 'codex') return {
    name, command: 'codex', manifestFile: '.codex-plugin/plugin.json', skillLoading: 'explicit-path', graderExtension: 'jsonl',
    executorArguments({ model, workspace }) {
      const args = codexArgs(model, 'workspace-write');
      // Permit this throwaway repository's own commits without broadening
      // write access to the snapshot or the user's repository/profile.
      if (fs.existsSync(path.join(workspace, '.git'))) args.push('--add-dir', path.join(workspace, '.git'));
      return [...args, '--enable', 'multi_agent', '-'];
    },
    executorPrompt({ prompt, skillName, packageDir }) {
      return [`Use $${skillName} from the exact skill file below. Read it before doing the task.`,
        `Skill file: ${path.join(packageDir, 'skills', skillName, 'SKILL.md')}`,
        'Keep its supporting files and shared references at their snapshot paths. Respect the requested scope.', '', prompt].join('\n');
    },
    graderArguments({ model, workspace }) {
      const schemaFile = path.join(workspace, 'grading-schema.json');
      fs.writeFileSync(schemaFile, JSON.stringify(GRADING_SCHEMA));
      return [...codexArgs(model, 'read-only'), '--disable', 'shell_tool', '--disable', 'multi_agent',
        '--disable', 'code_mode_host', '--disable', 'browser_use', '--disable', 'computer_use',
        '--config', 'web_search="disabled"', '--output-schema', schemaFile, '-'];
    },
    parseExecution: codexExecution,
    parseGrading(raw) {
      const traceEvents = events(raw);
      const message = traceEvents.findLast((event) => event?.type === 'item.completed' && event.item?.type === 'agent_message');
      return { ...codexExecution(raw), text: message?.item?.text };
    },
  };
  throw new Error(`Unsupported eval backend: ${name}; choose claude or codex`);
}

module.exports = { getEvalBackend, extractExecutorModel };
