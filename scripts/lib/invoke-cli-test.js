'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { invokeCliSync, resolveWindowsExecutable } = require('./invoke-cli');

test('direct native argv and stdin preserve shell metacharacters literally', () => {
  const arg = 'space "quote" & echo injected | %PATH% !value! $(echo injected) ; < > ^';
  const input = 'untrusted prompt\n& echo injected\n$(echo injected)\n%PATH%';
  const raw = invokeCliSync(process.execPath, ['-e',
    'process.stdout.write(JSON.stringify({arg:process.argv[1],input:require("node:fs").readFileSync(0,"utf8")}))', arg],
  { input, encoding: 'utf8', timeout: 10000 });
  assert.deepEqual(JSON.parse(raw), { arg, input });
});

test('the helper refuses shell and verbatim argument overrides', () => {
  for (const options of [{ shell: true }, { shell: 'cmd.exe' }, { windowsVerbatimArguments: true }]) {
    assert.throws(() => invokeCliSync(process.execPath, [], options), /direct argv/);
  }
});

test('Windows batch-only installs fail actionably without executing a harmless shim', { skip: process.platform !== 'win32' }, () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-cli-shim-'));
  try {
    const marker = path.join(scratch, 'shim-was-run.txt');
    fs.writeFileSync(path.join(scratch, 'eval-fake-cli.cmd'), `@echo off\r\necho harmless>"${marker}"\r\n`);
    assert.throws(() => invokeCliSync('eval-fake-cli', ['--model', 'a & echo injected'],
      { env: { ...process.env, PATH: scratch }, input: 'prompt & %PATH%' }),
    (error) => error.code === 'ERR_UNSUPPORTED_CLI_SHIM' && /native.*PATH/i.test(error.message));
    assert.equal(fs.existsSync(marker), false);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('Windows prefers native executables over earlier npm shims on PATH', { skip: process.platform !== 'win32' }, () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-cli-native-'));
  try {
    const shims = path.join(scratch, 'shims');
    const native = path.join(scratch, 'native directory');
    fs.mkdirSync(shims);
    fs.mkdirSync(native);
    fs.writeFileSync(path.join(shims, 'eval-fake-cli.cmd'), '@echo off\r\necho shim\r\n');
    const executable = path.join(native, 'eval-fake-cli.exe');
    fs.copyFileSync(process.execPath, executable);
    const env = { ...process.env, PATH: `${shims};"${native}"` };
    assert.equal(resolveWindowsExecutable('eval-fake-cli', { env }), executable);
    assert.equal(invokeCliSync('eval-fake-cli', ['-e', 'process.stdout.write("native")'], { env, encoding: 'utf8' }), 'native');
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
