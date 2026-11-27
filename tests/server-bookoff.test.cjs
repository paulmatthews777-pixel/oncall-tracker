// Actual client file against actual Worker + DO + signature verifier. No live services.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{pathToFileURL}=require('node:url'),os=require('node:os');
test('app Book Off approval uses local Worker and never resends an uncertain request',async t=>{
  const relay=process.env.RELAY_PROJECT_DIR||path.join(os.homedir(),'relay');
  const {harness}=await import(pathToFileURL(path.join(relay,'tests/harness.js')).href);
  const {device}=await import(pathToFileURL(path.join(relay,'tests/fixtures.js')).href);
  const h=await harness();t.after(()=>h.mf.dispose());const d=device();
  const o=await h.call('/auth/register/options',{}, {owner:true});
  assert.equal((await h.call('/auth/register/verify',{response:d.register(o.body.publicKey)},{owner:true})).status,200);
  const store=new Map(),paths=[],receipts=[];
  let behaviour='valid',lose=false,neverDelivered=false,fakeNow=Date.now();
  const context={
    isSecureContext:true,crypto:require('node:crypto').webcrypto,TextEncoder,AbortSignal,Date:{now:()=>fakeNow},
    btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    trackBookingResult:r=>receipts.push(r),
    fetch:async(url,options)=>{
      const p=new URL(url).pathname;paths.push(p);
      if(p==='/req'&&neverDelivered)throw Error('POST never left device');
      const u=new URL(url),r=await h.call(p+u.search,options.body?JSON.parse(options.body):undefined);
      if(p==='/req'&&lose)throw Error('Response lost after server accepted');
      return {ok:r.status<300,status:r.status,json:async()=>r.body};
    },
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../bookoff-client.js'),'utf8'),context);
  function client(){
    return context.BookOffSecurity.create({
      url:'https://relay.test',key:'LOCAL_SAMPLE_RELAY_KEY',
      storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
      fetch:context.fetch,verify:async get=>behaviour==='cancel'?null:get(),
      credentials:{get:async({publicKey})=>{
        if(behaviour==='failed')throw Object.assign(Error('Cancelled'),{name:'NotAllowedError'});
        const signed=d.sign({...publicKey,challenge:Buffer.from(publicKey.challenge).toString('base64url')});
        const decode=s=>Uint8Array.from(Buffer.from(s,'base64url'));
        return {id:signed.id,rawId:decode(signed.rawId),type:'public-key',
          response:Object.fromEntries(Object.entries(signed.response).map(([k,v])=>[k,decode(v)]))};
      }},
    });
  }
  const text=(day,label='Custom time off')=>label+'\n#BOOK '+JSON.stringify([{from:`2099-03-${day}T18:00`,to:`2099-03-${String(+day+1).padStart(2,'0')}T06:00`}]);
  const c=client();
  behaviour='cancel';assert.equal((await c.submit(text('02'))).state,'cancelled');
  behaviour='failed';assert.equal((await c.submit(text('03'))).state,'rejected');
  assert.equal(paths.filter(p=>p==='/req').length,0,'verification failures never POST to queue');
  behaviour='valid';const custom=await c.submit(text('04'));assert.equal(custom.ok,true);
  const contract=await c.submit(text('06','Book me off (8 week audit)'));assert.equal(contract.ok,true);
  lose=true;const lost=await c.submit(text('08'));assert.equal(lost.state,'uncertain');assert(lost.id);
  assert.equal((await h.call('/status?id='+lost.id)).body.status,'queued');
  const sends=paths.filter(p=>p==='/req').length;
  assert.equal((await client().submit(text('08'))).state,'uncertain');
  assert.equal(paths.filter(p=>p==='/req').length,sends,'lost response/reload never auto-retries');
  assert.match((await client().reconcile(text('08'))).message,/Relay has this request/,'known queued requests cannot be reset');
  lose=false;neverDelivered=true;
  assert.equal((await client().submit(text('12'))).state,'uncertain');
  assert.match((await client().reconcile(text('12'))).message,/three minutes/);
  fakeNow+=180001;
  assert.equal((await client().reconcile(text('12'))).state,'reconciled','missing POST can be manually reset by a fresh valid probe');
  neverDelivered=false;
  assert.equal((await client().submit(text('12'))).ok,true,'fresh reviewed retry needs new server approval');
  assert.equal(receipts.some(r=>r.id===lost.id),true);
  context.isSecureContext=false;
  assert.equal((await client().submit(text('10'))).state,'unsupported');
  const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(source,/if\(\/\^#BOOK.*sendApprovedBookOff/);
  assert.doesNotMatch(source,/await verifyBookOff\(\)/,'no local-only approval route remains');
});
test('new booking client is setup-only while Worker is in preparation mode',async t=>{
  const relay=process.env.RELAY_PROJECT_DIR||path.join(os.homedir(),'relay');
  const {harness}=await import(pathToFileURL(path.join(relay,'tests/harness.js')).href);
  const h=await harness('prepare');t.after(()=>h.mf.dispose());const paths=[];
  const context={isSecureContext:true,AbortSignal,fetch:async(url,options)=>{
    const p=new URL(url).pathname;paths.push(p);const r=await h.call(p,options.body?JSON.parse(options.body):undefined);
    return {ok:r.status<300,status:r.status,json:async()=>r.body};
  }};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../bookoff-client.js'),'utf8'),context);
  const client=context.BookOffSecurity.create({url:'https://relay.test',key:'LOCAL_SAMPLE_RELAY_KEY',storage:{},
    fetch:context.fetch,credentials:{get:()=>{throw Error('Preparation must not open approval prompt')}},verify:get=>get()});
  assert.equal((await client.submit('sample')).state,'preparation');
  assert.deepEqual(paths,['/auth/config']);
});
