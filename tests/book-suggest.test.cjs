const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function fn(name){const i=src.indexOf('function '+name+'(');assert(i>=0,name+' missing');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1)}throw new Error('unbalanced '+name)}
const ctx={};vm.createContext(ctx);vm.runInContext(fn('bookSuggest'),ctx);
const bs=(...a)=>JSON.parse(JSON.stringify(ctx.bookSuggest(...a)));
const base=29927520;                       // minutes, snapshot start
const NOW=base+30;                          // 00:30 into the snapshot
const mk=(per)=>{const H=48,rows=[['CT',4,5],['BA',2,2],['ERD',1,1],['OIC',1,1]].map(([name,min,plan])=>({name,min:String(min),plan:String(plan),n:Array.from({length:H},(_,h)=>String(per(h)[name]))}));return{v:2,base,rows}};
const std={CT:5,BA:3,ERD:1,OIC:1};
const me=(iv,bars=[])=>({name:'Paul Matthews',q:'BA, WAH1, WR',iv,bars});
const never=()=>false;
// 1) hours 2-5 are short a body (yellow, CT 4 / BA 2) and Paul is not on => book-on window, yellow->green
let sn=mk(h=>h>=2&&h<6?{CT:4,BA:2,ERD:1,OIC:1}:std);
let s=bs(sn,NOW,me([[12*60,24*60]]),never);
assert.strictEqual(s.on.length,1);assert.strictEqual(s.on[0].from,2);assert.strictEqual(s.on[0].to,6);assert.strictEqual(s.on[0].before,'min');assert.strictEqual(s.on[0].after,'full');assert.deepStrictEqual(s.on[0].ct,[4,5]);
// 2) red hours (CT 3) lifted to yellow by Paul are offered too, ranked after fixes that reach green
sn=mk(h=>h===7?{CT:3,BA:1,ERD:1,OIC:1}:(h>=2&&h<4?{CT:4,BA:2,ERD:1,OIC:1}:std));
s=bs(sn,NOW,me([]),never);
assert.deepStrictEqual(s.on.map(x=>[x.from,x.to,x.after]),[[2,4,'full'],[7,8,'min']]);
// 3) book off: Paul on, station keeps CT>=5 and BA>=2 without him => safe; CT 5 would drop to yellow (not offered); CT 4 would go red (danger)
sn=mk(h=>h<3?{CT:6,BA:3,ERD:1,OIC:1}:(h<5?{CT:5,BA:3,ERD:1,OIC:1}:(h<7?{CT:4,BA:2,ERD:1,OIC:1}:std)));
s=bs(sn,NOW,me([[0,24*60]]),never);
assert.deepStrictEqual(s.off.map(x=>[x.from,x.to]),[[0,3]]);
assert.deepStrictEqual(s.danger.map(x=>[x.from,x.to]),[[5,7]]);
// the first window never starts in the past
assert(s.off[0].fromAbs>=Math.ceil(NOW/15)*15);assert.strictEqual(s.off[0].toAbs,base+180);
// 4) away hours (sickness, leave, detached) are skipped both ways
sn=mk(h=>h>=2&&h<6?{CT:4,BA:2,ERD:1,OIC:1}:std);
s=bs(sn,NOW,me([],[[0,'x','ff',120,240]]),b=>true);
assert.deepStrictEqual(s.on.map(x=>[x.from,x.to]),[[4,6]]);
// 5) no Paul / no data => empty, never throws
assert.deepStrictEqual(bs(sn,NOW,null,never),{on:[],off:[],danger:[]});
assert.deepStrictEqual(bs(null,NOW,me([]),never),{on:[],off:[],danger:[]});
// 6) the Live tab carries the card, the quick toggle is a placeholder that sends nothing
assert(/id="lbook"/.test(src)&&/id="lqsw"/.test(src)&&/Placeholder only, nothing is sent yet/.test(src));
const rb=fn('renderBook');assert(!/relaySend|fetch\(/.test(rb),'quick toggle must not send anything yet');
console.log('book-suggest PASS');
