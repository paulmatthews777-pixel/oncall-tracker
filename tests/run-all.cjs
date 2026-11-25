// Runs the real-file week test in 3 time zones plus crew-flow. Exit 1 on any failure.
const {spawnSync}=require('node:child_process');
let bad=0;
for(const tz of ['Europe/London','America/Los_Angeles','Asia/Tokyo']){
  const r=spawnSync(process.execPath,['tests/real-files-week.cjs','index.html','planner-feed.user.js'],{env:{...process.env,TZ:tz},encoding:'utf8'});
  const last=(r.stdout||'').trim().split('\n').pop();console.log(tz,'->',last);if(r.status!==0){bad++;console.log(r.stdout,r.stderr)}}
const c=spawnSync(process.execPath,['tests/crew-flow.test.cjs'],{encoding:'utf8'});
console.log('crew-flow ->',c.status===0?'PASS':'FAIL');if(c.status!==0){bad++;console.log((c.stdout||'').slice(-1500),(c.stderr||'').slice(-1500))}
const rl=spawnSync(process.execPath,['tests/role-letters.test.cjs'],{encoding:'utf8'});
console.log('role-letters ->',rl.status===0?'PASS':'FAIL');if(rl.status!==0){bad++;console.log((rl.stdout||'').slice(-1500),(rl.stderr||'').slice(-1500))}
const pw=spawnSync(process.execPath,['tests/planner-week.test.cjs'],{encoding:'utf8'});
console.log('planner-week ->',pw.status===0?'PASS':'FAIL');if(pw.status!==0){bad++;console.log((pw.stdout||'').slice(-1500),(pw.stderr||'').slice(-1500))}
const ac=spawnSync(process.execPath,['tests/activity.test.cjs'],{encoding:'utf8'});
console.log('activity ->',ac.status===0?'PASS':'FAIL');if(ac.status!==0){bad++;console.log((ac.stdout||'').slice(-1500),(ac.stderr||'').slice(-1500))}
const rs=spawnSync(process.execPath,['tests/relay-send.test.cjs'],{encoding:'utf8'});
console.log('relay-send ->',rs.status===0?'PASS':'FAIL');if(rs.status!==0){bad++;console.log((rs.stdout||'').slice(-1500),(rs.stderr||'').slice(-1500))}
console.log(bad?'RESULT: FAIL':'RESULT: ALL PASS');process.exit(bad?1:0);
