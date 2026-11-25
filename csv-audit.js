/* Audit CSV builder. Pure function, no DOM. Used by index.html and tests\csv-audit.test.js */
(function(root){
'use strict';
var NAMES={avail:'Available',turnout:'Turn out',drill:'Drill',rota:'Rota',leave:'Annual leave',absence:'Absence',detach:'Detachment',unavail:'Unavailable',course:'Course'};
var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function pad(n){return String(n).padStart(2,'0')}
function iso(dn){var d=new Date(dn*86400000);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
function monday(dn){return dn-((new Date(dn*86400000).getUTCDay()+6)%7)}
function f1(n){return (Math.round(n*10)/10).toFixed(1)}
function cell(v){
  if(typeof v==='number')return '"'+f1(v)+'"';
  var s=String(v==null?'':v);
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function line(a){return a.map(cell).join(',')}
function status(diff){return Math.abs(diff)<0.005?'Met':(diff>0?'Over':'Short')}
function buildAuditCSV(c){
  var L=c.lib,K=c.K,E=c.entries,out=[];
  var mult=c.kind==='8w'?K.WEEKS:(c.kind==='wk'?1:0);
  var tot={P1:0,U:0,P3:0,P4:0,ABS:0,T:0,D:0};
  var wrows=[];
  function detIn(f,t){var s=0;E.forEach(function(e){var dn=L.dayNum(e.date);if(e.type==='detach'&&dn>=f&&dn<t)s+=L.entryHours(e)});return s}
  for(var m=monday(c.from);m<c.to;m+=7){
    var f=Math.max(m,c.from),t=Math.min(m+7,c.to),full=(f===m&&t===m+7);
    var x=L.calcRange(E,f,t,c.now).all,det=detIn(f,t),diff=x.T-K.CONTRACT;
    wrows.push([iso(m),x.P1,x.U,x.P3,x.P4,x.ABS,x.T,det,t-f,full?diff:'',full?status(diff):'Part week']);
    tot.P1+=x.P1;tot.U+=x.U;tot.P3+=x.P3;tot.P4+=x.P4;tot.ABS+=x.ABS;tot.T+=x.T;tot.D+=det;
  }
  var ex=c.exportedAt.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'});
  out.push(line(['Live Crewing audit export']));
  out.push(line(['Exported',ex]));
  out.push(line(['Brigade number','5970']));
  out.push(line(['Contract hours per week',String(K.CONTRACT)]));
  out.push(line(['Period',iso(c.from)+' to '+iso(c.to-1)]));
  if(mult){var tt=K.CONTRACT*mult,dd=tot.T-tt;out.push(line(['Counted total / target',f1(tot.T)+' / '+f1(tt)]));out.push(line(['Difference',Math.abs(dd)<0.005?'Met':(dd>0?'Over by ':'Short by ')+f1(Math.abs(dd))]))}
  else out.push(line(['Counted total',f1(tot.T)]));
  out.push(line(['Rule','Annual leave counts; detachments do not count']));
  out.push(line(['Absence credit','Each absent hour credits 85/168 of an hour, added to the total only']));
  out.push('');
  out.push(line(['WEEKLY AUDIT BY CONTRACT BAND']));
  out.push(line(['Week commencing','P1 weekday 06-18','P2 + unspecified','P3 weekend nights','P4 weekend days','Absence credit','Counted hrs','Detachment hrs (not counted)','Days in period','vs 85','Status']));
  wrows.forEach(function(r){out.push(line(r))});
  out.push(line(['Total',tot.P1,tot.U,tot.P3,tot.P4,tot.ABS,tot.T,tot.D,'','','']));
  if(mult){
    var W=K.WEEKLY;
    out.push(line(['Target',W.P1*mult,W.U*mult,W.P3*mult,W.P4*mult,'',K.CONTRACT*mult,'','','','']));
    out.push(line(['Difference',tot.P1-W.P1*mult,tot.U-W.U*mult,tot.P3-W.P3*mult,tot.P4-W.P4*mult,'',tot.T-K.CONTRACT*mult,'','','','']));
  }
  out.push('');
  out.push(line(['WHERE THE HOURS WENT (every entry)']));
  out.push(line(['Week commencing','Date','Type','From','To','Hours','Band','Counts toward 85?','Counted hrs']));
  var inR=E.filter(function(e){var dn=L.dayNum(e.date);return dn>=c.from&&dn<c.to}).sort(function(a,b){return (a.date+a.start)<(b.date+b.start)?-1:1});
  inR.forEach(function(e){
    var h=L.entryHours(e),yes=K.COUNTS.indexOf(e.type)>=0,abs=e.type==='absence';
    var counted=abs?h*K.CONTRACT/168:(yes?h:0);
    out.push(line([iso(monday(L.dayNum(e.date))),e.date,NAMES[e.type]||e.type,e.start,e.end,h,abs?'':(e.band||''),(yes||abs)?'Yes':'No',counted]));
  });
  if(c.daily){
    out.push('');
    out.push(line(['DAILY TOTALS']));
    out.push(line(['Date','Day','Counted hrs','P1','P2 + unspecified','P3','P4','Absence credit','Detachment hrs (not counted)']));
    for(var d=c.from;d<c.to;d++){var y=L.calcRange(E,d,d+1,c.now).all;out.push(line([iso(d),DAYS[new Date(d*86400000).getUTCDay()],y.T,y.P1,y.U,y.P3,y.P4,y.ABS,detIn(d,d+1)]))}
  }
  return '\uFEFF'+out.join('\r\n')+'\r\n';
}
var api={buildAuditCSV:buildAuditCSV,cell:cell};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuditCSV=api;
})(typeof self!=='undefined'?self:this);