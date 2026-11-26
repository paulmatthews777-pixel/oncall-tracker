const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function fn(name){const i=src.indexOf('function '+name+'(');assert(i>=0,name+' missing');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1)}throw new Error('unbalanced '+name)}
const store={};const ctx={localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},JSON,Date};vm.createContext(ctx);
vm.runInContext(fn('actDraftValid')+fn('actDraftSave'),ctx);
const ok={type:'Drill',sd:'2026-11-26',st:'19:00',ed:'2026-11-26',et:'21:00'};
assert.strictEqual(ctx.actDraftValid(ok),true);
assert.strictEqual(ctx.actDraftValid({...ok,type:''}),false,'type required');
assert.strictEqual(ctx.actDraftValid({...ok,et:'19:00'}),false,'end must be after start');
assert.strictEqual(ctx.actDraftValid({...ok,ed:'2026-11-25'}),false,'end date before start');
assert.strictEqual(ctx.actDraftValid({...ok,ed:'2026-11-27',et:'01:00'}),true,'overnight is fine');
assert.strictEqual(ctx.actDraftValid(null),false);
assert.strictEqual(ctx.actDraftSave(ok),1);assert.strictEqual(ctx.actDraftSave(ok),2);
const saved=JSON.parse(store['oncall-act-drafts']);assert.strictEqual(saved.length,2);assert.strictEqual(saved[0].type,'Drill');assert(saved[0].savedAt>0);
// form fields appear in the same order as the FireWatch screenshot
const form=fn('openActForm');
const order=['Activity Type','Station','Contract Type','Role','Team','Start Date','Start Time','End Date','End Time','Comment'];
let last=-1;order.forEach(l=>{const i=form.indexOf('<small>'+l+'</small>');assert(i>last,'field order: '+l);last=i});
assert(/Winterton/.test(form)&&/Retained/.test(form)&&/Firefighter/.test(form));
// drafts only: the form code never sends anything
assert(!/relaySend|fetch\(/.test(form+fn('actDraftSave')),'form must not send yet');
assert(/id="aplus"/.test(src));
console.log('add-activity PASS');
