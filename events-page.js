/* Events page: real Winterton FireWatch events (private Worker feed). Pure logic first (tested), DOM after. */
(function (root) {
  'use strict';
  var CATS = [
    {id: 'turnout', label: 'Turned out', colour: '28FFFE', verb: 'Turned out'},
    {id: 'attend', label: 'Attended', colour: 'FD50E9', verb: 'Attended'},
    {id: 'drill', label: 'Drill', colour: 'F9BF92', verb: 'Attended'},
    {id: 'training', label: 'Training', colour: '21B4FA', verb: 'Attended'},
    {id: 'efr', label: 'EFR', colour: 'FD42D1', verb: 'Turned out'},
    {id: 'detach', label: 'Detachments', colour: '94CDDB', verb: 'Detached'},
    {id: 'leave', label: 'Leave', colour: 'F1FC31', verb: 'On leave'},
    {id: 'sick', label: 'Sickness', colour: 'FD0022', verb: 'Off sick'}
  ];
  var BYID = {};
  CATS.forEach(function (c) { BYID[c.id] = c; });

  function category(type) {
    var t = String(type || '');
    if (/sick/i.test(t)) return BYID.sick;
    if (/leave|holiday/i.test(t)) return BYID.leave;
    if (/detach/i.test(t)) return BYID.detach;
    if (/first responder/i.test(t)) return BYID.efr;
    if (/drill/i.test(t)) return BYID.drill;
    if (/^(on-call )?training$/i.test(t)) return BYID.training;
    if (/^(incident|drone - fire)$/i.test(t)) return BYID.turnout;
    return BYID.attend;
  }
  function group(type) { return /^FT\b/.test(String(type || '')) ? 'FT' : 'On-Call'; }

  function stamp(s) {
    var q = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ''));
    return q ? Date.UTC(+q[1], +q[2] - 1, +q[3], +q[4], +q[5]) : null;
  }
  function hours(e) {
    var a = stamp(e.start), b = stamp(e.end);
    return a == null || b == null || b < a ? 0 : (b - a) / 36e5;
  }
  function dayOf(e) { return String(e.start || '').slice(0, 10); }

  function period(mode, today) {
    var q = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today || '');
    if (!q) return null;
    var y = +q[1], m = +q[2] - 1, d = +q[3], t = Date.UTC(y, m, d), iso = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
    if (mode === 'month') return {from: iso(Date.UTC(y, m, 1)), to: iso(Date.UTC(y, m + 1, 0))};
    var dow = (new Date(t).getUTCDay() + 6) % 7, from = t - dow * 864e5;
    return {from: iso(from), to: iso(from + 6 * 864e5)};
  }

  function filter(events, f) {
    return (events || []).filter(function (e) {
      var d = dayOf(e);
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      if (f.group && f.group !== 'all' && group(e.type) !== f.group) return false;
      if (f.type && f.type !== 'all' && e.type !== f.type) return false;
      if (f.who && f.who !== 'all' && !e.people.some(function (p) { return p.name === f.who; })) return false;
      return true;
    }).sort(function (a, b) { return b.start.localeCompare(a.start); });
  }

  function aggregate(events) {
    var rows = CATS.map(function (c) { return {id: c.id, label: c.label, colour: c.colour, n: 0, hours: 0}; });
    var by = {};
    rows.forEach(function (r) { by[r.id] = r; });
    var totalHours = 0;
    events.forEach(function (e) {
      var r = by[category(e.type).id], h = hours(e);
      r.n++; r.hours += h; totalHours += h;
    });
    return {rows: rows, total: events.length, hours: totalHours};
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function fmtH(h) { return (Math.round(h * 100) / 100).toString().replace(/\.0+$/, '') + 'h'; }

  function donut(rows, sel) {
    var live = rows.filter(function (r) { return r.hours > 0; }), tot = live.reduce(function (s, r) { return s + r.hours; }, 0);
    if (!tot) return '';
    var R = 70, C = 2 * Math.PI * R, off = 0, segs = '';
    live.forEach(function (r) {
      var len = r.hours / tot * C, gap = live.length > 1 ? Math.min(2, len / 4) : 0, dl = Math.max(0, len - gap), on = sel === r.id;
      segs += '<circle class="dseg' + (on ? ' sel' : '') + '" data-ev-cat="' + r.id + '" cx="100" cy="100" r="' + R + '" fill="none" stroke="#' + r.colour +
        '" stroke-width="' + (on ? 34 : 28) + '" stroke-dasharray="' + dl.toFixed(2) + ' ' + (C - dl).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += len;
    });
    return '<svg viewBox="0 0 200 200" role="img" aria-label="Hours by category" style="max-width:260px;width:100%;display:block;margin:0 auto"><g transform="rotate(-90 100 100)">' + segs +
      '</g><text x="100" y="98" text-anchor="middle" pointer-events="none" style="font:700 26px var(--display);fill:var(--ink)">' + esc(fmtH(tot)) +
      '</text><text x="100" y="118" text-anchor="middle" pointer-events="none" style="font:12px var(--body);fill:var(--mute)">total</text></svg>';
  }

  function eventHtml(e) {
    var c = category(e.type), h = hours(e), n = e.people.length;
    var crew = e.people.map(function (p) {
      return '<div><dt>' + esc(c.verb) + '</dt><dd>' + esc(p.name) + (p.comment ? ' <span style="color:var(--mute)">- ' + esc(p.comment) + '</span>' : '') + '</dd></div>';
    }).join('');
    return '<details class="activity-event"><summary><span class="activity-event-dot" aria-hidden="true" style="background:#' + c.colour + '"></span>' +
      '<span class="activity-event-summary"><strong>' + esc(e.type) + '</strong><span class="activity-event-meta"><span>' + esc(e.start.slice(0, 16)) + ' to ' + esc(String(e.end).slice(11, 16)) +
      '</span><span>' + esc(fmtH(h)) + ' &middot; ' + n + (n === 1 ? ' person' : ' people') + '</span></span></span></summary>' +
      '<dl class="activity-event-detail"><div><dt>Event time</dt><dd>' + esc(e.start) + ' to ' + esc(e.end) + '</dd></div>' +
      '<div><dt>Created by</dt><dd>' + esc(e.createdBy || 'Not recorded') + '</dd></div>' +
      '<div><dt>Comment</dt><dd>' + esc(e.comment || 'No comment') + '</dd></div>' + crew + '</dl></details>';
  }

  var api = {CATS: CATS, category: category, group: group, hours: hours, period: period, filter: filter, aggregate: aggregate, donut: donut, eventHtml: eventHtml, fmtH: fmtH, stamp: stamp};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.EventsPage = api;

  /* ---------- DOM ---------- */
  var ENDPOINT = 'https://live-crewing-winterton-events.paulm-crewing.workers.dev/events', KEY = 'wev-key';
  var doc = root.document, box = doc.getElementById('events-page');
  if (!box) return;
  var state = {snap: null, key: '', pending: false, f: {from: '', to: '', group: 'all', type: 'all', who: 'all'}, mode: 'month', sel: '', msg: ''};
  try { state.key = root.localStorage.getItem(KEY) || ''; } catch (e) {}
  function today() {
    var p = {};
    new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function setMode(mode) { state.mode = mode; var p = period(mode, today()); state.f.from = p.from; state.f.to = p.to; state.sel = ''; }
  setMode('month');

  function render() {
    var s = state.snap, html = '';
    if (!state.key) {
      box.innerHTML = '<div class="card"><h2>FireWatch events</h2><form id="ev-key-form"><label>Private Events access key <input name="k" type="password" required autocomplete="off"></label> <button type="submit" class="btn">Connect</button></form><p class="note" role="status">' + esc(state.msg) + '</p></div>';
      return;
    }
    if (!s) { box.innerHTML = '<div class="card"><p class="note" role="status">' + esc(state.msg || 'Loading Winterton events...') + '</p></div>'; return; }
    var all = s.events, types = {};
    all.forEach(function (e) { types[e.type] = group(e.type); });
    var names = {};
    all.forEach(function (e) { e.people.forEach(function (p) { names[p.name] = 1; }); });
    var list = filter(all, state.f), ag = aggregate(list);
    var opt = function (v, l, cur) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; };
    var typeOpts = opt('all', 'All event types', state.f.type) + ['On-Call', 'FT'].map(function (g) {
      var ts = Object.keys(types).filter(function (t) { return types[t] === g; }).sort();
      return ts.length ? '<optgroup label="' + g + '">' + ts.map(function (t) { return opt(t, t, state.f.type); }).join('') + '</optgroup>' : '';
    }).join('');
    var age = Math.max(0, Math.floor((Date.now() - s.capturedAt) / 60000));
    html += '<div class="card"><div class="pseg" id="ev-mode"><button type="button" data-evm="week"' + (state.mode === 'week' ? ' class="on"' : '') + '>This week</button><button type="button" data-evm="month"' + (state.mode === 'month' ? ' class="on"' : '') + '>This month</button></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><label style="flex:1;min-width:0">From <input type="date" id="ev-from" value="' + esc(state.f.from) + '" style="width:100%"></label><label style="flex:1;min-width:0">To <input type="date" id="ev-to" value="' + esc(state.f.to) + '" style="width:100%"></label></div>' +
      '<div class="pseg" id="ev-group" style="margin-top:10px">' + ['all', 'On-Call', 'FT'].map(function (g) { return '<button type="button" data-evg="' + g + '"' + (state.f.group === g ? ' class="on"' : '') + '>' + (g === 'all' ? 'All' : g) + '</button>'; }).join('') + '</div>' +
      '<select id="ev-type" aria-label="Event type" style="width:100%;margin-top:10px">' + typeOpts + '</select>' +
      '<select id="ev-who" aria-label="Crew member" style="width:100%;margin-top:10px">' + opt('all', 'All crew', state.f.who) + Object.keys(names).sort().map(function (n) { return opt(n, n, state.f.who); }).join('') + '</select>' +
      '<p class="note" style="margin:10px 0 0" role="status">FireWatch Event Recording &middot; synced ' + age + ' min ago' + (age >= 75 ? ' &middot; overdue' : '') + ' &middot; ' + ag.total + ' events &middot; <button type="button" id="ev-forget" class="btn" style="padding:2px 8px">Forget key</button></p></div>';
    var sel = ag.rows.filter(function (r) { return r.id === state.sel; })[0];
    html += '<div class="card"><h2>Hours by category</h2>' + (donut(ag.rows, state.sel) || '<p class="note" style="margin:0">No events in this period</p>') +
      '<div style="margin-top:8px;font-size:13px;color:var(--mute);min-height:20px">' + (sel ? '<b style="color:var(--ink)">' + esc(sel.label) + '</b>: ' + esc(fmtH(sel.hours)) + ' &middot; ' + sel.n + ' events' : 'Tap a slice for its hours') + '</div>' +
      '<ul style="list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;font-size:13px">' + ag.rows.map(function (r) {
        return '<li data-ev-cat="' + r.id + '" style="display:flex;align-items:center;gap:8px;cursor:pointer"><span style="width:10px;height:10px;border-radius:3px;background:#' + r.colour + '"></span><span style="flex:1">' + esc(r.label) + '</span><span>' + esc(fmtH(r.hours)) + ' &middot; ' + r.n + '</span></li>';
      }).join('') + '<li style="display:flex;gap:8px;border-top:1px solid var(--line);padding-top:4px"><b style="flex:1">Total</b><b>' + esc(fmtH(ag.hours)) + ' &middot; ' + ag.total + '</b></li></ul></div>';
    var shown = state.sel ? list.filter(function (e) { return category(e.type).id === state.sel; }) : list;
    html += '<div class="card"><h2>All events</h2>' + (shown.length ? '<div class="activity-events">' + shown.map(eventHtml).join('') + '</div>' : '<p class="note" style="margin:0">No events match</p>') + '</div>';
    box.innerHTML = html;
  }

  async function refresh() {
    if (!state.key || state.pending) return;
    state.pending = true;
    try {
      var r = await fetch(ENDPOINT, {headers: {Authorization: 'Bearer ' + state.key}, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000)});
      if (r.status === 403) { state.key = ''; state.snap = null; try { root.localStorage.removeItem(KEY); } catch (e) {} state.msg = 'Private Events access denied.'; render(); return; }
      if (!r.ok) throw new Error('unavailable');
      var next = await r.json();
      if (next.station !== 'Winterton' || next.complete !== true || !Array.isArray(next.events)) throw new Error('invalid');
      if (!Number.isSafeInteger(next.capturedAt)) throw new Error('invalid');
      if (!state.snap || next.capturedAt > state.snap.capturedAt) { state.snap = next; state.msg = ''; render(); }
    } catch (e) {
      state.msg = state.snap ? '' : 'Private Winterton feed unavailable.';
      if (!state.snap) render();
    } finally { state.pending = false; }
  }

  box.addEventListener('submit', function (e) {
    if (e.target.id !== 'ev-key-form') return;
    e.preventDefault();
    var k = e.target.elements.k.value.trim();
    if (!k) return;
    state.key = k; try { root.localStorage.setItem(KEY, k); } catch (x) {}
    state.msg = 'Loading Winterton events...'; render(); refresh();
  });
  box.addEventListener('click', function (e) {
    var t = e.target, m = t.closest('[data-evm]'), g = t.closest('[data-evg]'), c = t.closest('[data-ev-cat]');
    if (t.id === 'ev-forget') { state.key = ''; state.snap = null; try { root.localStorage.removeItem(KEY); } catch (x) {} state.msg = ''; render(); return; }
    if (m) { setMode(m.dataset.evm); render(); return; }
    if (g) { state.f.group = g.dataset.evg; state.f.type = 'all'; render(); return; }
    if (c) { state.sel = state.sel === c.dataset.evCat ? '' : c.dataset.evCat; render(); }
  });
  box.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'ev-from') { state.f.from = e.target.value; state.mode = ''; }
    else if (id === 'ev-to') { state.f.to = e.target.value; state.mode = ''; }
    else if (id === 'ev-type') state.f.type = e.target.value;
    else if (id === 'ev-who') state.f.who = e.target.value;
    else return;
    state.sel = ''; render();
  });

  var src = doc.getElementById('station-data-source');
  function sync() {
    var on = src && src.value === 'firewatch';
    box.hidden = !on;
    if (on) { render(); refresh(); }
  }
  if (src) {
    src.addEventListener('change', sync);
    src.value = 'firewatch';
    src.dispatchEvent(new Event('change'));
  }
  root.setInterval(function () { if (!doc.hidden && !box.hidden) refresh(); }, 60000);
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden && !box.hidden) refresh(); });
})(typeof window !== 'undefined' ? window : globalThis);
