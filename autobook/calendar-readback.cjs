// Same read-only endpoint/filters as planner-feed.user.js. Never opens or saves an Activity.
const BODY={SelectedDisplayType:'Day',SelectedDate:null,SelectedEndDate:null,StationIDs:null,StationID:null,StationDesc:null,Bookings:true,Events:false,Defects:false,Services:false,Works:false,Exceptions:true,Detachments:true,Absences:true,Training:true,Temporary:false,Sickness:true,Qualifications:false,Fleet:false,Crewing:false,Resource:false,MaxLevels:false,Holidays:true,HolidayRequests:true,QualExclusions:false,Activities:true,Drills:false,ResourceRequests:false,RoleReassignment:true,ContractTypeID:null,ContractTypeIDs:null,WatchIDs:null,WatchDesc:null,ViewID:null,TeamID:null,CalendarView:'Week',Fuelling:false,EmployeeID:null,Reviews:true,AbsenceRequests:true,Rotas:true};
function weeksFor(range){
  const first=new Date(range.from.slice(0,10)+'T00:00:00Z'),end=new Date(range.to+':00Z');
  if(!Number.isFinite(+first)||!Number.isFinite(+end)||range.to<=range.from)throw Error('Invalid read-back range');
  first.setUTCDate(first.getUTCDate()-(first.getUTCDay()+6)%7);
  const weeks=[];
  for(let d=+first;d<+end;d+=7*86400000)weeks.push(new Date(d).toISOString().slice(0,10));
  if(weeks.length>104)throw Error('Read-back range too long');
  return weeks;
}
function records(html){
  const start=html.indexOf('"Records":');if(start<0)throw Error('Calendar Records missing');
  const s=html.indexOf('[',start);if(s<0)throw Error('Calendar Records invalid');
  let depth=0,string=false,escape=false;
  for(let i=s;i<html.length;i++){
    const c=html[i];
    if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue}
    if(c==='"')string=true;else if(c==='[')depth++;else if(c===']'&&--depth===0)return JSON.parse(html.slice(s,i+1));
  }
  throw Error('Calendar Records truncated');
}
function wall(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value))throw Error('Calendar timestamp unrecognised');
  if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))return value.slice(0,16);
  const d=new Date(value);if(!Number.isFinite(+d))throw Error('Invalid calendar timestamp');
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function parseWeek(response){
  if(!Array.isArray(response))throw Error('Calendar response invalid');
  const grid=response.find(r=>r.updateTargetId==='employeeCalendarGridContainer');
  if(typeof grid?.html!=='string')throw Error('Calendar grid missing');
  const out=[],seen=new Set();
  for(const row of records(grid.html))for(const [key,cell] of Object.entries(row)){
    if(!/^\d\d:\d\d$/.test(key)||!cell)continue;
    let data;try{data=typeof cell==='string'?JSON.parse(cell):cell}catch{throw Error('Calendar cell invalid')}
    const add=p=>{
      for(const a of p?.appointments||[])add(a);
      if(!p||!p.itemDateTimeStart||!p.itemDateTimeEnd||!p.type)return;
      const s=wall(p.itemDateTimeStart),e=wall(p.itemDateTimeEnd);
      const id=[p.type,p.id,s,e].join('|');if(seen.has(id))return;seen.add(id);
      out.push({s,e,k:p.type,t:String(p.tooltip||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/[–—]/g,'-')});
    };
    for(const p of data.plannerItem||[])add(p);
  }
  return out;
}
async function readWeek(c,week,evalJs){
  const body={...BODY,SelectedDate:week+'T00:00:00.000Z'};
  const js=`(async()=>{
    const tok=document.querySelector('input[name=__RequestVerificationToken]')?.value;
    if(!tok)throw Error('Calendar session unavailable');
    const r=await fetch('/FireWatchWebClient/Calendar/GetEmployeeCalendar',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json; charset=utf-8','X-Requested-With':'XMLHttpRequest','__RequestVerificationToken':tok},
      body:JSON.stringify(${JSON.stringify(body)}),signal:AbortSignal.timeout(20000),cache:'no-store'});
    if(!r.ok)throw Error('Calendar read '+r.status);
    return JSON.stringify(await r.json())
  })()`;
  return parseWeek(JSON.parse(await evalJs(c,js)));
}
module.exports={weeksFor,records,parseWeek,wall,readWeek};
