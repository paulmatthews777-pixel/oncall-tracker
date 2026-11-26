const fs=require('fs'),assert=require('assert'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
function fn(name){const i=src.indexOf('function '+name+'(');assert(i>=0,name+' missing');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1)}throw new Error('unbalanced '+name)}
const ctx={};vm.createContext(ctx);vm.runInContext(fn('nowX'),ctx);
const dates=['2026-11-25','2026-11-26','2026-11-27'];
// day view (576px per day): 06:00 on day index 1 => 206 + 576 + 144
assert.strictEqual(ctx.nowX(dates,576,{date:'2026-11-26',min:360}),206+576+144);
assert.strictEqual(ctx.nowX(dates,576,{date:'2026-11-25',min:0}),206);
// custom view (46px per day)
assert.strictEqual(ctx.nowX(dates,46,{date:'2026-11-27',min:720}),206+92+23);
// today outside range => no line
assert.strictEqual(ctx.nowX(dates,576,{date:'2026-12-01',min:10}),null);
// grid markup carries the data the line needs, and the line is placed after every render
assert(/data-nd="'\+dsl\.join/.test(src)&&/data-nd="'\+dates\.join/.test(src),'grid data attrs');
assert(/multiHTML\(pv\.from,pv\.to\);\s*placeNow\(\)/.test(src),'placeNow after render');
assert(/body\.pland \.top,body\.pland nav\{display:none\}/.test(src),'landscape css');
// whole page script must still parse
const blocks=[...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert(blocks.length>0);blocks.forEach(b=>new vm.Script(b));
console.log('planner-now PASS');
