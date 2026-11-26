// Books relay requests in FireWatch. Modes: (none) loop | --once | --dry <json ranges>
const relay = require('./relay.cjs'), state = require('./state.cjs'), audit = require('./audit.cjs'), {parseBook, isTest} = require('./parse.cjs');
const now = () => new Date().toISOString();

async function processRequest(req, deps) {
  const {fw, relay: rl} = deps;
  const rec = {id: req.id, text: req.text, ranges: [], steps: [], confirmations: [], status: 'failed', report: '', readback: 'n/a'};
  const step = (s, r) => rec.steps.push({at: now(), step: s, result: r});
  const finish = async (status, report) => {
    rec.status = status; rec.report = report;
    state.set(req.id, {status, ranges: rec.ranges});
    let f = ''; try { f = require('path').basename(audit.write(rec)); } catch (e) { step('audit write', 'FAILED ' + e.message); }
    await rl.status(req.id, status, report + (f ? '\nAudit: ' + f : ''));
    return rec;
  };
  const prev = state.load()[req.id];
  if (prev && (prev.status === 'booked' || prev.status === 'failed')) { step('state', 'already ' + prev.status); return finish(prev.status, 'Already processed (' + prev.status + '), not repeated.'); }
  if (isTest(req.text)) { step('guard', 'test request'); return finish('failed', 'test request ignored'); }
  const p = parseBook(req.text);
  if (p.error) { step('parse', p.error); return finish('failed', p.error); }
  rec.ranges = p.ranges; step('parse', p.ranges.length + ' range(s)');
  const crashed = prev && prev.status === 'booking';
  state.set(req.id, {status: 'booking', ranges: rec.ranges});
  await rl.status(req.id, 'booking', 'Booking started');
  try {
    if (crashed) {
      step('restart', 'was mid-booking, read-back only');
      const v = await fw.verifyRanges(p.ranges, rec);
      rec.readback = v.ok ? 'OK all ranges present' : 'not confirmed';
      return finish(v.ok ? 'booked' : 'failed', v.ok ? 'Confirmed by read-back after restart.' : 'needs manual check: could not confirm after restart');
    }
    const out = await fw.bookRanges(p.ranges, rec, step);
    rec.readback = out.readback;
    const warn = rec.confirmations.map(c => c.replace(/\s+/g, ' ').slice(0, 160)).join(' | ');
    if (out.ok) return finish('booked', 'Booked ' + p.ranges.length + ' range(s). Read-back ' + out.readback + '.' + (warn ? '\nFireWatch: ' + warn : ''));
    return finish('failed', 'Not booked: ' + out.error + '. Read-back ' + out.readback);
  } catch (e) {
    step('error', e.message);
    return finish('failed', 'Error: ' + e.message);
  }
}

async function once(deps) {
  const n = await deps.relay.next();
  if (!n.j || !n.j.req) return null;
  return processRequest(n.j.req, deps);
}

async function main() {
  const fw = require('./fw.cjs'), deps = {fw, relay};
  const a = process.argv.slice(2);
  if (a[0] === '--dry') {
    const ranges = JSON.parse(a[1]);
    const rec = {id: 'dry-' + Date.now(), dry: true, text: 'DRY ' + a[1], ranges, steps: [], confirmations: [], status: 'failed', report: '', readback: 'n/a'};
    try { const o = await fw.dryRun(ranges, rec, (s, r) => rec.steps.push({at: now(), step: s, result: r})); rec.status = o.ok ? 'dry-ok' : 'dry-failed'; rec.report = o.ok ? 'DRY OK: reached PIN panel, fields verified, cancelled, nothing created' : o.error; rec.readback = o.readback || 'n/a'; }
    catch (e) { rec.report = 'Error: ' + e.message; }
    console.log(rec.status + ' | ' + rec.report + ' | ' + require('path').basename(audit.write(rec)));
    process.exit(rec.status === 'dry-ok' ? 0 : 1);
  }
  if (a[0] === '--once') { const r = await once(deps); console.log(r ? r.status + ' ' + r.id : 'no request'); return; }
  let lastHb = 0, busy = false;
  console.log('autobook loop started ' + now());
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      if (Date.now() - lastHb > 120000) { await relay.heartbeat(); lastHb = Date.now(); }
      await once(deps);
    } catch (e) { console.log(now() + ' tick error ' + e.message); }
    busy = false;
  }, 10000);
}
if (require.main === module) main();
module.exports = {processRequest, once};
