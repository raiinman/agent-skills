'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function example(skill, marker) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'skills', skill, 'SKILL.md'), 'utf8');
  const blocks = [...source.matchAll(/```(?:typescript|javascript)\r?\n([\s\S]*?)```/g)];
  const block = blocks.find((match) => match[1].includes(marker));
  assert.ok(block, `missing runnable example: ${skill} ${marker}`);
  return block[1];
}

function simplifiedGetUser(userService) {
  const source = example('code-simplification', 'function getUser');
  const functions = [...source.matchAll(/(?:async )?function getUser\([^)]*\)(?:: Promise<User>)? \{[\s\S]*?\n\}/g)];
  assert.equal(functions.length, 2, 'the example supplies before and after functions');
  // Only erase the illustrative signature types; keep the actual function
  // bodies and async modifiers from the published example unchanged.
  const after = functions[1][0].replace('id: string', 'id').replace(': Promise<User>', '');
  return vm.runInNewContext(`${after}\ngetUser`, { userService });
}

test('the counting simplification preserves JSON shape, duplicate counts, and special keys', () => {
  const source = example('code-simplification', '// UNCLEAR: Chained reduces');
  const after = source.split('// CLEAR: Named intermediate step')[1];
  for (const items of [[], [{ id: 'a' }, { id: 'a' }], [{ id: '__proto__' }, { id: 'constructor' }]]) {
    const beforeValue = vm.runInNewContext(source.split('// CLEAR:')[0] + '\nresult', { items });
    const afterValue = vm.runInNewContext(after + '\nresult', { items });
    assert.equal(JSON.stringify(afterValue), JSON.stringify(beforeValue));
    for (const id of new Set(items.map((item) => item.id))) {
      assert.equal(Object.hasOwn(afterValue, id), true);
      assert.equal(afterValue[id].count, beforeValue[id].count);
    }
  }
});

test('the async simplification preserves rejection when its dependency throws synchronously', async () => {
  const error = new Error('dependency failed');
  const getUser = simplifiedGetUser({ findById() { throw error; } });
  let pending;
  assert.doesNotThrow(() => { pending = getUser('user-1'); });
  await assert.rejects(pending, (observed) => observed === error);
});

test('the async simplification preserves resolved values and rejected promises', async () => {
  const user = { id: 'user-1' };
  assert.equal(await simplifiedGetUser({ findById: () => Promise.resolve(user) })('user-1'), user);
  const error = new Error('rejected');
  await assert.rejects(simplifiedGetUser({ findById: () => Promise.reject(error) })('user-1'),
    (observed) => observed === error);
});

function instrumentedRequest(header) {
  let middleware;
  let fields;
  let responseId;
  vm.runInNewContext(example('observability-and-instrumentation', '// Express:'), {
    app: { use(fn) { middleware = fn; } },
    crypto: { randomUUID: () => 'server-generated-id' },
    logger: { child(value) { fields = value; return {}; } },
  });
  const request = { headers: { 'x-request-id': header } };
  middleware(request, { setHeader(name, value) { responseId = value; } }, () => {});
  return { request, fields, responseId };
}

test('public request instrumentation keeps client correlation separate from its server identity', () => {
  const { request, fields, responseId } = instrumentedRequest('client-chosen-id');
  assert.equal(request.id, 'server-generated-id');
  assert.equal(responseId, request.id);
  assert.equal(fields.requestId, request.id);
  assert.equal(fields.clientRequestId, 'client-chosen-id');
});

test('request instrumentation rejects malformed or unbounded client correlation headers', () => {
  for (const value of [undefined, ['one', 'two'], 'line\nbreak', 'x'.repeat(65), '', '<script>']) {
    const { request, fields, responseId } = instrumentedRequest(value);
    assert.equal(request.id, 'server-generated-id');
    assert.equal(responseId, request.id);
    assert.equal(Object.hasOwn(fields, 'clientRequestId'), false);
  }
});
