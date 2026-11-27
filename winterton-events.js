(() => {
  const section = document.getElementById('winterton-events');
  const status = document.getElementById('winterton-events-status');
  const list = document.getElementById('winterton-events-list');
  const connect = document.getElementById('winterton-events-connect');
  const planner = document.getElementById('planner-event-history');
  const source = document.getElementById('station-data-source');
  const endpoint = 'https://live-crewing-winterton-events.paulm-crewing.workers.dev/events';
  let credential = '';
  let pending = false;
  let snapshot = null;
  let type = '';
  let person = '';
  let position = 0;

  function element(tag, value) {
    const node = document.createElement(tag);
    if (value != null) node.textContent = value;
    return node;
  }

  function selector(label, values, selected, change) {
    const wrapper = element('label', label+' ');
    const select = element('select');
    for (const value of values) {
      const option = element('option', value || 'All');
      option.value = value;
      select.append(option);
    }
    select.value = selected;
    select.addEventListener('change', () => {
      change(select.value);
      position = 0;
      render();
      list.querySelector('[aria-label="'+label+'"]').focus();
    });
    select.setAttribute('aria-label', label);
    wrapper.append(select);
    return wrapper;
  }

  function render() {
    const events = [...snapshot.events].sort((a, b) => b.start.localeCompare(a.start));
    const types = [...new Set(events.map(event => event.type))].sort();
    if (type && !types.includes(type)) type = '';
    const typed = events.filter(event => !type || event.type === type);
    const names = [...new Set(typed.flatMap(event => event.people.map(item => item.name)))].sort();
    if (person && !names.includes(person)) person = '';
    const matches = typed.filter(event => !person || event.people.some(item => item.name === person));
    position = Math.min(position, Math.max(0, matches.length - 1));
    list.replaceChildren(
      selector('Event type', ['', ...types], type, value => {type = value; person = ''}),
      selector('Crew member', ['', ...names], person, value => {person = value})
    );
    const event = matches[position];
    if (!event) {
      list.append(element('p', 'No matching Winterton events.'));
      return;
    }
    const fields = element('dl');
    const add = (label, value) => fields.append(element('dt', label), element('dd', value ?? 'Unavailable in FireWatch export'));
    add('Event time', event.start + ' to ' + event.end);
    add('Added by', event.createdBy);
    add('Added at', event.createdAt);
    add('Event comment', event.comment ?? 'No comment supplied');
    const personnel = person ? event.people.filter(item => item.name === person) : event.people;
    for (const item of personnel) add(item.name, item.comment ?? 'No personnel comment supplied');
    const navigation = element('div');
    navigation.className = 'pseg';
    function button(label, step) {
      const control = element('button', label);
      control.type = 'button';
      control.disabled = position + step < 0 || position + step >= matches.length;
      control.addEventListener('click', () => {
        position += step;
        render();
        const buttons = [...list.querySelectorAll('button:not(:disabled)')];
        (buttons.find(item => item.textContent === label) || buttons[0])?.focus();
      });
      return control;
    }
    const counter = element('span', (position + 1) + ' of ' + matches.length);
    counter.setAttribute('aria-live','polite');
    navigation.append(button('Previous', -1), counter, button('Next', 1));
    list.append(element('h3', event.type), fields, navigation);
  }

  async function refresh() {
    if (!credential || pending) return;
    pending = true;
    try {
      const result = await fetch(endpoint, {
        headers: {Authorization: 'Bearer ' + credential}, credentials: 'omit',
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000)
      });
      if (result.status === 403) {
        credential = '';
        snapshot = null;
        list.replaceChildren();
        connect.hidden = false;
        status.textContent = 'Private Events access denied.';
        return;
      }
      if (!result.ok) throw new Error('Unavailable');
      const next = await result.json();
      if (next.station !== 'Winterton' || next.complete !== true || !Number.isSafeInteger(next.capturedAt) || !Array.isArray(next.events)) throw new Error('Invalid snapshot');
      if (!snapshot || next.capturedAt > snapshot.capturedAt) {
        snapshot = next;
        render();
      }
      connect.hidden = true;
      const age = Math.max(0, Math.floor((Date.now() - snapshot.capturedAt) / 60000));
      status.textContent = 'FireWatch Event Recording · synced ' + age + ' min ago' + (age >= 75 ? ' · overdue' : '');
    } catch {
      status.textContent = snapshot ? 'Refresh failed · showing the last Winterton snapshot' : 'Private Winterton feed unavailable.';
    } finally {
      pending = false;
    }
  }

  source.addEventListener('change', () => {
    const firewatch = source.value === 'firewatch';
    section.hidden = !firewatch;
    planner.hidden = firewatch;
    if (firewatch) refresh();
  });

  connect.addEventListener('submit', event => {
    event.preventDefault();
    if (pending) return;
    const input = connect.elements.namedItem('events-key');
    credential = input.value.trim();
    input.value = '';
    refresh();
  });
  setInterval(() => {
    if (!document.hidden && section.getClientRects().length) refresh();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && section.getClientRects().length) refresh();
  });
})();
