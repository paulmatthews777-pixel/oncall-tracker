// Isolated browser, actual client + virtual WebAuthn + actual local Worker. All network intercepted.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),origin='https://paulmatthews777-pixel.github.io',relayURL='https://live-crewing-relay.paulm-crewing.workers.dev';
let browser,ws,h,profile;const pending=new Map();let next=0;
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++next,t=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'))},20000);
    pending.set(id,{resolve:r=>{clearTimeout(t);resolve(r)},reject:e=>{clearTimeout(t);reject(e)}});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
}
async function until(expression){
  const end=Date.now()+15000;
  while(!await evaluate(expression)){if(Date.now()>end)throw Error('Condition timeout: '+expression)}
}
async function main(){
  const {harness}=await import(pathToFileURL(path.join(process.env.RELAY_PROJECT_DIR||path.join(os.homedir(),'relay'),'tests/harness.js')).href);
  h=await harness();
  profile=fs.mkdtempSync(path.join(__dirname,'.bookoff-profile-'));
  browser=spawn(process.env.EDGE_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--disable-extensions','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
    {stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{
    let text='';const t=setTimeout(()=>reject(Error('Browser startup timeout')),15000);
    browser.once('error',reject);browser.stderr.on('data',b=>{text+=b;const m=/DevTools listening on (ws:\/\/\S+)/.exec(text);if(m){clearTimeout(t);resolve(m[1])}});
  });
  const base=endpoint.replace(/^ws:/,'http:').replace(/\/devtools\/browser\/.*/,'');
  const tab=await fetch(base+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
  ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  const errors=[],allowed=new Set(['index.html','bookoff-client.js','security-setup.js','security-setup.html','manifest.webmanifest','csv-audit.js','audit-xlsx.js','icon-crewing-192.png','icon-crewing-512.png','startup-crewing.jpg']);
  const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
  ws.onmessage=async ev=>{
    const m=JSON.parse(ev.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}return}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Fetch.requestPaused'){
      const {requestId,request}=m.params;let status=404,headers={'Content-Type':'text/plain'},body='Blocked external resource';
      try{
        const u=new URL(request.url);
        if(request.url.startsWith(relayURL+'/')){
          const r=await h.mf.dispatchFetch('https://relay.test'+u.pathname+u.search,{method:request.method,headers:request.headers,body:request.method==='POST'?request.postData:undefined});
          status=r.status;headers=Object.fromEntries(r.headers);body=await r.text();
        }else if(u.origin===origin&&u.pathname.startsWith('/oncall-tracker/')){
          const file=u.pathname.slice('/oncall-tracker/'.length)||'index.html';
          if(allowed.has(file)){status=200;headers={'Content-Type':types[path.extname(file)]||'application/octet-stream'};body=fs.readFileSync(path.join(root,file))}
        }
        await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:Object.entries(headers).map(([name,value])=>({name,value})),body:Buffer.from(body).toString('base64')});
      }catch(e){errors.push(e.message);await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
    }
  };
  await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:true});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"if(navigator.serviceWorker)navigator.serviceWorker.register=async()=>{throw Error('Disabled in isolated test')}"});
  await send('WebAuthn.enable');
  await send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',ctap2Version:'ctap2_1',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await send('Page.navigate',{url:origin+'/oncall-tracker/'});
  await until("document.readyState==='complete' && typeof BookOffSecurity!=='undefined' && typeof verifyBookOff==='function'");
  assert.equal(await evaluate('isSecureContext'),true);
  await evaluate("document.getElementById('splash')?.remove();localStorage.setItem('oncall-relay-key','LOCAL_SAMPLE_RELAY_KEY')");
  const enrol=await evaluate(`BookOffSecurity.create({url:${JSON.stringify(relayURL)},key:'LOCAL_SAMPLE_RELAY_KEY',storage:localStorage,verify:get=>get()}).enrol('LOCAL_SAMPLE_OWNER_TOKEN_32_CHARACTERS_ONLY')`);
  assert.equal(enrol.registered,true);
  const probe=await evaluate(`BookOffSecurity.create({url:${JSON.stringify(relayURL)},key:'LOCAL_SAMPLE_RELAY_KEY',storage:localStorage,verify:get=>get()}).probe()`);
  assert.equal(probe.verified,true);assert.equal(probe.queued,false);
  console.log('browser: actual virtual-authenticator registration and non-queuing probe PASS');
  await evaluate(`document.getElementById('cfd').value='2099-04-02';document.getElementById('cft').value='18:00';document.getElementById('ctd').value='2099-04-03';document.getElementById('ctt').value='06:00';document.getElementById('csend').click()`);
  await until("!!document.querySelector('dialog[open] button[value=yes]')");
  await evaluate("document.querySelector('dialog[open] button[value=yes]').click()");
  await until("!!document.querySelector('dialog[open] button[type=button]')");
  await evaluate("document.querySelector('dialog[open] button[type=button]').click()");
  await until("window.lastBookOffSend?.ok===true");
  assert.match(await evaluate("document.getElementById('cnote').textContent"),/Waiting for FireWatch/);
  const st=await h.storage();assert.equal((await st.list({prefix:'q:'})).size,1);
  console.log('browser: custom review → real WebAuthn API virtual assertion → verified local queue PASS');
  await evaluate(`window.cancelResult=null;void relaySend('Contract Book Off\\n#BOOK [{"from":"2099-04-04T18:00","to":"2099-04-05T06:00"}]').then(r=>window.cancelResult=r)`);
  await until("!!document.querySelector('dialog[open] button[value=cancel]')");
  await evaluate("document.querySelector('dialog[open] button[value=cancel]').click()");
  await until("window.cancelResult===false");
  assert.equal((await st.list({prefix:'q:'})).size,1);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.deepEqual(errors,[]);
  console.log('browser: cancellation leaves queue unchanged; phone width and no uncaught exceptions PASS');
  console.log('No live Worker, real credential enrollment, FireWatch writes or signed-in browser used.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
  ws?.close();for(const p of pending.values())p.reject(Error('Test closing'));pending.clear();
  if(browser){const closed=new Promise(r=>browser.once('exit',r));browser.kill();await closed}
  if(h)await h.mf.dispose();
  if(profile)try{fs.rmSync(profile,{recursive:true,force:true})}catch{}
});
