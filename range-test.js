async function fwDay(stationId,off,tok){
  const pad=n=>String(n).padStart(2,'0'), d=new Date();d.setDate(d.getDate()+off);
  const day=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T00:00:00.000Z';
  const body={SelectedDisplayType:'Day',SelectedDate:day,SelectedEndDate:day,StationIDs:[stationId],StationID:null,StationDesc:null,Bookings:true,Events:true,Defects:false,Services:false,Works:false,Exceptions:true,Detachments:true,Absences:true,Training:true,Temporary:true,Sickness:true,Qualifications:true,Fleet:true,Crewing:true,Resource:true,MaxLevels:false,Holidays:true,HolidayRequests:true,QualExclusions:true,Activities:true,Drills:true,ResourceRequests:false,RoleReassignment:true,ContractTypeID:null,ContractTypeIDs:[],WatchIDs:[],WatchDesc:'',ViewID:null,TeamID:null};
  const r=await fetch('/FireWatchWebClient/Planner/GetPlannerRows',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json; charset=utf-8','Accept':'application/json','__RequestVerificationToken':tok,'X-Requested-With':'XMLHttpRequest'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('planner '+r.status);
  const j=(await r.json()).ResourceContainer[0],A=j.Appliances[0];A.__root=j;return A;
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
  const people=Object.values(byName).map(p=>{p.iv.sort((a,b)=>a[0]-b[0]);const m=[];for(const v of p.iv){const l=m[m.length-1];if(l&&v[0]<=l[1])l[1]=Math.max(l[1],v[1]);else m.push([v[0],v[1]])}p.iv=m;return p});
  return {v:3,t:Date.now(),base,dates,station:'Winterton',rows:Object.values(rowMap),people};
}

window.fwRange=fwRange;
