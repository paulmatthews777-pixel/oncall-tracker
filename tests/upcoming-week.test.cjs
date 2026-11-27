const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('index.html','utf8');
const start=src.indexOf('function selectUpcomingWeek('),end=src.indexOf('\n}',start);
assert(start>=0&&end>start,'coming-weeks selector function is present');
const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(start,end+2),ctx);
assert.equal(ctx.selectUpcomingWeek({7:'week one',14:'week two'},14),'week two');
assert.equal(ctx.selectUpcomingWeek({7:'week one',14:'week two'},21),'');
console.log('upcoming-week PASS');
