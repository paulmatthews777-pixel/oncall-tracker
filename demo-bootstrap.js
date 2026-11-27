(function () {
  if (new URLSearchParams(location.search).get('demo') !== '1') return;

  // A sandboxed frame gives this app an opaque origin, away from live storage.
  // Refuse to start if it is ever opened without that isolation.
  if (window === window.top || window.origin !== 'null') {
    document.documentElement.textContent = 'Open Demo mode from the Live Crewing menu.';
    throw new Error('Demo must run inside the isolated frame');
  }

  window.__demoMode = true;
  const values = new Map();
  const memory = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); }
  };
  Object.defineProperty(window, 'localStorage', { configurable: false, value: memory });
  Object.defineProperty(window, 'sessionStorage', { configurable: false, value: memory });
  window.fetch = () => Promise.reject(new TypeError('Live connections are disabled in Demo mode'));
  window.XMLHttpRequest = function () { throw new Error('Live connections are disabled in Demo mode'); };
  window.WebSocket = function () { throw new Error('Live connections are disabled in Demo mode'); };
  window.EventSource = function () { throw new Error('Live connections are disabled in Demo mode'); };
  if (navigator.sendBeacon) navigator.sendBeacon = () => false;

  const now = Date.now();
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 7);
  const entries = [];
  for (let i = 0; i < 70; i++) {
    const date = new Date(start.getTime() + i * 86400000);
    const day = date.getUTCDay();
    const ds = date.toISOString().slice(0, 10);
    const morningStart = ['06:00','07:00','08:00'][Math.floor(Math.random()*3)];
    entries.push({date: ds, start: morningStart, end: '18:00', type: 'avail', band: day === 0 || day === 6 ? 'P4' : 'P1'});
    entries.push({date: ds, start: '18:00', end: '00:00', type: 'avail', band: day === 5 || day === 6 ? 'P3' : 'U'});
    entries.push({date: ds, start: '00:00', end: '06:00', type: 'avail', band: day === 0 || day === 6 ? 'P3' : 'U'});
  }
  memory.setItem('oncall-tracker-v2', JSON.stringify({entries, source: 'example', importedAt: now}));
  const month = new Date(now).toISOString().slice(0, 7);
  memory.setItem('oncall-pay', JSON.stringify({at: new Date(now).toISOString(), data: {months: {
    [month]: {total: 450.00, totalHours: 36, status: {Authorised: true}, items: {'Drill Hour(s)': [36, 450.00]}}
  }}}));
  const currentDay = new Date(now).toISOString().slice(0, 10);
  const exampleYear = Number(currentDay.slice(0,4));
  memory.setItem('oncall-holiday', JSON.stringify({at:new Date(now).toISOString(), data:{remaining:100, leaveYear:{from:exampleYear+'-01-01',to:(exampleYear+1)+'-01-01',confirmed:false}, entries:[
    {from:currentDay+'T08:00', to:currentDay+'T16:00', h:8}
  ]}}));
  const dates = Array.from({length: 15}, (_, i) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()+i)).toISOString().slice(0,10));
  const people = ['Alex Example','Sam Sample','Taylor Demo','Jordan Sample','Morgan Example'].map((name, i)=>({
    name, role:i===0?'OIC':'FF', q:i<3?'BA':'', iv:[[0, dates.length*1440]], bars:[]
  }));
  const specs = [['CT',4,5,5],['BA',2,2,3],['ERD',1,1,1],['OIC',1,1,1]];
  const base = Math.floor(Date.parse(dates[0]+'T00:00:00Z')/60000);
  memory.setItem('oncall-range', JSON.stringify({v:3,t:now,base,dates,people,rows:specs.map(([name,min,plan,n])=>({
    name,g:'Crewing',min,plan,n:dates.map(()=>Array(24).fill(String(n)))
  }))}));
  const liveBase = Math.floor(now/3600000)*60;
  memory.setItem('oncall-live', JSON.stringify({v:2,t:now,base:liveBase,people:people.map(p=>({...p,iv:[[0,2880]]})),
    rows:specs.map(([name,min,plan,n])=>({name,min,plan,n:Array(48).fill(String(n)),c:Array(48).fill('g')}))
  }));
  const checkNames=['App tests','Live site version','Autobook','Booking Chrome signed in',
    'Planner feed','Relay heartbeat','Code copies in sync','Chrome port clients','Updates available'];
  const exampleChecks=Object.fromEntries(checkNames.map(name=>[name,{status:'ok',detail:'Fictional example result'}]));
  window.__demoDailyCheck={ok:true,data:{latest:{at:new Date(now).toISOString(),checks:exampleChecks},history:[]}};
  window.__demoReconciliation={status:'matched',capturedAt:now,sourceCount:2,missing:[],changed:[],
    categories:[{type:'Drill',source:1,missing:0},{type:'Incident',source:1,missing:0}],
    since:currentDay,until:new Date(now+86400000).toISOString().slice(0,10)};
  window.__demoEvents = {station:'Winterton', complete:true, capturedAt:now, events:[
    {id:'example-1',type:'Drill',start:currentDay+' 09:00',end:currentDay+' 11:00',comment:'Fictional training',createdBy:'Alex Example',createdAt:null,people:[{name:'Alex Example',comment:''},{name:'Sam Sample',comment:''}]},
    {id:'example-2',type:'Incident',start:currentDay+' 12:00',end:currentDay+' 13:00',comment:'Fictional incident',createdBy:'Sam Sample',createdAt:null,people:[{name:'Sam Sample',comment:''}]}
  ]};
  memory.setItem('oncall-device-personal', JSON.stringify({name:'Alex Example', brigade:'1234', email:'alex@example.invalid', mobile:'07000 000000'}));
  memory.setItem('oncall-booking-results', JSON.stringify([
    {id:'demo-booking-1', at:now - 3600000, status:'booked'},
    {id:'demo-booking-2', at:now - 86400000, status:'failed', report:'Example booking could not be confirmed.'}
  ]));


  // A CSP gives defence in depth for network APIs and form submissions.
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'self'; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'";
  document.head.appendChild(policy);
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'cfmYes') {
      event.preventDefault();
      event.stopImmediatePropagation();
      button.textContent = 'Demo complete · no booking sent';
      button.disabled = true;
    } else if (button.id === 'csend') {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('Demo mode: booking is disabled. No request was sent.');
    }
  }, true);
  document.addEventListener('submit', event => {
    if (event.target.id !== 'personal-form') event.preventDefault();
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.createElement('div');
    badge.textContent = 'DEMO MODE · Fictional data · Live connections disabled';
    badge.setAttribute('role', 'status');
    badge.style.cssText = 'position:sticky;top:0;z-index:99;background:#60471a;color:#fff;padding:8px 12px;text-align:center;font-weight:700';
    document.body.prepend(badge);
    const examples = document.createElement('div');
    examples.className = 'card';
    const title = document.createElement('h2');
    title.textContent = 'Example notifications';
    const message = document.createElement('p');
    message.textContent = 'Booking result ready · Example booking confirmed';
    const other = document.createElement('p');
    other.textContent = 'Activity added · Example training drill';
    examples.append(title, message, other);
    document.getElementById('t-notifications').append(examples);

    document.querySelectorAll('a[href="./demo.html"]').forEach(link => {
      link.textContent = 'Use Exit Demo at the top of the screen';
      link.removeAttribute('href');
      link.removeAttribute('target');
    });
  });
})();
