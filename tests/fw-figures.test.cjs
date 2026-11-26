// Holiday, Working time and Pay cards: real index.html code, no built-in figures, stale readings flagged.
const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function fn(name){const i=src.indexOf('function '+name+'(');assert(i>=0,name+' missing');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1)}throw new Error('unbalanced '+name)}
const line=s=>{const i=src.indexOf(s);assert(i>=0,s+' missing');return src.slice(i,src.indexOf('\n',i))};
const store={};
const ctx={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}};vm.createContext(ctx);
vm.runInContext([line('const f1='),line('const STALE_DAYS='),line('const r2='),line('const PAY='),'function entryHours(e){return e.h}',...['toMin','dayNum','numIn','daysOld','stored','holData','fwPayData','wtdData','wtdState','wtdMsg','payCalc'].map(fn),
  'this.f={dayNum,numIn,daysOld,holData,fwPayData,wtdData,wtdState,wtdMsg,payCalc}'].join('\n'),ctx);
const F=ctx.f;
// nothing stored => no made-up numbers
assert.strictEqual(F.holData(),null);assert.strictEqual(F.wtdData(),null);assert.strictEqual(F.fwPayData(),null);
assert(/Not set yet/.test(F.wtdMsg(null,'2026-11-26').text));
assert(!/left:87|v:22\.2|514\.62/.test(src),'no hard-coded FireWatch readings');
// stored values are read back and validated
store['oncall-holiday']=JSON.stringify({total:280,left:87,asOf:'2026-11-26',year:2026});assert.strictEqual(F.holData().left,87);
store['oncall-holiday']=JSON.stringify({total:280,left:300,asOf:'2026-11-26',year:2026});assert.strictEqual(F.holData(),null,'left above total rejected');
// working time thresholds and staleness
assert.strictEqual(F.wtdState(22.2,48),'ok');assert.strictEqual(F.wtdState(43.2,48),'warn');assert.strictEqual(F.wtdState(48,48),'bad');
const w={v:22.2,limit:48,asOf:'2026-11-20'};
assert(/Well inside/.test(F.wtdMsg(w,'2026-11-26').text),'6 days old is still trusted');
assert(/out of date/.test(F.wtdMsg(w,'2026-11-30').text),'10 days old is not called safe');
assert(/Do not book/.test(F.wtdMsg({v:50,limit:48,asOf:'2026-10-01'},'2026-11-30').text),'over the limit always warns');
// numbers typed with a comma, cancelled prompts
assert.strictEqual(F.numIn('87,5'),87.5);assert(isNaN(F.numIn(null)));assert(isNaN(F.numIn('abc')));
// pay: payslip rate vs FireWatch rounded rate, month filter, lines add up to the total
const r=F.payCalc([{type:'drill',date:'2026-11-03',h:8.5},{type:'avail',date:'2026-11-03',h:8.5},{type:'drill',date:'2026-10-30',h:8.5},{type:'turnout',date:'2026-11-04',h:1.25}],'2026-11');
assert.strictEqual(r.lines[1].h,8.5);assert.strictEqual(r.lines[1].pay,122.35);assert.strictEqual(r.lines[0].h,1.25);
assert.strictEqual(r.pay,Math.round(r.lines.reduce((q,l)=>q+l.pay,0)*100)/100,'total equals the sum of the lines');
assert.strictEqual(r.fw,Math.round((8.5*14.40+1.25*14.40)*100)/100);
// the cards are on the Week tab and drawn on start-up
assert(/id="hcard"/.test(src)&&/id="wtdcard"/.test(src)&&/id="paycard"/.test(src));
assert(/renderHoliday\(\);renderWtd\(\);renderPay\(\)/.test(src));
console.log('fw-figures PASS');
