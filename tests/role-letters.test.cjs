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

const roleLetters = loadProductionFunction('index.html', 'roleLetters');

test('maps standard FireWatch role names to role letters', () => {
  assert.equal(roleLetters('Watch Manager'), 'WM');
  assert.equal(roleLetters('Crew Manager'), 'CM');
  assert.equal(roleLetters('Firefighter'), 'FF');
  assert.equal(roleLetters('Firefighter Support'), 'FS');
  assert.equal(roleLetters('firefighter'), 'FF');
  assert.equal(roleLetters('  Watch Manager  '), 'WM');
});

test('preserves ROLE_ORDER short role codes', () => {
  for (const code of ['WM', 'CM', 'ACMO', 'FF', 'FS']) {
    assert.equal(roleLetters(code), code);
  }
});

test('uses capital letters of words for unknown roles and handles empty input', () => {
  assert.equal(roleLetters('Station Manager'), 'SM');
  assert.equal(roleLetters('Acting Crew Manager'), 'ACM');
  assert.equal(roleLetters('duty officer'), 'DO');
  assert.equal(roleLetters(''), '');
  assert.equal(roleLetters(null), '');
  assert.equal(roleLetters(undefined), '');
});
