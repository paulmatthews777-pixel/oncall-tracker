const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),lines=src.split('\n');
const cs=lines.find(l=>l.startsWith('const RELAY_URL')),kf=lines.find(l=>l.startsWith('function relayKey')),fn=lines.find(l=>l.startsWith('async function relaySend'));
function run(fetchImpl,store,promptImpl){const ls={getItem:k=>store[k]===undefined?null:store[k],setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}};const ctx={fetch:fetchImpl,AbortController,setTimeout,clearTimeout,JSON,localStorage:ls,prompt:promptImpl,out:null};vm.createContext(ctx);vm.runInContext(cs+'\n'+kf+'\n'+fn+'\nout=relaySend("hi")',ctx);return ctx.out}
const resp=(ok,body,status)=>({ok,status:status||(ok?200:502),json:async()=>body});
const K='k'.repeat(32),have=()=>({'oncall-relay-key':K});
test('no secret is hardcoded in index.html',()=>{assert.ok(cs&&kf&&fn);assert.ok(!/RELAY_KEY\s*=/.test(src));assert.ok(!/[a-z0-9]{32}/.test(cs+kf+fn));assert.match(cs,/workers\.dev/)});
test('ok response gives true and sends the stored key',async()=>{let seen;const r=await run(async(u,o)=>{seen={u,o};return resp(true,{ok:true})},have());assert.equal(r,true);assert.match(seen.u,/live-crewing-relay/);assert.equal(seen.o.method,'POST');assert.equal(seen.o.headers['X-Relay-Key'],K);assert.equal(JSON.parse(seen.o.body).text,'hi')});
test('no stored key asks once, stores it, then sends',async()=>{const st={};let asked=0,seen;const r=await run(async(u,o)=>{seen=o;return resp(true,{ok:true})},st,()=>{asked++;return '  '+K+' '});assert.equal(r,true);assert.equal(asked,1);assert.equal(st['oncall-relay-key'],K);assert.equal(seen.headers['X-Relay-Key'],K)});
test('no key and prompt cancelled gives false without calling fetch',async()=>{let called=0;const r=await run(async()=>{called++;return resp(true,{ok:true})},{},()=>null);assert.equal(r,false);assert.equal(called,0)});
test('403 clears the stored key so it asks again next time',async()=>{const st=have();const r=await run(async()=>resp(false,{},403),st);assert.equal(r,false);assert.equal(st['oncall-relay-key'],undefined)});
test('not ok gives false',async()=>{assert.equal(await run(async()=>resp(false,{ok:false}),have()),false)});
test('http ok but body without ok true gives false',async()=>{assert.equal(await run(async()=>resp(true,{}),have()),false);assert.equal(await run(async()=>resp(true,{ok:false}),have()),false)});
test('rejected fetch gives false and never throws',async()=>{assert.equal(await run(async()=>{throw new Error('net')},have()),false)});
test('bad json gives false',async()=>{assert.equal(await run(async()=>({ok:true,status:200,json:async()=>{throw new Error('x')}}),have()),false)});