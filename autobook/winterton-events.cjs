const {listTabs, connect, evalJs} = require('./cdp.cjs');

const fireWatchOrigin = 'https://humberside.firewatch.cloud';
const eventPath = '/FireWatchWebClient/StationManagement/EventRecording';
const publishURL = 'https://live-crewing-winterton-events.paulm-crewing.workers.dev/events';

async function collectInFireWatch(probe) {
  const $ = window.jQuery;
  const grid = $?.('#stationEventSearchResultsGrid').data('kendoGrid');
  if (!grid) throw Error('Open the signed-in FireWatch Event Recording page');
  const criteria = $('#stationEventSearchCriteriaGrid').data('kendoGrid');
  const rules = criteria?.dataSource.data() || [];
  if (rules.length !== 1 || rules[0].Field !== 'Station' || rules[0].Condition !== '=' ||
      !grid.dataSource.view().length || grid.dataSource.view().some(row => row.Station !== 'Winterton')) {
    throw Error('Run Advanced Search with Station = Winterton only');
  }

  const day = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dateTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const [year, month] = day.format(new Date()).split('-').map(Number);
  const since = new Date(Date.UTC(year, month - 3, 1)).toISOString().slice(0, 10);
  const capturedAt = Date.now();
  const events = [];
  const ids = new Set();
  const source = grid.dataSource;
  const originalPage = source.page();
  const refreshPage = page => source.query({page, pageSize: source.pageSize(), sort: source.sort(), filter: source.filter()});
  const visible = node => node?.getClientRects().length;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(find) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const value = find();
      if (value) return value;
      await pause(100);
    }
    throw Error('Timed out loading event details');
  }

  if (visible(document.getElementById('EventForm_Close'))) throw Error('Close the open FireWatch event first');
  const edit = [...grid.element[0].querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit');
  if (!edit) throw Error('FireWatch Event Recording edit control unavailable');
  let expected = 0;
  try {
    await refreshPage(1);
    expected = source.total();
    const pages = source.totalPages();
    for (let page = 1; page <= pages; page++) {
      if (page !== 1) await refreshPage(page);
      if (source.total() !== expected) throw Error('Event results changed during scan');
      for (const row of source.view()) {
        if (row.Station !== 'Winterton' || !row.ID || ids.has(row.ID) || !Number.isFinite(+row.StartDate)) {
          throw Error('Unexpected or duplicate FireWatch event');
        }
        ids.add(row.ID);
        if (day.format(row.StartDate) < since) continue;
        const cell = grid.tbody.find('tr[data-uid]').toArray().find(tr => tr.dataset.uid === row.uid)?.cells[0];
        if (!cell || !Number.isFinite(+row.EndDate)) throw Error('Missing event row or event end');
        cell.click();
        if (edit.disabled) throw Error('FireWatch event detail unavailable');
        edit.click();
        try {
          const detail = await waitFor(() => {
            const close = document.getElementById('EventForm_Close');
            const eventId = document.getElementById('BaseItemModel_EventForm_ID');
            const personnel = $('#eventPersonnelGrid').data('kendoGrid');
            return visible(close) && eventId?.value.trim() === String(row.ID).trim() && personnel && {personnel};
          });
          const note = document.getElementById('EventForm_Comment');
          if (!note) throw Error('Missing event comment field');
          const people = Array.from(detail.personnel.dataSource.data(), person => ({
            name: String(person.Name || '').trim(), comment: person.Comment || null
          }));
          if (people.some(person => !person.name)) throw Error('Missing crew member name');
          events.push({
            id: String(row.ID), type: String(row.EventType || ''), start: dateTime.format(row.StartDate),
            end: dateTime.format(row.EndDate), comment: note.value || null,
            createdBy: null, createdAt: null, people
          });
        } finally {
          const close = document.getElementById('EventForm_Close');
          const dialog = close?.closest('.k-window')?.querySelector('.k-window-content');
          if (dialog) jQuery(dialog).data('kendoWindow')?.close();
          await waitFor(() => !visible(document.getElementById('EventForm_Close')));
        }
        if (probe) return {checked: events.length, people: events[0].people.length, since};
        await pause(200);
      }
    }
    if (ids.size !== expected) throw Error('Not all Winterton grid records were read');
    return {station: 'Winterton', capturedAt, complete: true, events};
  } finally {
    if (source.page() !== originalPage) await refreshPage(originalPage);
  }
}

async function main() {
  const probe = process.argv.includes('--probe');
  const writer = process.env.WINTERTON_EVENTS_PUBLISH_KEY;
  if (!probe && !writer) throw Error('Missing the private Events publisher credential');
  const tabs = await listTabs();
  const matching = tabs.filter(tab => tab.type === 'page' && new URL(tab.url).origin === fireWatchOrigin &&
    new URL(tab.url).pathname === eventPath);
  if (matching.length !== 1) throw Error('Use exactly one signed-in FireWatch Event Recording tab in the relay browser');
  const browser = await connect(matching[0].webSocketDebuggerUrl);
  try {
    const snapshot = await evalJs(browser, '(' + collectInFireWatch + ')(' + probe + ')', probe ? 20000 : 45 * 60 * 1000);
    if (probe) {
      if (!snapshot.checked) throw Error('No event details checked');
      console.log('Verified one Winterton event and its personnel grid. Window starts ' + snapshot.since + '.');
      return;
    }
    const response = await fetch(publishURL, {
      method: 'PUT', headers: {'Content-Type':'application/json', Authorization:'Bearer '+writer},
      body: JSON.stringify(snapshot), redirect: 'error', signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw Error('Private Events publish failed (HTTP '+response.status+')');
    console.log('Published '+snapshot.events.length+' Winterton events.');
  } finally {
    browser.close();
  }
}

main().then(() => process.exit(0), error => {
  console.error(error.message);
  process.exit(1);
});
