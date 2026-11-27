const {listTabs, connect, evalJs} = require('./cdp.cjs');

const origin = 'https://humberside.firewatch.cloud';
const path = '/FireWatchWebClient/StationManagement/EventRecording';
const worker = 'https://live-crewing-winterton-events.paulm-crewing.workers.dev';

async function collectInFireWatch({action, rows}) {
  const $ = window.jQuery;
  const grid = $?.('#stationEventSearchResultsGrid').data('kendoGrid');
  if (!grid) throw Error('Open signed-in FireWatch Event Recording');
  const source = grid.dataSource;
  if (action === "available") {
    const rules = $("#stationEventSearchCriteriaGrid").data("kendoGrid")?.dataSource.data() || [];
    const busy = [...document.querySelectorAll(".k-window-content")].some(dialog =>
      dialog.getClientRects().length && dialog.querySelector("#BaseItemModel_EventForm_ID"));
    return {eligible: !busy && rules.length === 1 && rules[0].Field === "Station" && rules[0].Condition === "=" &&
      source.view().length > 0 && source.view().every(row => row.Station === "Winterton"),
      visible: document.visibilityState === "visible"};
  }
  if (action === 'sample') {
    const sample = source.view().slice(0, 6);
    if (sample.some(row => row.Station !== 'Winterton')) throw Error('Use the Winterton search for the probe');
    return sample.map(row => ({row: JSON.stringify(row.toJSON()), event: {id: String(row.ID)}}));
  }

  // Telerik embeds JSON inside its grid setup script. Extract only the JSON object.
  function personnelPayload(script) {
    const marker = /"data"\s*:\s*(\{\s*"Data"\s*:\s*\[)/.exec(script);
    if (!marker) throw Error('Personnel payload missing');
    const start = marker.index + marker[0].indexOf('{');
    let depth = 0, quoted = false, escape = false;
    for (let i = start; i < script.length; i++) {
      const char = script[i];
      if (quoted) {
        if (escape) escape = false;
        else if (char === '\\') escape = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return JSON.parse(script.slice(start, i + 1));
    }
    throw Error('Personnel payload truncated');
  }

  if (action === 'details') {
    return Promise.all(rows.map(async wire => {
      try {
        const row = JSON.parse(wire);
        const pieces = await $.ajax({
          url: location.pathname + '/GetEventDialog', type: 'POST',
          data: wire, contentType: 'application/json; charset=utf-8',
          dataType: 'json', timeout: 25000
        });
        const fragment = Array.isArray(pieces) && pieces.find(piece =>
          typeof piece.html === 'string' && piece.html.includes('eventPersonnelGrid'));
        if (!fragment) throw Error('Event details missing');
        const doc = new DOMParser().parseFromString(fragment.html, 'text/html');
        if (doc.querySelector('#BaseItemModel_EventForm_ID')?.value !== String(row.ID)) {
          throw Error('Event identity mismatch');
        }
        const comment = doc.querySelector('#EventForm_Comment');
        const script = [...doc.scripts].find(node =>
          /jQuery\("#eventPersonnelGrid"\)\.kendoGrid/.test(node.textContent));
        if (!comment || !script) throw Error('Event comment or Personnel grid missing');
        const {Data, Total} = personnelPayload(script.textContent);
        if (!Array.isArray(Data) || Data.length !== Total) throw Error('Incomplete Personnel grid');
        const people = Data.map(person => ({
          name: String(person.Name || '').trim(), comment: person.Comment || null
        }));
        if (people.some(person => !person.name)) throw Error('Unnamed Personnel row');
        const creator = [...doc.querySelectorAll('li')].map(el => el.textContent.trim())
          .find(text => /^Event created by\b/i.test(text));
        const createdBy = creator?.replace(/^Event created by\s*(?:Employee\s+\d+\s*:\s*)?/i, '').trim() || null;
        return {ok: true, comment: comment.value || null, createdBy, people};
      } catch (error) {
        return {ok: false, error: error instanceof Error ? error.message : 'FireWatch detail HTTP ' + (error?.status || 'unknown')};
      }
    }));
  }

  const rules = $('#stationEventSearchCriteriaGrid').data('kendoGrid')?.dataSource.data() || [];
  if (rules.length !== 1 || rules[0].Field !== 'Station' || rules[0].Condition !== '=' ||
      !source.view().length || source.view().some(row => row.Station !== 'Winterton')) {
    throw Error('Run Advanced Search with Station = Winterton only');
  }
  const day = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dateTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const [year, month, today] = day.format(new Date()).split('-').map(Number);
  const previousLast = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const since = new Date(Date.UTC(year, month - 2, Math.min(today, previousLast))).toISOString().slice(0, 10);
  const until = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const capturedAt = Date.now();
  const ids = new Set(), events = [];
  const first = source.page();
  const page = number => source.query({page: number, pageSize: source.pageSize(), sort: source.sort(), filter: source.filter()});
  try {
    await page(1);
    const count = source.total(), pages = source.totalPages();
    for (let i = 1; i <= pages; i++) {
      if (i !== 1) await page(i);
      if (source.total() !== count) throw Error('FireWatch result count changed during scan');
      for (const row of source.view()) {
        const id = String(row.ID ?? '');
        if (row.Station !== 'Winterton' || !id || ids.has(id) || !Number.isFinite(+row.StartDate)) {
          throw Error('Unexpected or repeated FireWatch event');
        }
        ids.add(id);
        const date = day.format(row.StartDate);
        if (date < since || date >= until) continue;
        if (!row.EventType || !Number.isFinite(+row.EndDate)) throw Error('FireWatch event missing time or type');
        events.push({row: JSON.stringify(row.toJSON()), event: {
          id, type: String(row.EventType), start: dateTime.format(row.StartDate), end: dateTime.format(row.EndDate),
          version: typeof row.RowVersion === 'string' && row.RowVersion ? row.RowVersion : null
        }});
      }
    }
    if (ids.size !== count) throw Error('FireWatch scan missed rows');
    return {since, until, capturedAt, events};
  } finally {
    if (source.page() !== first) await page(first);
  }
}

async function main() {
  const probe = process.argv.includes('--probe');
  const writer = process.env.WINTERTON_EVENTS_PUBLISH_KEY;
  if (!probe && !writer) throw Error('Missing private Events publisher credential');
  const matching = (await listTabs()).filter(tab => tab.type === 'page' &&
    new URL(tab.url).origin === origin && new URL(tab.url).pathname === path);
  const candidates = [];
  const read = (browser, args) =>
    evalJs(browser, '(' + collectInFireWatch + ')(' + JSON.stringify(args) + ')', 35000);
  for (const tab of matching) {
    const candidate = await connect(tab.webSocketDebuggerUrl);
    try {
      const status = await read(candidate, {action: 'available'});
      if (status.eligible) {
        candidates.push({browser: candidate, visible: status.visible});
        continue;
      }
    } catch {
      // A loading or signed-out tab cannot be used for this run.
    }
    candidate.close();
  }
  const visible = candidates.filter(candidate => candidate.visible);
  const selected = candidates.length === 1 ? candidates[0] : visible.length === 1 ? visible[0] : null;
  for (const candidate of candidates) if (candidate !== selected) candidate.browser.close();
  if (!selected) throw Error('Open an idle FireWatch Event Recording tab with Station = Winterton');
  const browser = selected.browser;
  const collect = args => read(browser, args);
  const request = async (pathname, body) => {
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(worker + pathname, {
          method: body ? 'PUT' : 'GET', headers: {Authorization: 'Bearer ' + writer, 'Content-Type': 'application/json'},
          body: body && JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000)
        });
      } catch (error) {
        if (attempt) throw error;
      }
      if (response && response.status < 500 && response.status !== 429) break;
    }
    if (!response?.ok) throw Error('Private Events HTTP ' + (response?.status || 'unavailable'));
    return response.json();
  };
  try {

    const batches = async (entries, consume) => {
      for (let i = 0; i < entries.length; i += 6) {
        const batch = entries.slice(i, i + 6);
        const results = await collect({action: 'details', rows: batch.map(item => item.row)});
        for (let j = 0; j < batch.length; j++) {
          if (!results[j]?.ok) throw Error('FireWatch detail failed after '+(i+j)+' entries: '+results[j]?.error);
          const {comment, createdBy, people} = results[j];
          consume({...batch[j].event, comment, createdBy, createdAt: null, people});
        }
      }
    };
    if (probe) {
      const sample = await collect({action: 'sample'});
      if (!sample.length) throw Error('No Winterton entries in the lookback window');
      let people = 0, authors = 0;
      await batches(sample, item => {people += item.people.length; authors += Number(Boolean(item.createdBy))});
      console.log('Verified '+sample.length+' details, '+people+' Personnel rows and '+authors+' creator labels.');
      return;
    }
    const inventory = await collect({action: 'list'});
    const manifest = await request('/manifest');
    const months = [inventory.since.slice(0, 7), inventory.until.slice(0, 7)];
    const previous = new Date(inventory.until + 'T00:00:00Z');
    previous.setUTCDate(0);
    months[1] = previous.toISOString().slice(0, 7);
    for (const month of [...new Set(months)].reverse()) {
      const stored = new Map((manifest.events || []).map(event => [event.id, event]));
      const records = inventory.events.filter(item => item.event.start.startsWith(month));
      const reused = records.filter(item => item.event.version && stored.get(item.event.id)?.version === item.event.version && stored.get(item.event.id)?.start === item.event.start);
      const unchanged = new Set(reused.map(item => item.event.id));
      const events = [];
      await batches(records.filter(item => !unchanged.has(item.event.id)), item => events.push(item));
      await request('/events', {
        station: 'Winterton', complete: true, capturedAt: inventory.capturedAt, mode: 'month', month,
        since: inventory.since, until: inventory.until, unchanged: reused.map(({event}) => ({id: event.id, version: event.version})), events
      });
      console.log('Published '+month+': '+records.length+' events, '+events.length+' details fetched, '+unchanged.size+' reused.');
    }
  } finally {
    browser.close();
  }
}

main().then(() => process.exit(0), error => {
  console.error(error.message);
  process.exit(1);
});
