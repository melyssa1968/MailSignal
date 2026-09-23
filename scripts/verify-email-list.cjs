const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const compiled = ts.transpileModule(fs.readFileSync('lib/email-list.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const mod = {exports: {}};
new vm.Script('(function(exports){' + compiled + '\n})').runInThisContext()(mod.exports);
const {selectEmails, groupEmails, senderKey} = mod.exports;
const defaults = {search: '', activity: 'all', sender: 'all', tracking: 'all', sort: 'sent-newest'};
const base = {recipients: ['prospect@example.com'], subject: 'Proposal', status: 'active', opens: 0, uncertain: 0, loads: 0};
const rows = [
  {...base, id: 'no-request', sender: ' SALES@EXAMPLE.COM ', sent_at: 500, last_request: null},
  {...base, id: 'recent-filtered', sender: 'sales@example.com', sent_at: 200, last_request: 900, uncertain: 1, loads: 1},
  {...base, id: 'paused', sender: 'other@example.com', status: 'paused', sent_at: 400, last_request: 950, opens: 1, loads: 2},
  {...base, id: 'older', sender: 'sales@example.com', sent_at: 300, last_request: 800, opens: 1, loads: 1},
  {...base, id: 'missing-sender', sender: null, sent_at: 100, last_request: null},
];
const snapshot = JSON.stringify(rows);
const ids = options => selectEmails(rows, {...defaults, ...options}).map(row => row.id);
assert.deepEqual(ids({sort: 'request-newest'}), ['paused', 'recent-filtered', 'older', 'no-request', 'missing-sender']);
assert.deepEqual(ids({sort: 'request-oldest'}), ['older', 'recent-filtered', 'paused', 'no-request', 'missing-sender']);
assert.deepEqual(ids({tracking: 'active', sender: 'sales@example.com', activity: 'uncertain', sort: 'request-newest', search: 'proposal'}), ['recent-filtered']);
assert.deepEqual(ids({tracking: 'paused'}), ['paused']);
assert.deepEqual(ids({sender: ''}), ['missing-sender']);
assert.deepEqual(ids({search: ' SALES@EXAMPLE.COM '}), ['no-request', 'older', 'recent-filtered']);
assert.deepEqual(ids({activity: 'waiting', tracking: 'active'}), ['no-request', 'missing-sender']);
assert.deepEqual(ids({sender: 'unknown@example.com'}), []);
const grouped = groupEmails(selectEmails(rows, {...defaults, sort: 'request-newest'}), true);
assert.deepEqual(grouped.map(g => g.sender), ['other@example.com', 'sales@example.com', '']);
assert.deepEqual(grouped[1].emails.map(m => m.id), ['recent-filtered', 'older', 'no-request']);
assert.equal(senderKey(rows[0]), 'sales@example.com');
assert.equal(JSON.stringify(rows), snapshot);
rows[1].status = 'paused';
assert.ok(!ids({tracking: 'active'}).includes('recent-filtered'));
assert.equal(groupEmails([], true).length, 0);
console.log('Email list verification passed: request sorting, combined filters, sender groups, missing values, pause refresh, and immutable input.');
