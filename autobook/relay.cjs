const fs = require('fs');
const BASE = process.env.RELAY_URL || 'https://live-crewing-relay.paulm-crewing.workers.dev';
const keyFile = process.env.PC_KEY_FILE || 'C:\\Users\\paulm\\relay\\pc-key.txt';
const key = () => fs.readFileSync(keyFile, 'utf8').trim();
async function call(method, path, body) {
  const r = await fetch(BASE + path, {method, headers: {'X-PC-Key': key(), 'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000)});
  let j = null; try { j = await r.json(); } catch (e) {}
  return {status: r.status, j};
}
module.exports = {
  next: () => call('GET', '/next'),
  status: (id, status, report) => call('POST', '/status', {id, status, report: String(report || '').slice(0, 3900)}),
  heartbeat: () => call('POST', '/status', {heartbeat: true}),
  call
};
