// Holiday page: taken/ahead split, entitlement, Payments cross-check, on the real index.html.
const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const block=[...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('Holiday page: left from FireWatch'));
assert(block,'holiday script missing');
const E=[['2026-07-07T10:00','2026-07-07T18:00',8],['2026-08-14T06:00','2026-08-15T19:00',37],['2026-08-17T06:00','2026-08-17T18:00',12],['2026-08-18T06:00','2026-08-18T23:00',17],['2026-08-19T06:00','2026-08-19T18:00',12],['2026-08-20T06:00','2026-08-20T18:00',12],['2026-08-21T06:00','2026-08-21T16:00',10],['2026-09-11T06:00','2026-09-12T18:00',36],['2026-10-10T07:00','2026-10-10T18:00',11],['2026-10-10T18:00','2026-10-10T19:00',1],['2026-10-23T06:00','2026-10-24T19:00',37]].map(([from,to,h])=>({from,to,h}));
const store={'oncall-holiday':JSON.stringify({at:new Date().toISOString(),data:{remaining:87,leaveYear:{from:'2026-01-01',to:'2027-01-01',confirmed:false},entries:E}}),
 'oncall-pay':JSON.stringify({data:{months:{'2026-08':{items:{'Holiday Hour(s)':[8,0]}},'2026-09':{items:{'Holiday Hour(s)':[100,0]}},'2026-10':{items:{'Holiday Hour(s)':[36,0]}},'2026-11':{items:{'Holiday Hour(s)':[49,0]}}}}})};
const els={};const el=id=>els[id]||(els[id]={id,innerHTML:'',textContent:''});
const ctx={RELAY_URL:'x',console,Math,JSON,Date,Number,String,Object,Intl,setInterval:()=>0,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},document:{getElementById:el,addEventListener:()=>{},hidden:false},fetch:async()=>({ok:false})};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(block,ctx);
const H=ctx.holidayPage;
const sp=H.split(E,'2026-11-27T07:30');assert.strictEqual(sp.taken,193);assert.strictEqual(sp.ahead,0);
const mid=H.split([{from:'2026-12-01T06:00',to:'2026-12-01T18:00',h:12}],'2026-12-01T12:00');assert.strictEqual(mid.taken,6);assert.strictEqual(mid.ahead,6);
assert.deepStrictEqual({...H.byMonth(E)},{'2026-07':8,'2026-08':100,'2026-09':36,'2026-10':49});
assert.deepStrictEqual({...H.payHol()},{'2026-07':8,'2026-08':100,'2026-09':36,'2026-10':49});
H.render();
assert.strictEqual(els['holtile-v'].textContent,'87 h');assert(/280 h/.test(els['holtile-s'].textContent),els['holtile-s'].textContent);
assert(/Entitlement<\/span><b>280 h/.test(els.holbody.innerHTML));assert(!/does not match Payments/.test(els.holbody.innerHTML));
console.log('holiday-page PASS');
