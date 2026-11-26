const fs=require('fs'),assert=require('assert'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
function fn(name){const i=src.indexOf('function '+name+'(');assert(i>=0,name+' missing');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1)}throw new Error('unbalanced '+name)}
const ctx={COUNTS:['avail','turnout','drill','rota','leave'],entries:[]};vm.createContext(ctx);
vm.runInContext('const pad=n=>String(n).padStart(2,"0");const iso=dn=>{const d=new Date(dn*86400000);return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)+"-"+pad(d.getUTCDate())};',ctx);
['toMin','entryHours','dayNum','saverBlocks'].forEach(n=>vm.runInContext(fn(n),ctx));
const dn=s=>ctx.dayNum(s),T=dn('2026-11-26');
const E=(date,start,end,band)=>({date,start,end,type:'avail',band});
const run=(ents,now,from)=>{ctx.entries=ents;ctx.__n=now;return vm.runInContext('saverBlocks('+(from===undefined?T:from)+','+(T+7)+',__n)',ctx)};
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,a+' != '+b);
// day shift, now 10:07 => starts 10:15, hours scaled
let b=run([E('2026-11-26','07:00','19:00','P1')],{date:'2026-11-26',min:607});
assert.strictEqual(b.length,1);assert.strictEqual(b[0].s,'10:15');assert.strictEqual(b[0].e,'19:00');near(b[0].h,12*525/720);assert.strictEqual(b[0].id,T+'|10:15|19:00');
// day shift already over => nothing
assert.strictEqual(run([E('2026-11-26','07:00','19:00','P1')],{date:'2026-11-26',min:1200}).length,0);
// night shift that started yesterday and is still running at 00:35 => today block 00:45-07:00, dated today
b=run([E('2026-11-25','19:00','07:00','P3')],{date:'2026-11-26',min:35});
assert.strictEqual(b.length,1);assert.strictEqual(b[0].dn,T);assert.strictEqual(b[0].s,'00:45');assert.strictEqual(b[0].e,'07:00');near(b[0].h,12*375/720);
// yesterday's night shift finished by now => nothing
assert.strictEqual(run([E('2026-11-25','19:00','07:00','P3')],{date:'2026-11-26',min:480}).length,0);
// tonight's night shift is untouched at 10:00
b=run([E('2026-11-26','19:00','07:00','P3')],{date:'2026-11-26',min:600});
assert.strictEqual(b[0].s,'19:00');near(b[0].h,12);
// after 23:45 nothing starts today (would be dated wrong)
assert.strictEqual(run([E('2026-11-26','19:00','07:00','P3')],{date:'2026-11-26',min:1435}).length,0);
// other days unaffected, past days not offered
b=run([E('2026-11-27','07:00','19:00','P1'),E('2026-11-24','07:00','19:00','P1')],{date:'2026-11-26',min:600});
assert.strictEqual(b.length,1);assert.strictEqual(b[0].dn,T+1);near(b[0].h,12);
// without "today" the behaviour is exactly as before (tomorrow onwards)
b=run([E('2026-11-26','07:00','19:00','P1'),E('2026-11-27','07:00','19:00','P1')],null,T+1);
assert.strictEqual(b.length,1);assert.strictEqual(b[0].dn,T+1);
// the Week tab opts in and the today chips exist
assert(/saver\('wsv','savewk','Book me off \(this week\)',curW\.wsp,curW\.from-1,curW\.to,true\)/.test(src));
assert(/chip\('h1','Next 1 hour'\)/.test(src)&&/chip\('h4','Next 4 hours'\)/.test(src)&&/Rest of today/.test(src));
// this-week hero counts rest-of-today blocks that still fit the targets
vm.runInContext(fn('todayFree'),ctx);
const tf=(sp,bl)=>{ctx.__sp=sp;ctx.__bl=bl;return vm.runInContext('todayFree(__sp,__bl)',ctx)};
let sp={P1:5,P3:0,P4:0,S:5,T:5};near(tf(sp,[{b:'P1',h:4},{b:'P1',h:3}]),4);near(sp.P1,1);near(sp.T,1);
sp={P1:0,P3:0,P4:0,S:0,T:3};near(tf(sp,[{b:'P1',h:2},{b:'U',h:2}]),2);near(sp.T,1);
assert(/h\+=todayFree\(wsp,saverBlocks\(td,td\+1,NL\)\)/.test(src),'hero adds today');
console.log('week-today PASS');
