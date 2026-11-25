// Usage: node real-files-week.cjs <index.html> <planner-feed.user.js>
// Extracts code from the REAL files by pattern (no line numbers). Fails if anything is missing.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const [,, appPath, feedPath]=process.argv;
const app=fs.readFileSync(appPath,'utf8'), feed=fs.readFileSync(feedPath,'utf8');
const line=(src,re,label)=>{const m=src.split(/\r?\n/).find(l=>re.test(l));assert(m,'MISSING in file: '+label);return m.trim()};
const addD=line(app,/^\s*const addD=/,'addD');
const hasStart=/function plannerWeekStart\(/.test(app);
const startFn=hasStart?line(app,/^\s*function plannerWeekStart\(/,'plannerWeekStart'):'';
const cs=app.indexOf("document.addEventListener('click',e=>{const t=e.target.closest('#t-planner");
const ch=app.indexOf("document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#pctl')");
assert(cs>=0&&ch>cs,'MISSING in file: planner click/change handlers');
const chEnd=app.indexOf('\n',ch);
const handlers=app.slice(cs,chEnd);
const feedLines=['const CF=','const cMid=','const cAdd=','const cMon=','const cIso='].map(p=>line(feed,new RegExp('^\\s*'+p.replace(/[=]/g,'\\=')),p)).join('\n');
const pv={mode:'week',from:'2026-12-28',date:'2026-12-31'},L={};let renders=0;
const ctx={pv,document:{addEventListener:(t,f)=>L[t]=f},renderPlanner:()=>renders++,londonNow:()=>({date:'2027-01-01'})};
vm.runInNewContext(addD+'\n'+startFn+'\n'+handlers,ctx);
let fails=0;const t=(name,fn)=>{try{fn();console.log('PASS',name)}catch(e){fails++;console.log('FAIL',name,'-',e.message.split('\n')[0])}};
const nav=n=>L.click({target:{closest:()=>({dataset:{nav:String(n)}})}});
t('app has plannerWeekStart',()=>assert(hasStart,'no plannerWeekStart in this index.html'));
pv.mode='week';pv.from='2026-12-28';
t('week next -> Mon 2027-01-04',()=>{nav(7);assert.equal(pv.from,'2027-01-04')});
t('week prev x2 -> Mon 2026-12-21',()=>{nav(-7);nav(-7);assert.equal(pv.from,'2026-12-21')});
t('week Today (Fri 2027-01-01) -> Mon 2026-12-28',()=>{nav(0);assert.equal(pv.from,'2026-12-28')});
t('week date picker 2026-11-01 (Sun) -> Mon 2026-10-26',()=>{L.change({target:{closest:()=>true,id:'pfrom',value:'2026-11-01'}});assert.equal(pv.from,'2026-10-26')});
pv.mode='day';pv.date='2026-12-31';
t('day next/prev',()=>{nav(1);assert.equal(pv.date,'2027-01-01');nav(-1);assert.equal(pv.date,'2026-12-31')});
if(hasStart){const f=vm.runInNewContext(startFn+'\n'+addD+'\n'+feedLines+'\n(iso)=>[plannerWeekStart(iso),cIso(cMon(new Date(iso+"T12:00:00")))]',{});
 for(const [i,e] of [['2027-01-01','2026-12-28'],['2026-11-01','2026-10-26'],['2026-03-29','2026-03-23'],['2026-10-25','2026-10-19'],['2026-03-30','2026-03-30']])t('app vs feed Monday '+i,()=>assert.equal(JSON.stringify(f(i)),JSON.stringify([e,e])))}
console.log(fails?`RESULT: ${fails} FAIL`:'RESULT: ALL PASS');process.exit(fails?1:0);
