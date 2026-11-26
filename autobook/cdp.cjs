// Minimal CDP client over Node's built-in WebSocket (node >= 22)
const HOST = 'http://127.0.0.1:9222';
async function listTabs() { const r = await fetch(HOST + '/json'); return r.json(); }
async function newTab(url) { const r = await fetch(HOST + '/json/new?' + encodeURI(url), {method: 'PUT'}); return r.json(); }
async function closeTab(id) { try { await fetch(HOST + '/json/close/' + id); } catch (e) {} }
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let n = 0; const pending = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
    ws.onerror = e => reject(new Error('ws error'));
    ws.onopen = () => resolve({
      send: (method, params) => new Promise((res, rej) => { const id = ++n; pending.set(id, {res, rej}); ws.send(JSON.stringify({id, method, params: params || {}})); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 20000); }),
      close: () => ws.close()
    });
  });
}
async function evalJs(c, expr) {
  const r = await c.send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true});
  if (r.exceptionDetails) throw new Error('js: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
  return r.result.value;
}
module.exports = {listTabs, newTab, closeTab, connect, evalJs};
