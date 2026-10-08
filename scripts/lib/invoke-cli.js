'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function isFile(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

// Batch shims require cmd.exe and a different parsing/escaping contract. Do not
// put model IDs, plugin paths, or prompts through that shell. Prefer an actual
// executable even when an npm shim appears earlier on PATH.
function resolveWindowsExecutable(command, options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const explicit = /[\\/]/.test(command) || path.isAbsolute(command);
  const pathKey = Object.keys(env).filter((key) => key.toUpperCase() === 'PATH').at(-1);
  const directories = explicit ? [''] : String(env[pathKey] || '').split(';')
    .filter(Boolean).map((directory) => directory.replace(/^"(.*)"$/, '$1'));
  const candidates = directories.map((directory) => path.resolve(cwd, directory, command));
  for (const candidate of candidates) {
    const executable = /\.exe$/i.test(candidate) ? candidate : `${candidate}.exe`;
    if (isFile(executable)) return executable;
  }
  const shims = candidates.flatMap((candidate) => /\.(?:cmd|bat)$/i.test(candidate)
    ? [candidate] : [`${candidate}.cmd`, `${candidate}.bat`]);
  const shim = shims.find(isFile);
  const error = new Error(shim
    ? `Cannot safely launch Windows batch shim ${shim}. Install the native ${command} CLI executable and put its .exe directory on PATH; this runner does not use cmd.exe or shell interpolation.`
    : `Native Windows executable for ${command} was not found on PATH. Install the native CLI and put its .exe directory on PATH.`);
  error.code = shim ? 'ERR_UNSUPPORTED_CLI_SHIM' : 'ENOENT';
  throw error;
}

function invokeCliSync(command, args, options = {}) {
  if (options.shell || options.windowsVerbatimArguments) {
    throw new Error('Eval CLI calls require direct argv; shell and verbatim-argument execution are unsupported');
  }
  // Windows environment keys are case-insensitive. Resolve caller overrides
  // once instead of passing ambiguous Path/PATH duplicates to CreateProcess.
  const launchOptions = process.platform === 'win32'
    ? { ...options, env: Object.fromEntries(Object.entries(options.env || process.env)
      .map(([key, value]) => [key.toUpperCase(), value])) }
    : options;
  const executable = process.platform === 'win32' ? resolveWindowsExecutable(command, launchOptions) : command;
  return execFileSync(executable, args, { ...launchOptions, shell: false, windowsHide: true });
}

module.exports = { invokeCliSync, resolveWindowsExecutable };
