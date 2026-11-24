// ==UserScript==
// @name         Winterton planner feed for tracker app
// @namespace    paulmatthews777-pixel
// @version      1.0
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
async function fwPlannerSnapshot(stationId){
  const pad=n=>String(n).padStart(2,'0'), now=new Date();
  const day=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+'T00:00:00.000Z';
  const tok=(document.querySelector('input[name=__RequestVerificationToken]')||{}).value;
  if(!tok)throw new Error('no token');
  const body={SelectedDisplayType:'Day',SelectedDate:day,SelectedEndDate:day,StationIDs:[stationId],StationID:null,StationDesc:null,Bookings:true,Events:true,Defects:false,Services:false,Works:false,Exceptions:true,Detachments:true,Absences:true,Training:true,Temporary:true,Sickness:true,Qualifications:true,Fleet:true,Crewing:true,Resource:true,MaxLevels:false,Holidays:true,HolidayRequests:true,QualExclusions:true,Activities:true,Drills:true,ResourceRequests:false,RoleReassignment:true,ContractTypeID:null,ContractTypeIDs:[],WatchIDs:[],WatchDesc:'',ViewID:null,TeamID:null};
  const r=await fetch('/FireWatchWebClient/Planner/GetPlannerRows',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json; charset=utf-8','Accept':'application/json','__RequestVerificationToken':tok,'X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error('planner '+r.status);
  const j=await r.json(), A=j.ResourceContainer[0].Appliances[0];
  const grp=n=>(A.RowChildren.find(c=>c.RowData.Description===n)||{RowChildren:[]}).RowChildren;
  const H=[...Array(24).keys()].map(i=>pad(i));
  const light=c=>String(c||'').replace(/light-dark\(/,'').split(',')[0].replace('#','').trim();
  const cls=hex=>{const n=parseInt(hex,16);if(isNaN(n))return 'x';const R=n>>16&255,G=n>>8&255,B=n&255;if(R>200&&G<100)return 'r';if(R>200&&G>=100&&B<100)return 'a';if(G>R&&G>B)return 'g';return 'x'};
  const rows=[];
  for(const g of ['Crewing','Qualifications'])for(const r of grp(g)){
    const d=r.RowData,cells=H.map(h=>{try{const p=JSON.parse(d[h]).needSlot[0];return {c:cls(light(p.colour)),n:p.cellText||''}}catch(e){return {c:'x',n:''}}});
    rows.push({name:d.Name,min:d.Min,plan:d.Plan,c:cells.map(x=>x.c).join(''),n:cells.map(x=>x.n)});
  }
  const people=grp('Resource').map(r=>{const d=r.RowData;let s='';for(const h of H){try{const p=JSON.parse(d[h]).plannerItem[0];s+=(p.type==='RotaAssignment'||cls(light(p.colour))==='g')?'1':'0'}catch(e){s+='0'}}return {name:d.Name,role:d.Role||'',q:d.Call||'',on:s}});
  return {v:1,t:Date.now(),date:day.slice(0,10),station:'Winterton',rows,people};
}

let lastSig='', lastPush=0, busy=false;
const sig=s=>JSON.stringify([s.date,s.rows.map(r=>[r.name,r.c,r.n]),s.people.map(p=>[p.name,p.on])]);
function gh(method,path,data){return new Promise((res,rej)=>{GM_xmlhttpRequest({method,url:'https://api.github.com/repos/'+REPO+path,headers:{'Authorization':'Bearer '+GM_getValue('ghtoken',''),'Accept':'application/vnd.github+json','Content-Type':'application/json'},data:data?JSON.stringify(data):undefined,onload:r=>res(r),onerror:rej})})}
function b64(s){return btoa(unescape(encodeURIComponent(s)))}
async function push(snap){
  const g=await gh('GET','/contents/'+FILE+'?ref='+BRANCH);
  const sha=g.status===200?JSON.parse(g.responseText).sha:undefined;
  const r=await gh('PUT','/contents/'+FILE,{message:'planner '+new Date(snap.t).toISOString().slice(11,16),content:b64(JSON.stringify(snap)),branch:BRANCH,sha});
  if(r.status>=300)throw new Error('push '+r.status);
  lastPush=Date.now();
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
