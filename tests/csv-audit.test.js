// node tests\csv-audit.test.js  -> prints PASS or FAIL lines
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('/* ===== Contract rules'),b=html.indexOf('</script>',a);
const rules=new Function(html.slice(a,b)+';return{COUNTS,NEVER,WEEKLY,CONTRACT,WEEKS,calcRange,entryHours,dayNum}')();
const {buildAuditCSV,cell}=require(path.join(root,'csv-audit.js'));
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL: '+m)}};
const entries=[
 {date:'2026-11-02',start:'06:00',end:'18:00',type:'avail',band:'P1'},
 {date:'2026-11-02',start:'18:00',end:'06:00',type:'avail',band:'U'},
 {date:'2026-11-03',start:'08:00',end:'18:00',type:'leave',band:'P1'},
 {date:'2026-11-04',start:'08:00',end:'16:00',type:'absence',band:'U'},
 {date:'2026-11-05',start:'07:00',end:'15:00',type:'detach',band:'P1'},
 {date:'2026-11-06',start:'18:00',end:'06:00',type:'avail',band:'P3'},
 {date:'2026-11-07',start:'06:00',end:'18:00',type:'avail',band:'P4'}
];
const from=rules.dayNum('2026-11-02'),to=from+7;
const csv=buildAuditCSV({entries,from,to,now:Date.parse('2026-11-30T00:00:00Z'),exportedAt:new Date('2026-11-25T19:06:00Z'),kind:'wk',daily:true,lib:rules,K:rules});
function parse(s){const rows=[];let r=[],v='',q=false;s=s.replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const ch=s[i];if(q){if(ch==='"'){if(s[i+1]==='"'){v+='"';i++}else q=false}else v+=ch}else if(ch==='"')q=true;else if(ch===','){r.push(v);v=''}else if(ch==='\r'){}else if(ch==='\n'){r.push(v);rows.push(r);r=[];v=''}else v+=ch}return rows}
const rows=parse(csv);
ok(csv.charCodeAt(0)===0xFEFF,'BOM missing');ok(csv.includes('\r\n'),'CRLF missing');
const wi=rows.findIndex(r=>r[0]==='Week commencing'&&r[1]&&r[1].startsWith('P1'));
const wk=rows[wi+1];ok(wk&&wk[0]==='2026-11-02','weekly row missing');
const n=x=>parseFloat(x);
const expectCounted=12+12+10+8*85/168+12+12;
ok(Math.abs(n(wk[6])-expectCounted)<0.06,'counted '+wk[6]+' expected '+expectCounted.toFixed(2));
ok(Math.abs(n(wk[1])+n(wk[2])+n(wk[3])+n(wk[4])+n(wk[5])-n(wk[6]))<0.11,'bands + absence do not equal counted');
ok(n(wk[7])===8,'detachment hours should be 8.0, got '+wk[7]);
ok(n(wk[1])===22,'P1 should be 22 (12 avail + 10 leave, detach excluded), got '+wk[1]);
const ei=rows.findIndex(r=>r[0]==='Week commencing'&&r[1]==='Date');
let sum=0,detRow=null,leaveRow=null;for(let i=ei+1;rows[i]&&rows[i][0];i++){sum+=n(rows[i][8]);if(rows[i][2]==='Detachment')detRow=rows[i];if(rows[i][2]==='Annual leave')leaveRow=rows[i]}
ok(Math.abs(sum-n(wk[6]))<0.11,'entry counted hrs '+sum.toFixed(2)+' != weekly '+wk[6]);
ok(detRow&&detRow[7]==='No'&&n(detRow[8])===0,'detachment must be No / 0 counted');
ok(leaveRow&&leaveRow[7]==='Yes','annual leave must count');
ok(rows.some(r=>r[0]==='DAILY TOTALS'),'daily section missing');
ok(cell('=1+1')==='"\'=1+1"'&&cell('@x')==='"\'@x"'&&cell('+1')==='"\'+1"'&&cell('-1')==='"\'-1"','formula escape');
ok(cell(-23)==='"-23.0"','numbers must stay numbers');
console.log(fails?('FAIL ('+fails+')'):'PASS');process.exit(fails?1:0);