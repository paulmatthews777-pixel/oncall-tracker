// Reads FireWatch Payments (read-only) for the last N months and posts them to the relay at /data/pay.
// Gross figures only. Never reads or stores tax, NI, pension or net pay (FireWatch Payments has none).
const cdp = require('./cdp.cjs');
const STATION = 28; // Winterton, as selected on FireWatch Payments

function monthsBack(n, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/London', year: 'numeric', month: '2-digit'}).formatToParts(now).map(x => [x.type, x.value]));
  let y = +p.year, m = +p.month; const out = [];
  for (let i = 0; i < n; i++) { out.push([y, m]); m--; if (m < 1) { m = 12; y--; } }
  return out;
}

// Runs inside the FireWatch page. Returns {status, items, totalHours, total}.
function pageJs(y, m) {
  return `(async()=>{const tok=document.querySelector('input[name=__RequestVerificationToken]')?.value;
const r=await fetch('/FireWatchWebClient/Payments/GetPayments',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json; charset=utf-8','X-Requested-With':'XMLHttpRequest','__RequestVerificationToken':tok||''},body:JSON.stringify({StationID:${STATION},Month:${m},Year:${y}}),signal:AbortSignal.timeout(15000)});
if(!r.ok)throw Error('Payments '+r.status);const j=await r.json();
const doc=new DOMParser().parseFromString((Array.isArray(j)?j:[j]).map(p=>p.html||'').join(''),'text/html');
const status={};doc.querySelectorAll('.contractPaymentType').forEach(d=>{const n=d.textContent.trim();if(n)status[n]=/\\/complete\\.png/.test(d.querySelector('img')?.getAttribute('src')||'')});
doc.querySelectorAll('script,style').forEach(e=>e.remove());const t=doc.body.textContent.replace(/\\s+/g,' ');
const items={};for(const mm of t.matchAll(/([\\d.]+)\\s+([A-Za-z ()]+?)\\s*=\\s*\\D{0,3}([\\d.,]+)/g)){const k=mm[2].trim();if(k!=='Total')items[k]=[+mm[1],+mm[3].replace(/,/g,'')]}
const th=(t.match(/Total Hour\\(s\\)\\s*=\\s*([\\d.]+)/)||[])[1],tt=(t.match(/Total\\s*=\\s*\\D{0,3}([\\d.,]+)/)||[])[1];
return JSON.stringify({status,items,totalHours:th?+th:0,total:tt?+tt.replace(/,/g,''):0})})()`;
}

async function readPay(c, n = 6) {
  const months = {};
  for (const [y, m] of monthsBack(n)) {
    const key = y + '-' + String(m).padStart(2, '0');
    months[key] = JSON.parse(await cdp.evalJs(c, pageJs(y, m)));
  }
  return months;
}

async function syncPay(getTab, relay, n = 6) {
  const c = await getTab();
  let months;
  try { months = await readPay(c, n); } finally { c.close(); }
  const r = await relay.call('POST', '/data/pay', {source: 'FireWatch Payments', station: 'Winterton', months});
  if (r.status !== 200) throw new Error('relay /data/pay HTTP ' + r.status);
  return Object.keys(months).length;
}

module.exports = {monthsBack, pageJs, readPay, syncPay};
