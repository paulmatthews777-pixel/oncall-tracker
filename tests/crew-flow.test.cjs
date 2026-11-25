const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function loadProductionFunction(file, name) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in ${file}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) {
      const context = vm.createContext({});
      new vm.Script(`${source.slice(start, i + 1)}\nthis.result = ${name};`).runInContext(context);
      return context.result;
    }
  }
  throw new Error(`Could not extract ${name} from ${file}`);
}

const eachResourceRow = loadProductionFunction('planner-feed.user.js', 'fwForEachResourceRow');
const plannerItems = loadProductionFunction('planner-feed.user.js', 'fwPlannerItems');
const isOnCallItem = loadProductionFunction('planner-feed.user.js', 'fwIsOnCallItem');
const crewInSlot = loadProductionFunction('index.html', 'fwCrewInSlot');

test('processes duplicate resource rows so split availability is not dropped', () => {
  const visited = [];
  eachResourceRow([
    { RowData: { Name: 'Crew A', source: 'appliance' } },
    { RowData: { Name: 'Crew A', source: 'station' } },
  ], row => visited.push(row.RowData.source));
  assert.deepEqual(visited, ['appliance', 'station']);
});

test('reads every planner item and its nested appointments', () => {
  const result = plannerItems(JSON.stringify({ plannerItem: [
    { id: 'primary', appointments: [{ id: 'nested' }] },
    { id: 'secondary' },
  ] }));
  assert.deepEqual(Array.from(result, item => item.id), ['primary', 'nested', 'secondary']);
});

test('recognizes FireWatch on-call availability label variants', () => {
  for (const tooltip of [
    'Activity: On-Call - Available',
    'Activity: On-Call: Available',
    'Activity: On-Call Available',
    'Activity: On-Call – Turn Out',
  ]) assert.equal(isOnCallItem({ type: 'Activity', tooltip }), true, tooltip);
  assert.equal(isOnCallItem({ type: 'Activity', tooltip: 'Activity: On-Call - Unavailable' }), false);
  assert.equal(isOnCallItem({ type: 'Activity', tooltip: 'Activity: Training' }), false);
  assert.equal(isOnCallItem({ type: 'RotaAssignment', tooltip: '' }), true);
});

test('counts every crew member covering a slot, including more than five', () => {
  const people = Array.from({ length: 7 }, (_, i) => ({ name: `Crew ${i + 1}`, iv: [[180, 240]] }));
  people.push({ name: 'Partial cover', iv: [[180, 194]] });
  assert.equal(crewInSlot(people, 180).length, 7);
});