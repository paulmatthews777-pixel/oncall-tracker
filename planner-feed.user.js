// ==UserScript==
// @name         Winterton planner feed for tracker app
// @namespace    paulmatthews777-pixel
// @version      1.13
// @description  Pushes the Winterton planner (Live tab) and your contract hours (Week/Audit tabs) to the tracker app
// @match        https://humberside.firewatch.cloud/FireWatchWebClient*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/paulmatthews777-pixel/oncall-tracker/main/planner-feed.user.js
// @downloadURL  https://raw.githubusercontent.com/paulmatthews777-pixel/oncall-tracker/main/planner-feed.user.js
// ==/UserScript==
(function(){
'use strict';
const STATION_ID=28, REPO='paulmatthews777-pixel/oncall-tracker', BRANCH='live', FILE='planner.json';
const APP='https://paulmatthews777-pixel.github.io/oncall-tracker/';
/* Winterton planner snapshot. Shared by the userscript; runs on humberside.firewatch.cloud.
   Returns a compact object the tracker app's Live tab understands. */
async function fwDay(stationId,off,tok){
  const pad=n=>String(n).padStart(2,'0'), d=new Date();d.setDate(d.getDate()+off);
  const day=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T00:00:00.000Z';
  const body={SelectedDisplayType:'Day',SelectedDate:day,SelectedEndDate:day,StationIDs:[stationId],StationID:null,StationDesc:null,Bookings:true,Events:true,Defects:false,Services:false,Works:false,Exceptions:true,Detachments:true,Absences:true,Training:true,Temporary:true,Sickness:true,Qualifications:true,Fleet:true,Crewing:true,Resource:true,MaxLevels:false,Holidays:true,HolidayRequests:true,QualExclusions:true,Activities:true,Drills:true,ResourceRequests:false,RoleReassignment:true,ContractTypeID:null,ContractTypeIDs:[],WatchIDs:[],WatchDesc:'',ViewID:null,TeamID:null};
  const r=await fetch('/FireWatchWebClient/Planner/GetPlannerRows',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json; charset=utf-8','Accept':'application/json','__RequestVerificationToken':tok,'X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('planner '+r.status);
  const j=(await r.json()).ResourceContainer[0],A=j.Appliances[0];A.__root=j;return A;
}
const tipName=t=>String(t||'').split(/[\r\n]+|<br\s*\/?>/i).map(x=>x.replace(/<[^>]*>/g,'').trim()).filter(x=>x&&!/^\w{3} \d+ \w+ \d\d:\d\d - /.test(x)).join(' / ').slice(0,70);
function fwForEachResourceRow(rows,visit){for(const r of rows||[])if(r&&r.RowData&&r.RowData.Name)visit(r)}
function fwPlannerItems(cellData){let payload;try{payload=typeof cellData==='string'?JSON.parse(cellData):cellData}catch(e){return[]}const parents=payload&&Array.isArray(payload.plannerItem)?payload.plannerItem:[],out=[];for(const p of parents){if(!p)continue;out.push(p);if(Array.isArray(p.appointments))for(const child of p.appointments)if(child)out.push(child)}return out}
function fwIsOnCallItem(it){const tip=String(it&&it.tooltip||'');return Boolean(it&&(it.type==='RotaAssignment'||(it.type==='Activity'&&/On-Call\s*(?:[-:\u2010-\u2015]\s*)?(?:Available|Turn Out)\b/i.test(tip))))}
function fwBarMeta(b){
  const t=String(b&&b[0]||''),tip=String(b&&b[1]||'');
  if(t==='Sickness')return{label:'Sickness',away:true};
  if(t==='Holiday')return{label:'Annual leave',away:true};
  if(t==='OtherAbsence')return{label:'Leave',away:true};
  if(/Detached To/i.test(tip)){const l=/Location:\s*([^/]+)/i.exec(tip);return{label:'Detached'+(l?' to '+l[1].trim():''),away:true}}
  if(/Detach/i.test(t+' '+tip))return{label:'Detached',away:true};
  if(/Unavailable/i.test(tip))return{label:'Unavailable',away:true};
  if(/Course/i.test(t+' '+tip))return{label:'Course',away:true};
  if(/Turn Out/i.test(tip))return{label:'Turn out',away:false};
  if(/Attendance/i.test(tip))return{label:'Attended',away:false};
  if(/Drill/i.test(t+' '+tip))return{label:'Drill',away:false};
  if(/EFR Car/i.test(tip))return{label:'EFR Car',away:false};
  const m=/(?:Activity:\s*)?On-Call(?:\s*-\s*|:\s*)([^/]+)/i.exec(tip);
  if(m&&m[1].trim())return{label:m[1].trim(),away:false};
  return{label:t.replace(/([a-z])([A-Z])/g,'$1 $2')||'Activity',away:t!=='Activity'&&t!=='DrillEmployeeActivity'};
}
function fwPersonState(p,rel){
  const cur=(p.iv||[]).some(v=>v[0]<=rel&&rel<v[1]);
  const activeBars=(p.bars||[]).filter(b=>b[3]<=rel&&rel<b[4]);
  const away=activeBars.find(b=>fwBarMeta(b).away);
  const act=activeBars[0];
  const onNow=cur&&!away;
  const status=away?fwBarMeta(away).label:(onNow?'On now':(act?fwBarMeta(act).label:'Off'));
  return{onNow,status};
}
function fwAllPeople(snapOverride){
  const s=snapOverride||window.__plannerSnap;
  if(!s||!Array.isArray(s.people))return[];
  const rel=Math.floor(Date.now()/60000)-s.base;
  return s.people.map(p=>Object.assign({},p,fwPersonState(p,rel)));
}
window.__fwAllPeople=()=>fwAllPeople();
let scanDone=false,scanTypes={};
async function fwScan(stationId,tok){
  const light=c=>String(c||'').replace(/light-dark\(/,'').split(',')[0].replace('#','').trim();
  for(const off of [-1,-2,-3,-4,-5,-6,-7,-14,-21,-28,-35,-42,-49,-56,4,5,6,7,8,9,10,14,21,28]){
    try{const A=await fwDay(stationId,off,tok);
    const rr0=((A.__root&&A.__root.RowChildren)||[]).find(c=>c.RowData&&c.RowData.Description==='Resource');const g=((A.RowChildren.find(c=>c.RowData.Description==='Resource')||{RowChildren:[]}).RowChildren).concat(rr0?rr0.RowChildren:[]);
    for(const r of g)for(const h in r.RowData){let c;try{c=JSON.parse(r.RowData[h]).plannerItem[0]}catch(e){continue}
      for(const it of [c].concat(c.appointments||[])){if(!it.type)continue;
        const k=String(it.type)+'|'+tipName(it.tooltip)+'|'+light(it.colour);scanTypes[k]=(scanTypes[k]||0)+1}}}catch(e){}
  }
  scanDone=true;
}
async function fwPlannerSnapshot(stationId){
  const pad=n=>String(n).padStart(2,'0');
  const tok=(document.querySelector('input[name=__RequestVerificationToken]')||{}).value;
  if(!tok)throw new Error('no token');
  const H=[...Array(24).keys()].map(i=>pad(i));
  const light=c=>String(c||'').replace(/light-dark\(/,'').split(',')[0].replace('#','').trim();
  const cls=hex=>{const n=parseInt(hex,16);if(isNaN(n))return 'x';const R=n>>16&255,G=n>>8&255,B=n&255;if(R>200&&G<100)return 'r';if(R>200&&G>=100&&B<100)return 'a';if(G>R&&G>B)return 'g';return 'x'};
  const E=s=>Math.round(new Date(s).getTime()/60000);
  const t0=new Date();const base=Math.round(new Date(t0.getFullYear(),t0.getMonth(),t0.getDate()).getTime()/60000);
  const days=[];for(let i=0;i<4;i++)days.push(await fwDay(stationId,i,tok));
  const grp=(A,n)=>(A.RowChildren.find(c=>c.RowData.Description===n)||{RowChildren:[]}).RowChildren;
  const rows=[];
  for(const g of ['Crewing','Qualifications'])for(const r of grp(days[0],g)){
    const name=r.RowData.Name;let c='',n=[];
    for(let di=0;di<2;di++){const rr=grp(days[di],g).find(x=>x.RowData.Name===name);for(const h of H){let cell={c:'x',n:''};try{const p=JSON.parse(rr.RowData[h]).needSlot[0];cell={c:cls(light(p.colour)),n:p.cellText||''}}catch(e){}c+=cell.c;n.push(cell.n)}}
    rows.push({name,min:r.RowData.Min,plan:r.RowData.Plan,c,n});
  }
  const byName={},types={},seenB=new Set();
  days.forEach(A=>{const rootRes=((A.__root&&A.__root.RowChildren)||[]).find(c=>c.RowData&&c.RowData.Description==='Resource');fwForEachResourceRow(grp(A,'Resource').concat(rootRes?rootRes.RowChildren:[]),r=>{const d=r.RowData,o=byName[d.Name]=byName[d.Name]||{name:d.Name,role:d.Role||'',q:'',iv:[],bars:[]};
    for(const h of H){const list=fwPlannerItems(d[h]);
      for(const it of list){if(!it.itemDateTimeStart||!it.itemDateTimeEnd)continue;
        const tip=String(it.tooltip||''),isOn=fwIsOnCallItem(it);
        if(it.type==='RotaAssignment'&&it.cellText&&!o.q)o.q=it.cellText;
        const s=E(it.itemDateTimeStart),e=E(it.itemDateTimeEnd);if(isNaN(s)||isNaN(e)||e<=s)continue;
        if(it.type!=='RotaAssignment'){const tk=String(it.type)+'|'+tipName(tip)+'|'+light(it.colour);types[tk]=(types[tk]||0)+1}
        if(!isOn){const key=o.name+'|'+it.type+'|'+s+'|'+e;if(!seenB.has(key)){seenB.add(key);o.bars.push([String(it.type),tipName(tip),light(it.colour),s-base,e-base])}continue}
        o.iv.push([s-base,e-base]);}}});});
  const relNow=Math.round(Date.now()/60000)-base;
  const people=Object.values(byName).filter(p=>p.name.trim().toLowerCase()!=='rachael cook').map(p=>{p.iv.sort((a,b)=>a[0]-b[0]);const m=[];for(const v of p.iv){const l=m[m.length-1];if(l&&v[0]<=l[1])l[1]=Math.max(l[1],v[1]);else m.push([v[0],v[1]])}p.iv=m;const st=fwPersonState(p,relNow);p.onNow=st.onNow;p.status=st.status;return p});
  if(!scanDone){scanDone=true;fwScan(stationId,tok)}
  return {v:2,t:Date.now(),base,types,scan:scanTypes,date:t0.getFullYear()+'-'+pad(t0.getMonth()+1)+'-'+pad(t0.getDate()),station:'Winterton',rows,people};
}



/* ---- Planner range (Planner tab: Day / Week / Custom). Days -7..+21, pushed to range.json every 30 min ---- */
async function fwRange(stationId,tok,offFrom,offTo){
  const pad=n=>String(n).padStart(2,'0'), H=[...Array(24).keys()].map(i=>pad(i));
  const light=c=>String(c||'').replace(/light-dark\(/,'').split(',')[0].replace('#','').trim();
  const E=s=>Math.round(new Date(s).getTime()/60000);
  const fullTip=t=>String(t||'').split(/[\r\n]+|<br\s*\/?>/i).map(x=>x.replace(/<[^>]*>/g,'').trim()).filter(Boolean).join('\n').slice(0,700);
  const t0=new Date(), base=Math.round(new Date(t0.getFullYear(),t0.getMonth(),t0.getDate()+offFrom).getTime()/60000);
  const grp=(A,n)=>(A.RowChildren.find(c=>c.RowData.Description===n)||{RowChildren:[]}).RowChildren;
  const days=[],dates=[];
  for(let o=offFrom;o<=offTo;o++){const d=new Date(t0.getFullYear(),t0.getMonth(),t0.getDate()+o);dates.push(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()));let A=null;try{A=await fwDay(stationId,o,tok)}catch(e){try{A=await fwDay(stationId,o,tok)}catch(e2){}}days.push(A)}
  if(!days.some(Boolean))throw new Error('range: no days');
  const rowMap={};
  days.forEach((A,di)=>{if(!A)return;for(const g of ['Crewing','Qualifications'])for(const r of grp(A,g)){const d=r.RowData,k=g+'|'+d.Name,o=rowMap[k]=rowMap[k]||{g,name:d.Name,min:d.Min,plan:d.Plan,n:dates.map(()=>null)};o.min=d.Min;o.plan=d.Plan;
    o.n[di]=H.map(h=>{try{return JSON.parse(d[h]).needSlot[0].cellText||''}catch(e){return ''}})}});
  const byName={},seenB=new Set();
  days.forEach(A=>{if(!A)return;const rootRes=((A.__root&&A.__root.RowChildren)||[]).find(c=>c.RowData&&c.RowData.Description==='Resource');const seenN=new Set();
    for(const r of grp(A,'Resource').concat(rootRes?rootRes.RowChildren:[])){if(seenN.has(r.RowData.Name))continue;seenN.add(r.RowData.Name);const d=r.RowData,o=byName[d.Name]=byName[d.Name]||{name:d.Name,role:d.Role||'',q:'',iv:[],bars:[]};
      if(d.Role&&!o.role)o.role=d.Role;
      for(const h of H){let cell;try{cell=JSON.parse(d[h]).plannerItem[0]}catch(e){continue}
        for(const it of [cell].concat(cell.appointments||[])){if(!it.itemDateTimeStart||!it.itemDateTimeEnd)continue;
          const tip=String(it.tooltip||''),isOn=it.type==='RotaAssignment'||(it.type==='Activity'&&/On-Call - (Available|Turn Out)/i.test(tip));
          if(it.type==='RotaAssignment'&&it.cellText&&!o.q)o.q=it.cellText;
          const s=E(it.itemDateTimeStart),e=E(it.itemDateTimeEnd);if(isNaN(s)||isNaN(e)||e<=s)continue;
          if(!isOn){const key=o.name+'|'+it.type+'|'+s+'|'+e;if(!seenB.has(key)){seenB.add(key);o.bars.push([String(it.type),fullTip(tip),light(it.colour),s-base,e-base])}continue}
          o.iv.push([s-base,e-base])}}}});
  const people=Object.values(byName).filter(p=>p.name.trim().toLowerCase()!=='rachael cook').map(p=>{p.iv.sort((a,b)=>a[0]-b[0]);const m=[];for(const v of p.iv){const l=m[m.length-1];if(l&&v[0]<=l[1])l[1]=Math.max(l[1],v[1]);else m.push([v[0],v[1]])}p.iv=m;return p});
  return {v:3,t:Date.now(),base,dates,station:'Winterton',rows:Object.values(rowMap),people};
}
let lastRange=0,rBusy=false,rMsg='';
async function rTick(){
  if(rBusy||!GM_getValue('ghtoken','')||Date.now()-lastRange<30*60000)return;rBusy=true;
  try{const tok=(document.querySelector('input[name=__RequestVerificationToken]')||{}).value;if(!tok)throw new Error('no token');
    const snap=await fwRange(STATION_ID,tok,-7,21);window.__rangeSnap=snap;await push(snap,'range.json','range');lastRange=Date.now();rMsg=''}
  catch(e){rMsg=' (range: '+e.message+')';lastRange=Date.now()-25*60000}
  finally{rBusy=false}
}

/* ---- Contract hours feed (same rules as the FireWatch contract tracker 1.6) ---- */
const CF={pad:n=>String(n).padStart(2,'0')};
const cMid=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const cAdd=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const cMon=d=>{const m=cMid(d);return cAdd(m,-((m.getDay()+6)%7))};
const cIso=d=>d.getFullYear()+'-'+CF.pad(d.getMonth()+1)+'-'+CF.pad(d.getDate());
const CBODY={"SelectedDisplayType":"Day","SelectedDate":null,"SelectedEndDate":null,"StationIDs":null,"StationID":null,"StationDesc":null,"Bookings":true,"Events":false,"Defects":false,"Services":false,"Works":false,"Exceptions":true,"Detachments":true,"Absences":true,"Training":true,"Temporary":false,"Sickness":true,"Qualifications":false,"Fleet":false,"Crewing":false,"Resource":false,"MaxLevels":false,"Holidays":true,"HolidayRequests":true,"QualExclusions":false,"Activities":true,"Drills":false,"ResourceRequests":false,"RoleReassignment":true,"ContractTypeID":null,"ContractTypeIDs":null,"WatchIDs":null,"WatchDesc":null,"ViewID":null,"TeamID":null,"CalendarView":"Week","Fuelling":false,"EmployeeID":null,"Reviews":true,"AbsenceRequests":true,"Rotas":true};
function cRecords(grid){const j=grid.indexOf('"Records":');if(j<0)return[];const s=grid.indexOf('[',j);let depth=0,inStr=false,esc=false,k=s;for(;k<grid.length;k++){const c=grid[k];if(inStr){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')inStr=false;continue}if(c==='"')inStr=true;else if(c==='[')depth++;else if(c===']'){depth--;if(depth===0)break}}return JSON.parse(grid.slice(s,k+1))}
async function cWeek(monday,tok){
  const body=Object.assign({},CBODY,{SelectedDate:cIso(monday)+'T00:00:00.000Z'});
  const r=await fetch('/FireWatchWebClient/Calendar/GetEmployeeCalendar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json; charset=utf-8','X-Requested-With':'XMLHttpRequest','__RequestVerificationToken':tok},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(r.status!==200)throw new Error('calendar '+r.status);
  const arr=JSON.parse(await r.text()),grid=arr.find(a=>a.updateTargetId==='employeeCalendarGridContainer');
  if(!grid)throw new Error('calendar grid missing');
  const seen=new Set(),items=[];
  cRecords(grid.html).forEach(rec=>Object.keys(rec).forEach(k=>{if(!/^\d\d:\d\d$/.test(k)||!rec[k])return;let o;try{o=JSON.parse(rec[k])}catch(e){return}
    const add=p=>{if(!p||!p.itemDateTimeStart||!p.itemDateTimeEnd||!p.type)return;const id=p.type+'|'+p.itemDateTimeStart+'|'+p.itemDateTimeEnd+'|'+p.id;if(seen.has(id))return;seen.add(id);items.push({type:p.type,tip:p.tooltip||'',s:new Date(p.itemDateTimeStart),e:new Date(p.itemDateTimeEnd)})};
    (o.plannerItem||[]).forEach(p=>{add(p);(p.appointments||[]).forEach(add)})}));
  return items;
}
function cClass(it){const t=it.type+' '+it.tip;if(/detach/i.test(t))return'X';if(it.type==='Holiday')return'C';if(it.type==='Sickness'||it.type==='OtherAbsence')return'A';if(it.type==='RotaAssignment')return/Unavailable/i.test(t)?'X':'C';if(it.type==='DrillEmployeeActivity')return'C';if(it.type==='Activity'){if(/Unavailable/i.test(t))return'X';if(/Turn Out/i.test(t))return'C';if(/Available/i.test(t))return'C';return'X'}return'I'}
function cMerge(iv){iv=iv.filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);const out=[];iv.forEach(x=>{const l=out[out.length-1];if(l&&x[0]<=l[1])l[1]=Math.max(l[1],x[1]);else out.push([x[0],x[1]])});return out}
function cSub(a,b){const out=[];a.forEach(x=>{let cur=x[0];b.forEach(y=>{if(y[1]<=cur||y[0]>=x[1])return;if(y[0]>cur)out.push([cur,y[0]]);cur=Math.max(cur,y[1])});if(cur<x[1])out.push([cur,x[1]])});return out}
function cClip(iv,f,t){return iv.map(x=>[Math.max(x[0],f),Math.min(x[1],t)]).filter(x=>x[1]>x[0])}
function cBand(day,part){const wd=day.getDay();if(part==='day')return(wd>=1&&wd<=5)?'P1':'P4';if(part==='eve')return(wd===5||wd===6)?'P3':'U';return(wd===6||wd===0)?'P3':'U'}
function cExport(items,from,to){
  const C=[],X=[],A=[];items.forEach(it=>{const k=cClass(it),seg=[it.s.getTime(),it.e.getTime()];if(k==='I')return;(k==='C'?C:k==='A'?A:X).push(seg)});
  const Cm=cMerge(C),Xm=cMerge(X),Am=cMerge(A);
  const counted=cClip(cSub(cSub(Cm,Xm),Am),from,to),absence=cClip(cSub(Am,Xm),from,to);
  const hm=t=>{const d=new Date(t);return CF.pad(d.getHours())+':'+CF.pad(d.getMinutes())};
  const rows=[];
  const walk=(iv,type,fb)=>iv.forEach(x=>{let d=cMid(new Date(x[0]));while(d.getTime()<x[1]){const d6=new Date(d.getFullYear(),d.getMonth(),d.getDate(),6),d18=new Date(d.getFullYear(),d.getMonth(),d.getDate(),18),next=cAdd(d,1);
    [[d,d6,'early'],[d6,d18,'day'],[d18,next,'eve']].forEach(sg=>{const a=Math.max(x[0],sg[0].getTime()),b=Math.min(x[1],sg[1].getTime());if(b>a)rows.push([cIso(d),hm(a),hm(b),type,fb||cBand(d,sg[2])].join(','))});d=next}});
  walk(counted,'avail');walk(absence,'absence','U');
  return rows.join('\n');
}
async function contractText(){
  const tok=(document.querySelector('input[name=__RequestVerificationToken]')||{}).value;
  if(!tok)throw new Error('no token');
  const now=new Date(),nextFirst=new Date(now.getFullYear(),now.getMonth()+1,1),after=new Date(now.getFullYear(),now.getMonth()+2,1);
  const from=cMon(cAdd(nextFirst,-56)).getTime(),to=cAdd(cMon(cAdd(after,-1)),7).getTime();
  let items=[];for(let m=new Date(from);m.getTime()<to;m=cAdd(m,7))items=items.concat(await cWeek(m,tok));
  return cExport(items,from,to);
}
let lastCText='',lastCPush=0;
async function contractTick(){
  if(!GM_getValue('ghtoken',''))return;
  const text=await contractText();
  if(text&&(text!==lastCText||Date.now()-lastCPush>15*60000)){await push({v:1,t:Date.now(),text},'contract.json','contract');lastCText=text;lastCPush=Date.now()}
}

let lastSig='', lastPush=0, busy=false;
const sig=s=>JSON.stringify([s.date,s.rows.map(r=>[r.name,r.c,r.n]),s.people.map(p=>[p.name,p.iv,p.bars,p.onNow,p.status])]);
function gh(method,path,data){return new Promise((res,rej)=>{GM_xmlhttpRequest({method,url:'https://api.github.com/repos/'+REPO+path+(method==='GET'?'&_='+Date.now():''),nocache:true,anonymous:true,headers:{'Cache-Control':'no-cache','Authorization':'Bearer '+GM_getValue('ghtoken',''),'Accept':'application/vnd.github+json','Content-Type':'application/json'},data:data?JSON.stringify(data):undefined,timeout:20000,onload:r=>res(r),onerror:()=>rej(new Error('network')),ontimeout:()=>rej(new Error('timeout')),onabort:()=>rej(new Error('abort'))})})}
function b64(s){return btoa(unescape(encodeURIComponent(s)))}
async function push(snap,file,label){
  file=file||FILE;label=label||'planner';
  for(let i=0;i<3;i++){
    const g=await gh('GET','/contents/'+file+'?ref='+BRANCH);
    if(g.status!==200&&g.status!==404)throw new Error('get '+g.status+' '+(g.responseText||'').slice(0,60));
    const sha=g.status===200?JSON.parse(g.responseText).sha:undefined;
    const r=await gh('PUT','/contents/'+file,{message:label+' '+new Date(snap.t).toISOString().slice(11,16),content:b64(JSON.stringify(snap)),branch:BRANCH,sha});
    if(r.status<300){if(file===FILE){lastPush=Date.now();GM_setValue('lastPush',lastPush)}return}
    if(i===2||(r.status!==409&&r.status!==422))throw new Error('push '+r.status+' '+(r.responseText||'').slice(0,80));
    await new Promise(x=>setTimeout(x,1500));
  }
}
async function tick(){
  if(busy)return;busy=true;
  try{
    const snap=await fwPlannerSnapshot(STATION_ID), sg=sig(snap);
    window.__plannerSnap=snap;
    if(GM_getValue('ghtoken','')&&(sg!==lastSig||Date.now()-lastPush>50000)){await push(snap);lastSig=sg}
    badge('Live feed OK '+cMsg+rMsg+' '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),true);
  }catch(e){badge('Live feed: '+e.message,false)}
  finally{busy=false}
}
let cBusy=false,cMsg='';
async function cTick(){
  if(cBusy)return;cBusy=true;
  try{await contractTick();cMsg='+ hours'}catch(e){cMsg='(hours: '+e.message+')'}
  finally{cBusy=false}
}
/* watchdog: no successful planner push for 10 min -> reload tab once per 10 min (fresh session + token) */
if(!GM_getValue('lastPush',0))GM_setValue('lastPush',Date.now());
function watchdog(){
  if(!GM_getValue('ghtoken',''))return;
  const now=Date.now();
  if(now-GM_getValue('lastPush',now)>10*60000&&now-GM_getValue('lastReload',0)>10*60000){GM_setValue('lastReload',now);location.reload()}
}
let b;function badge(t,ok){if(!b){b=document.createElement('div');b.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99999;font:11px sans-serif;padding:3px 8px;border-radius:10px;color:#fff;opacity:.8';document.body.appendChild(b)}b.style.background=ok?'#1a7f4b':'#b42318';b.textContent=t}
GM_registerMenuCommand('Set GitHub token for live feed',()=>{const t=prompt('Paste the GitHub token (contents: read and write on oncall-tracker)');if(t)GM_setValue('ghtoken',t.trim())});
GM_registerMenuCommand('Open Live in tracker app',async()=>{const s=await fwPlannerSnapshot(STATION_ID);window.open(APP+'#p='+btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g,'-').replace(/\//g,'_'),'_blank')});
setTimeout(tick,4000);setInterval(tick,60000);setTimeout(cTick,15000);setInterval(cTick,5*60000);setInterval(watchdog,60000);setTimeout(rTick,30000);setInterval(rTick,5*60000);
})();
