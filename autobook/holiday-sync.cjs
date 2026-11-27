// Holiday entitlement: "left" from FireWatch's Entitlement chart, "taken"/"booked ahead" summed from
// Holiday entries on Paul's FireWatch calendar for the leave year. Read-only. Posts to relay /data/holiday.
const cdp = require('./cdp.cjs'), rb = require('./calendar-readback.cjs');
const LEAVE_YEAR_START = '2026-01-01', LEAVE_YEAR_END = '2027-01-01'; // assumed Jan-Dec until Paul confirms

function remainingJs() {
  return `(async()=>{const tok=document.querySelector('input[name=__RequestVerificationToken]')?.value;
const r=await fetch('/FireWatchWebClient/Home/GetEntitlementRemaining',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json; charset=utf-8','X-Requested-With':'XMLHttpRequest','__RequestVerificationToken':tok||''},body:'{}',signal:AbortSignal.timeout(18000)});
if(!r.ok)throw Error('Entitlement '+r.status);const h=(await r.json()).map(p=>p.html||'').join('');
const m=/"data":\\[\\{"Value":(-?[\\d.]+),"Category":"H"\\}\\]/.exec(h);if(!m)throw Error('Entitlement H value not found');return m[1]})()`;
}
async function readRemaining(c) { return +(await cdp.evalJs(c, remainingJs())); }

function mondays(from, to) {
  const d = new Date(from + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  const out = []; for (; d.toISOString().slice(0, 10) < to; d.setUTCDate(d.getUTCDate() + 7)) out.push(d.toISOString().slice(0, 10));
  return out;
}
const hrs = s => (Date.parse(s.e + ':00Z') - Date.parse(s.s + ':00Z')) / 36e5;

async function readHolidays(c) {
  const seen = new Set(), out = [];
  for (const wk of mondays(LEAVE_YEAR_START, LEAVE_YEAR_END)) {
    for (const s of await rb.readWeek(c, wk, cdp.evalJs)) {
      if (s.k !== 'Holiday') continue;
      if (s.s >= LEAVE_YEAR_END || s.e <= LEAVE_YEAR_START) continue;
      const key = s.s + '|' + s.e; if (seen.has(key)) continue; seen.add(key);
      out.push({from: s.s, to: s.e, h: hrs(s)});
    }
  }
  return out.sort((a, b) => a.from < b.from ? -1 : 1);
}

let last = {remaining: null, at: 0};
// Full calendar scan when "left" changes, or every 6 hours; otherwise a single cheap read.
async function syncHoliday(getTab, relay, force = false) {
  const c = await getTab();
  try {
    const remaining = await readRemaining(c);
    if (!force && remaining === last.remaining && Date.now() - last.at < 6 * 3600e3) return 'unchanged';
    const entries = await readHolidays(c);
    const r = await relay.call('POST', '/data/holiday', {remaining, leaveYear: {from: LEAVE_YEAR_START, to: LEAVE_YEAR_END, confirmed: false}, entries});
    if (r.status !== 200) throw new Error('relay /data/holiday HTTP ' + r.status);
    last = {remaining, at: Date.now()};
    return entries.length + ' entries, ' + remaining + ' h left';
  } finally { c.close(); }
}
module.exports = {syncHoliday, readRemaining, readHolidays, mondays, LEAVE_YEAR_START, LEAVE_YEAR_END};
