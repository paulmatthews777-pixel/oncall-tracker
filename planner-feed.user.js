// ==UserScript==
// @name         Winterton planner feed for tracker app
// @namespace    paulmatthews777-pixel
// @version      1.3
// @description  Reads the Winterton station planner in FireWatch and pushes a snapshot to the tracker app's Live tab
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
  const r=await fetch('/FireWatchWebClient/Planner/GetPlannerRows',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json; charset=utf-8','Accept':'application/json','__RequestVerificationToken':tok,'X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error('planner '+r.status);
  return (await r.json()).ResourceContainer[0].Appliances[0];
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
  const byName={};
  days.forEach(A=>{for(const r of grp(A,'Resource')){const d=r.RowData,o=byName[d.Name]=byName[d.Name]||{name:d.Name,role:d.Role||'',q:'',iv:[]};
    for(const h of H){let cell;try{cell=JSON.parse(d[h]).plannerItem[0]}catch(e){continue}
      const list=[cell].concat(cell.appointments||[]);
      for(const it of list){if(!it.itemDateTimeStart||!it.itemDateTimeEnd)continue;
        const tip=String(it.tooltip||''),isOn=it.type==='RotaAssignment'||(it.type==='Activity'&&/Turn Out/i.test(tip));
        if(it.type==='RotaAssignment'&&it.cellText&&!o.q)o.q=it.cellText;
        if(!isOn)continue;const s=E(it.itemDateTimeStart),e=E(it.itemDateTimeEnd);if(isNaN(s)||isNaN(e)||e<=s)continue;o.iv.push([s-base,e-base]);}}}});
  const people=Object.values(byName).map(p=>{p.iv.sort((a,b)=>a[0]-b[0]);const m=[];for(const v of p.iv){const l=m[m.length-1];if(l&&v[0]<=l[1])l[1]=Math.max(l[1],v[1]);else m.push([v[0],v[1]])}p.iv=m;return p});
  return {v:2,t:Date.now(),base,date:t0.getFullYear()+'-'+pad(t0.getMonth()+1)+'-'+pad(t0.getDate()),station:'Winterton',rows,people};
}

let lastSig='', lastPush=0, busy=false;
const sig=s=>JSON.stringify([s.date,s.rows.map(r=>[r.name,r.c,r.n]),s.people.map(p=>[p.name,p.iv])]);
function gh(method,path,data){return new Promise((res,rej)=>{GM_xmlhttpRequest({method,url:'https://api.github.com/repos/'+REPO+path+(method==='GET'?'&_='+Date.now():''),nocache:true,anonymous:true,headers:{'Cache-Control':'no-cache','Authorization':'Bearer '+GM_getValue('ghtoken',''),'Accept':'application/vnd.github+json','Content-Type':'application/json'},data:data?JSON.stringify(data):undefined,onload:r=>res(r),onerror:rej})})}
function b64(s){return btoa(unescape(encodeURIComponent(s)))}
async function push(snap){
  for(let i=0;i<3;i++){
    const g=await gh('GET','/contents/'+FILE+'?ref='+BRANCH);
    if(g.status!==200&&g.status!==404)throw new Error('get '+g.status+' '+(g.responseText||'').slice(0,60));
    const sha=g.status===200?JSON.parse(g.responseText).sha:undefined;
    const r=await gh('PUT','/contents/'+FILE,{message:'planner '+new Date(snap.t).toISOString().slice(11,16),content:b64(JSON.stringify(snap)),branch:BRANCH,sha});
    if(r.status<300){lastPush=Date.now();return}
    if(i===2||(r.status!==409&&r.status!==422))throw new Error('push '+r.status+' '+(r.responseText||'').slice(0,80));
    await new Promise(x=>setTimeout(x,1500));
  }
}
async function tick(){
  if(busy)return;busy=true;
  try{
    const snap=await fwPlannerSnapshot(STATION_ID), sg=sig(snap);
    window.__plannerSnap=snap;
    if(GM_getValue('ghtoken','')&&(sg!==lastSig||Date.now()-lastPush>5*60000)){await push(snap);lastSig=sg}
    badge('Live feed OK '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),true);
  }catch(e){badge('Live feed: '+e.message,false)}
  busy=false;
}
let b;function badge(t,ok){if(!b){b=document.createElement('div');b.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99999;font:11px sans-serif;padding:3px 8px;border-radius:10px;color:#fff;opacity:.8';document.body.appendChild(b)}b.style.background=ok?'#1a7f4b':'#b42318';b.textContent=t}
GM_registerMenuCommand('Set GitHub token for live feed',()=>{const t=prompt('Paste the GitHub token (contents: read and write on oncall-tracker)');if(t)GM_setValue('ghtoken',t.trim())});
GM_registerMenuCommand('Open Live in tracker app',async()=>{const s=await fwPlannerSnapshot(STATION_ID);window.open(APP+'#p='+btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g,'-').replace(/\//g,'_'),'_blank')});
setTimeout(tick,4000);setInterval(tick,60000);
})();
