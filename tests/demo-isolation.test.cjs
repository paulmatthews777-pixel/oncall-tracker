'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('demo-bootstrap.js','utf8');
function setup({isolated=true}={}){
 const handlers={},elements=[];
 const document={documentElement:{textContent:''},head:{appendChild(x){elements.push(x)}},
  createElement(){return {}},addEventListener(name,fn){handlers[name]=fn}};
 const window={origin:isolated?'null':'https://example.test'};window.top={};
 let alerts=0;
 const context={window,document,location:{search:'?demo=1'},URLSearchParams,Map,Date,Array,JSON,TypeError,Error,navigator:{},alert(){alerts++}};
 vm.createContext(context);
 return {context,handlers,elements,get alerts(){return alerts}};
}
(async()=>{
 const x=setup();vm.runInContext(code,x.context);
 assert.equal(x.context.window.__demoMode,true);
 assert.equal(x.context.window.localStorage.getItem('oncall-relay-key'),null);
 assert.match(x.context.window.localStorage.getItem('oncall-tracker-v2'),/example/);
 await assert.rejects(x.context.window.fetch('https://example.invalid/'),/disabled/);
 for(const name of ['XMLHttpRequest','WebSocket','EventSource'])assert.throws(()=>new x.context.window[name](),/disabled/);
 let prevented=false,stopped=false;
 x.handlers.click({target:{closest(){return {id:'savewk'}}},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
 assert(!prevented&&!stopped,'Demo should allow the booking review screen');
 const confirm={id:'cfmYes',textContent:'Confirm and send',disabled:false};
 x.handlers.click({target:{closest(){return confirm}},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
 assert(prevented&&stopped&&confirm.disabled,'Demo final confirmation must never submit');
 assert.match(confirm.textContent,/no booking sent/i);
 assert(x.elements.some(x=>x.httpEquiv==='Content-Security-Policy'&&x.content.includes("connect-src 'none'")));
 const unsafe=setup({isolated:false});assert.throws(()=>vm.runInContext(code,unsafe.context),/isolated/);
 console.log('Demo isolation PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
