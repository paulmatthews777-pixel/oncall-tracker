// Pay page: payslip-rate maths, cross-check flags and render, on the real index.html.
const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const block=[...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('Pay page: FireWatch Payments'));
assert(block,'pay script missing');
const els={};const el=id=>els[id]||(els[id]={id,innerHTML:'',textContent:''});
const store={'oncall-pay':JSON.stringify({at:new Date().toISOString(),data:{months:{
 '2026-09':{status:{Checked:true,Authorised:true},items:{'Turn Outs':[8,115.2],'Disturbances':[8,42.48],'Extra Hour(s)':[8.5,151.2]},totalHours:128.5,total:481.68},
 '2026-11':{status:{Checked:true,Authorised:true},items:{'Turn Outs':[2,28.8],'Disturbances':[2,10.62],'Drill Hour(s)':[8.5,122.4],'Extra Hour(s)':[24.5,352.8],'Holiday Hour(s)':[49,0]},totalHours:151,total:514.62}}}})};
const ctx={RELAY_URL:'x',console,Math,JSON,Date,Number,String,Object,Intl,setInterval:()=>0,
 localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},
 document:{getElementById:el,addEventListener:()=>{},hidden:false},fetch:async()=>({ok:false})};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(block,ctx);
const P=ctx.payPage;
assert.strictEqual(P.slipLine('Drill Hour(s)',8.5,122.4),122.35);
assert.strictEqual(P.slipLine('Extra Hour(s)',24.5,352.8),352.67);
assert.strictEqual(P.slipLine('Disturbances',2,10.62),10.62);
assert.strictEqual(P.slipLine('Holiday Hour(s)',49,0),null);
const f=P.flags(JSON.parse(store['oncall-pay']).data.months);
assert.strictEqual(f.length,1,'one flag expected: '+f);assert(/Sept? 2026: Extra Hours shows 8.5 but £151.20, which is 10.50 h at £14.40/.test(f[0]),f[0]);
P.render();
assert(/£514\.62/.test(els.paybody.innerHTML)&&/£514\.43/.test(els.paybody.innerHTML)&&/−19p/.test(els.paybody.innerHTML),'Nov totals');
assert.strictEqual(els['paytile-v'].textContent,'£514.62');assert(/Authorised/.test(els['paytile-s'].textContent));
assert(!/net pay is|Net:/i.test(els.paybody.innerHTML));
console.log('pay-page PASS');
