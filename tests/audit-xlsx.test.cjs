const fs=require('fs'),path=require('path'),assert=require('assert'),os=require('os');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('/* ===== Contract rules'),b=html.indexOf('</script>',a);
const rules=new Function(html.slice(a,b)+';return{COUNTS,NEVER,WEEKLY,CONTRACT,WEEKS,calcRange,entryHours,dayNum}')();
const {buildAuditCSV}=require(path.join(root,'csv-audit.js'));
const X=require(path.join(root,'audit-xlsx.js'));
const E=(date,start,end,type,band)=>({date,start,end,type,band});
// week 1 (02 Nov) under 85, week 2 (09 Nov) over 85
const entries=[E('2026-11-02','06:00','18:00','avail','P1'),E('2026-11-03','06:00','18:00','avail','P1'),E('2026-11-06','18:00','06:00','avail','P3')];
for(let d=9;d<=15;d++)entries.push(E('2026-11-'+String(d).padStart(2,'0'),'00:00','12:00','avail',d<13?'P1':'U'),E('2026-11-'+String(d).padStart(2,'0'),'12:00','00:00','avail','U'));
const from=rules.dayNum('2026-11-02'),to=from+14;
const csv=buildAuditCSV({entries,from,to,now:Date.parse('2026-12-30T00:00:00Z'),exportedAt:new Date('2026-11-25T19:06:00Z'),kind:'8w',daily:false,lib:rules,K:rules});
const bytes=X.buildAuditXLSX(csv,rules,'8w');
// --- read the zip back with an independent reader: CRCs, names, stored data
const buf=Buffer.from(bytes);
const eocd=buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));assert(eocd>0,'no EOCD');
const n=buf.readUInt16LE(eocd+10),cdOff=buf.readUInt32LE(eocd+16);let p=cdOff;const files={};
for(let i=0;i<n;i++){assert.strictEqual(buf.readUInt32LE(p),0x02014b50);const crc=buf.readUInt32LE(p+16),sz=buf.readUInt32LE(p+24),nl=buf.readUInt16LE(p+28),lo=buf.readUInt32LE(p+42);const name=buf.slice(p+46,p+46+nl).toString();
  assert.strictEqual(buf.readUInt32LE(lo),0x04034b50);const ln=buf.readUInt16LE(lo+26),le=buf.readUInt16LE(lo+28),data=buf.slice(lo+30+ln+le,lo+30+ln+le+sz);assert.strictEqual(X.crc(data),crc,'crc '+name);files[name]=data.toString('utf8');p+=46+nl}
['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml'].forEach(f=>assert(files[f],'missing '+f));
// --- cells: style per row
const rows=[...files['xl/worksheets/sheet1.xml'].matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)].map(m=>({r:+m[1],cells:[...m[2].matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"(?: t="inlineStr")?>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g)].map(c=>({col:c[1],s:+c[2],v:c[3]!==undefined?c[3]:c[4]}))}));
const find=t=>rows.find(r=>r.cells[0]&&r.cells[0].v===t);
const w1=rows.find(r=>r.cells[0]&&r.cells[0].v==='2026-11-02'&&r.cells.length>5),w2=rows.find(r=>r.cells[0]&&r.cells[0].v==='2026-11-09'&&r.cells.length>5);
assert(w1&&w2,'weekly rows');
const cell=(r,c)=>r.cells.find(x=>x.col===c);
// counted hrs is column G; week 1 = 36 h => red; week 2 = 7 x 24 = 168 h => green
assert.strictEqual(cell(w1,'G').s,5,'week1 counted should be red');assert.strictEqual(cell(w2,'G').s,4,'week2 counted should be green');
assert.strictEqual(cell(w1,'K').s,7,'week1 status red');assert.strictEqual(cell(w2,'K').s,6,'week2 status green');
// P1 band: week1 24 h vs 35 => red; week2 5 days x 12 = 60 vs 35 => green
assert.strictEqual(cell(w1,'B').s,5);assert.strictEqual(cell(w2,'B').s,4);
// 8-week total row coloured against 8 x targets (total 204 h < 680) => red
const tot=find('Total');assert.strictEqual(cell(tot,'G').s,5,'total under 8x85 should be red');
// CSV and XLSX agree on every number in the weekly rows
const csvRows=X.parseCsv(csv);const c1=csvRows.find(r=>r[0]==='2026-11-02'&&r.length>5);
assert.strictEqual(parseFloat(cell(w1,'G').v),parseFloat(c1[6]));
// headers are styled, section titles bold
assert(rows.some(r=>r.cells[0]&&r.cells[0].v==='Week commencing'&&r.cells[0].s===2));
assert(find('WEEKLY AUDIT BY CONTRACT BAND').cells[0].s===1);
// the styles file defines a red and a green fill
assert(/FF63BE7B/.test(files['xl/styles.xml'])&&/FFF8696B/.test(files['xl/styles.xml']));
const out=path.join(os.tmpdir(),'audit-test.xlsx');fs.writeFileSync(out,buf);console.log('audit-xlsx PASS',out,buf.length+' bytes');
