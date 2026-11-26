const fs = require('fs'), path = require('path');
const file = () => process.env.AUTOBOOK_STATE || path.join(__dirname, 'state.json');
function load() { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { return {}; } }
function save(s) { fs.writeFileSync(file(), JSON.stringify(s, null, 1)); }
function set(id, patch) { const s = load(); s[id] = Object.assign({}, s[id], patch); save(s); return s[id]; }
module.exports = {load, save, set};
