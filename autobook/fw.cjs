// FireWatch driver over CDP (robot Chrome on :9222). Selectors verified live 25 Nov 2026.
const cdp = require('./cdp.cjs'), {fmtFw} = require('./parse.cjs');
const {spawnSync} = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const FW = 'https://humberside.firewatch.cloud/FireWatchWebClient';
const AHK = 'C:/Users/paulm/AppData/Local/Programs/AutoHotkey/v2/AutoHotkey64.exe';
const TYPE = 'On-Call - Unavailable';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (c, js) => cdp.evalJs(c, js);
async function waitFor(c, js, ms, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 10000)) { try { if (await ev(c, js)) return true; } catch (e) {} await sleep(300); }
  throw new Error('timeout waiting for ' + (what || js.slice(0, 50)));
}
async function getTab() {
  let tabs = (await cdp.listTabs()).filter(t => t.type === 'page');
  if (tabs.some(t => /login\.microsoft/.test(t.url) || /FireWatchIdentity/.test(t.url))) throw new Error('FireWatch signed out - Paul must sign in');
  let t = tabs.find(x => /humberside\.firewatch\.cloud\/FireWatchWebClient/.test(x.url));
  if (!t) { t = await cdp.newTab(FW); await sleep(9000); const again = (await cdp.listTabs()).find(x => x.id === t.id); if (again && /login\.microsoft/.test(again.url)) throw new Error('FireWatch signed out - Paul must sign in'); }
  const c = await cdp.connect(t.webSocketDebuggerUrl);
  c.tab = t;
  return c;
}
const VIS = "const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect();return e.getClientRects().length>0&&r.width>40&&r.height>10&&r.x<innerWidth-10&&getComputedStyle(e).visibility!=='hidden'};";
async function clearDialogs(c) {
  for (let i = 0; i < 4; i++) {
    const open = await ev(c, "(()=>{" + VIS + "return [...document.querySelectorAll('.k-window,.k-dialog')].filter(vis).filter(e=>!/Overview/.test(e.innerText)).length})()");
    if (!open) return;
    await ev(c, "(()=>{" + VIS + "const d=[...document.querySelectorAll('.k-dialog')].filter(vis).find(e=>/save your changes/.test(e.innerText));if(d){[...d.querySelectorAll('button')].find(b=>b.innerText.trim()==='No')?.click();return 1}const p=document.getElementById('pinButtonCancel');if(vis(p)){p.click();return 2}const x=document.getElementById('ActivityForm_Close');if(vis(x)){x.click();return 3}const cf=[...document.querySelectorAll('.k-dialog')].filter(vis)[0];if(cf){const b=[...cf.querySelectorAll('button')].find(b=>/^(No|Cancel|OK)$/.test(b.innerText.trim()));if(b)b.click()}return 0})()");
    await sleep(1200);
  }
}
async function ensureCalendar(c) {
  await clearDialogs(c);
  const shown = await ev(c, "(()=>{" + VIS + "return vis(document.getElementById('myHomeCalendarToolbar'))})()");
  if (!shown) {
    await ev(c, "(()=>{const e=[...document.querySelectorAll('span.k-item-text.explorerItemDescription')].find(e=>e.textContent.trim()==='Calendar');(e.closest('a,li,[role]')||e).click()})()");
    await waitFor(c, "(()=>{" + VIS + "return vis(document.getElementById('myHomeCalendarToolbar'))})()", 15000, 'calendar');
  }
}
async function gotoDate(c, ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  await ev(c, "(()=>{const w=window.jQuery('#HomeCalendarForm_SelectedDate').data('kendoDatePicker');w.value(new Date(" + y + "," + (m - 1) + "," + d + "));w.trigger('change');})()");
  await waitFor(c, "(()=>{return document.querySelectorAll('[data-itemdatetimestart],td .fixedGridColumn').length>0})()", 12000, 'week grid');
  await sleep(2500);
}
async function segments(c) {
  return JSON.parse(await ev(c, "JSON.stringify([...document.querySelectorAll('[data-itemdatetimestart]')].filter(e=>e.getClientRects().length).map(e=>({s:e.dataset.itemdatetimestart.slice(0,16),e:e.dataset.itemdatetimeend.slice(0,16),t:e.title||'',k:e.dataset.type})))"));
}
const mins = iso => Date.parse(iso + ':00Z') / 60000;
function covered(segs, from, to) {
  const u = segs.filter(s => s.k === 'Activity' && s.t.includes(TYPE)).map(s => [mins(s.s), mins(s.e)]).sort((a, b) => a[0] - b[0]);
  let at = mins(from); const end = mins(to);
  for (const [s, e] of u) { if (s <= at && e > at) at = e; if (at >= end) return true; }
  return at >= end;
}
async function readback(c, range) {
  await ensureCalendar(c);
  let day = range.from.slice(0, 10); const last = range.to.slice(0, 10); let segs = [];
  while (true) { await gotoDate(c, day); segs = segs.concat(await segments(c)); const dt = new Date(day + 'T12:00:00Z'); dt.setUTCDate(dt.getUTCDate() + 7); day = dt.toISOString().slice(0, 10); if (day > last) break; }
  return covered(segs, range.from, range.to);
}
async function openAndFill(c, range, step) {
  await ensureCalendar(c);
  await ev(c, "document.querySelector('#calendarNewAction_wrapper .k-split-button-arrow').click()"); await sleep(700);
  await ev(c, "document.getElementById('newActivityOption').querySelector('.k-link').click()");
  await waitFor(c, "(()=>{" + VIS + "return vis(document.getElementById('ActivityForm_StartDate'))})()", 12000, 'activity form'); await sleep(800);
  await ev(c, "(()=>{" + VIS + "const w=[...document.querySelectorAll('.k-window')].filter(vis).pop();w.querySelector('button[aria-label=\"expand combobox\"]').click()})()"); await sleep(900);
  await ev(c, "(()=>{" + VIS + "const o=[...document.querySelectorAll('li[role=option],.k-list-item')].filter(vis).find(e=>e.innerText.trim()==='" + TYPE + "');o.click()})()"); await sleep(700);
  await ev(c, "(()=>{const J=window.jQuery;const set=(id,v)=>{const w=J('#'+id).data('kendoDateTimePicker');w.value(v);w.trigger('change')};const p=s=>{const [d,t]=s.split('T');const [y,m,dd]=d.split('-').map(Number);const [h,mi]=t.split(':').map(Number);return new Date(y,m-1,dd,h,mi)};set('ActivityForm_StartDate',p('" + range.from + "'));set('ActivityForm_EndDate',p('" + range.to + "'))})()"); await sleep(600);
  const v = JSON.parse(await ev(c, "(()=>{" + VIS + "const w=[...document.querySelectorAll('.k-window')].filter(vis).pop();return JSON.stringify([...w.querySelectorAll('input[type=text]')].filter(e=>e.offsetParent!==null).map(e=>e.value))})()"));
  const want = [TYPE, 'Winterton', 'Retained', 'Firefighter'];
  for (let i = 0; i < 4; i++) if (v[i] !== want[i]) throw new Error('form field ' + i + ' is "' + v[i] + '" expected "' + want[i] + '"');
  if (!v.includes(fmtFw(range.from)) || !v.includes(fmtFw(range.to))) throw new Error('dates not set: ' + JSON.stringify(v.slice(-2)));
  step('form', TYPE + ' ' + fmtFw(range.from) + ' to ' + fmtFw(range.to));
}
async function toPinPanel(c, step, rec) {
  await ev(c, "document.getElementById('ActivityForm_SaveAndCloseBaseItemDialog').click()");
  await waitFor(c, "(()=>{" + VIS + "return vis(document.getElementById('PinNumberInput'))})()", 12000, 'PIN panel');
  step('pin panel', 'open');
}
function robotPid() {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', "(Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=9222' -and $_.CommandLine -notmatch '--type=' } | Select-Object -First 1).ProcessId"], {encoding: 'utf8'});
  const n = parseInt((r.stdout || '').trim(), 10); if (!n) throw new Error('robot Chrome process not found'); return n;
}
async function fillPin(c, step) {
  await fetch('http://127.0.0.1:9222/json/activate/' + c.tab.id); await c.send('Page.bringToFront');
  // FireWatch sets autocomplete=off on the PIN box and uses a plain text input; make it a normal password field so Bitwarden fills it
  await ev(c, "(()=>{const p=document.getElementById('PinNumberInput');document.querySelectorAll('form,input').forEach(e=>e.removeAttribute('autocomplete'));p.type='password';p.setAttribute('autocomplete','current-password');p.focus();return 1})()");
  await sleep(800);
  const f = path.join(os.tmpdir(), 'autobook-pin.ahk'); const pid = robotPid(); fs.writeFileSync(f, '#Requires AutoHotkey v2.0\nWinActivate "ahk_pid ' + pid + '"\nif !WinWaitActive("ahk_pid ' + pid + '", , 3)\n  ExitApp 2\nSleep 500\nSend "^+l"\n');
  const r = spawnSync(AHK, [f]); if (r.status === 2) throw new Error('could not bring robot Chrome to the front'); if (r.status !== 0) throw new Error('AutoHotkey failed');
  try { await waitFor(c, "document.getElementById('PinForm_PinName').value==='5970: Paul Matthews'", 8000, 'PIN accepted'); }
  catch (e) { const nm = await ev(c, "document.getElementById('PinForm_PinName').value"); throw new Error('PIN not filled/accepted (name "' + nm + '")'); }
  step('pin filled', 'FireWatch accepted PIN, name "5970: Paul Matthews"');
}
async function confirmFlow(c, rec, step) {
  await ev(c, "document.getElementById('pinButtonOK').click()");
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    await sleep(1200);
    const st = JSON.parse(await ev(c, "(()=>{" + VIS + "const ds=[...document.querySelectorAll('.k-dialog')].filter(vis).map(e=>e.innerText.replace(/\\s+/g,' ').trim());const form=vis(document.getElementById('ActivityForm_StartDate'));return JSON.stringify({ds,form})})()"));
    const d = st.ds.find(x => /Confirmation Required/.test(x));
    if (d) { rec.confirmations.push(d.replace(/^Confirmation Required\s*/, '')); step('confirmation', d.slice(0, 200)); await ev(c, "(()=>{" + VIS + "const d=[...document.querySelectorAll('.k-dialog')].filter(vis).find(e=>/Confirmation Required/.test(e.innerText));[...d.querySelectorAll('button')].find(b=>b.innerText.trim()==='Yes').click()})()"); continue; }
    const bad = st.ds.find(x => /invalid|incorrect|error|not authoris/i.test(x));
    if (bad) throw new Error('FireWatch said: ' + bad.slice(0, 160));
    if (!st.form) { step('saved', 'form closed'); return; }
  }
  throw new Error('no result from FireWatch after OK');
}
async function bookRanges(ranges, rec, step) {
  const c = await getTab();
  try {
    for (const r of ranges) {
      if (await readback(c, r)) { step('duplicate check', 'already present ' + r.from + ' to ' + r.to); continue; }
      try {
        await openAndFill(c, r, step); await toPinPanel(c, step, rec); await fillPin(c, step); await confirmFlow(c, rec, step);
      } catch (e) { try { await clearDialogs(c); } catch (x) {} return {ok: false, error: e.message, readback: 'n/a'}; }
      await sleep(1500);
      const ok = await readback(c, r); step('read-back', (ok ? 'OK ' : 'NOT FOUND ') + r.from + ' to ' + r.to);
      if (!ok) return {ok: false, error: 'read-back did not find the booking', readback: 'FAIL'};
    }
    return {ok: true, readback: 'OK'};
  } finally { c.close(); }
}
async function verifyRanges(ranges, rec) {
  const c = await getTab();
  try { for (const r of ranges) if (!(await readback(c, r))) return {ok: false}; return {ok: true}; } finally { c.close(); }
}
async function dryRun(ranges, rec, step) {
  const c = await getTab();
  try {
    const r = ranges[0];
    await openAndFill(c, r, step); await toPinPanel(c, step, rec);
    let pinOk = true, err = '';
    try { await fillPin(c, step); } catch (e) { pinOk = false; err = e.message; step('pin check', 'FAILED ' + e.message); }
    await clearDialogs(c);
    const created = await readback(c, r); step('cancelled', created ? 'WARNING range now present' : 'nothing created');
    return {ok: pinOk && !created, error: err || (created ? 'event exists after dry run' : ''), readback: created ? 'present (unexpected)' : 'absent (correct)'};
  } finally { c.close(); }
}
module.exports = {openAndFill, toPinPanel, clearDialogs, ensureCalendar, bookRanges, verifyRanges, dryRun, covered, getTab, readback};




