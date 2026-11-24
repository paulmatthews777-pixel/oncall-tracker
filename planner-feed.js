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
