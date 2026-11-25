const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
function fn(name){const a=src.indexOf('function '+name+'(');assert.notEqual(a,-1,name);const o=src.indexOf('{',a);let d=0;for(let i=o;i<src.length;i++){if(src[i]==='{')d++;if(src[i]==='}'){d--;if(d===0)return src.slice(a,i+1)}}}
const people=[...Array(8)].map((_,k)=>({name:'P'+k,role:'FF',q:k<3?'BA':'',iv:[[1440+8*60,1440+20*60]],bars:[]}));
const rng={dates:['2026-11-24','2026-11-25','2026-11-26'],people,rows:[{name:'CT',g:'Crewing',min:'4',plan:'5',n:[0,1,2].map(()=>Array(24).fill('5'))},{name:'BA',g:'Crewing',min:'2',plan:'2',n:[0,1,2].map(()=>Array(24).fill('2'))}]};
const code=['fwCrewNumbers','dayHTML','planHour','planDay'].map(fn).join('\n')+"\nconst PKEY=['CT','BA','ERD','OIC'];this.out=dayHTML;this.ph=planHour;";
const ctx=vm.createContext({rng,PKEY:['CT','BA','ERD','OIC'],pn:x=>+x||0,pcol:()=>'#0f0',pesc:s=>String(s),dName:d=>d,popFor:()=>0,barLabel:()=>'x',txtOn:()=>'#111',onNow:()=>false,sortedPeople:()=>rng.people,londonNow:()=>({date:'2026-11-25'})});
new vm.Script(code).runInContext(ctx);
test('planner hourly count is real, not capped at plan',()=>{assert.equal(ctx.ph(1,10,'CT'),8);assert.equal(ctx.ph(1,10,'BA'),3);assert.equal(ctx.ph(1,3,'CT'),0)});
test('week strip: 3 day blocks, width, real counts',()=>{const h=ctx.out('2026-11-24',3);assert.equal((h.match(/class="pd"/g)||[]).length,3);assert.ok(h.includes('width:1728px'));assert.ok(/>8<\/div>/.test(h))});
test('single day has no day header and stays 576px',()=>{const h=ctx.out('2026-11-25');assert.equal((h.match(/class="pd"/g)||[]).length,0);assert.ok(h.includes('width:576px'))});

test('feed below plan is trusted, at plan uses real count',()=>{const h=ctx.out('2026-11-25');assert.ok(h.includes('>8<'))});
