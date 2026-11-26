const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function fn(name){const i=src.indexOf('function '+name+'(');assert(i>=0,name+' missing');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1)}throw new Error('unbalanced '+name)}
const ctx={};vm.createContext(ctx);
vm.runInContext('const pad=n=>String(n).padStart(2,"0");const iso=dn=>{const d=new Date(dn*86400000);return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)+"-"+pad(d.getUTCDate())};',ctx);
vm.runInContext(fn('dayNum')+fn('bookRanges'),ctx);
const T=vm.runInContext('dayNum("2026-11-26")',ctx);ctx.T=T;
const run=(rs)=>JSON.parse(JSON.stringify(vm.runInContext('bookRanges('+JSON.stringify(rs)+',T)',ctx)));
// day shift 07:00-19:00
assert.deepStrictEqual(run([{s:420,e:1140}]),[{from:'2026-11-26T07:00',to:'2026-11-26T19:00'}]);
// night shift crossing midnight 19:00-07:00 ends next day
assert.deepStrictEqual(run([{s:1140,e:1860}]),[{from:'2026-11-26T19:00',to:'2026-11-27T07:00'}]);
// ends exactly at midnight => next day 00:00
assert.deepStrictEqual(run([{s:720,e:1440}]),[{from:'2026-11-26T12:00',to:'2026-11-27T00:00'}]);
// today block from 00:45 to 07:00
assert.deepStrictEqual(run([{s:45,e:420}]),[{from:'2026-11-26T00:45',to:'2026-11-26T07:00'}]);
// the PC auto-booker accepts exactly what the app sends
const {parseBook}=require(path.join(__dirname,'..','autobook','parse.cjs'));
const txt='Book me off (this week) – please book these in FireWatch now:\nThu 26 Nov 07:00-19:00 (12.0 h)\n#BOOK '+JSON.stringify(run([{s:420,e:1140},{s:1140,e:1860}]));
const p=parseBook(txt);assert(!p.error,JSON.stringify(p));assert.strictEqual(p.ranges.length,2);
// and the saver actually adds the line to what it sends
assert(/'\\n#BOOK '\+JSON\.stringify\(book\)/.test(src),'saver must append #BOOK');
assert(/bookRanges\(ranges\(bs\),dn\)/.test(src));
console.log('book-line PASS');
