/* Audit .xlsx builder (coloured). Pure, no DOM, no libraries. Takes the audit CSV text from csv-audit.js so the two never disagree.
   Rule: hours under contract/target = red, on target or over = green. Used by index.html and tests\audit-xlsx.test.cjs */
(function(root){
'use strict';
function parseCsv(s){var rows=[],r=[],v='',q=false;s=s.replace(/^﻿/,'');
  for(var i=0;i<s.length;i++){var ch=s[i];
    if(q){if(ch==='"'){if(s[i+1]==='"'){v+='"';i++}else q=false}else v+=ch}
    else if(ch==='"')q=true;else if(ch===','){r.push(v);v=''}else if(ch==='\r'){}
    else if(ch==='\n'){r.push(v);rows.push(r);r=[];v=''}else v+=ch}
  if(v!==''||r.length){r.push(v);rows.push(r)}return rows}
var NUM=/^-?\d+\.\d$/;
// style ids (see STYLES): 0 plain, 1 bold, 2 header, 3 num, 4 green num, 5 red num, 6 green text, 7 red text, 8 bold num
function colourRows(rows,K,kind){
  var mult=kind==='8w'?K.WEEKS:(kind==='wk'?1:0),W=K.WEEKLY,out=[],sect='',hdr=false;
  var tg=[null,W.P1,W.U,W.P3,W.P4,null,K.CONTRACT];
  rows.forEach(function(r){
    var first=r[0]||'',cells=r.map(function(x){return NUM.test(x)?{v:parseFloat(x),n:1,s:3}:{v:x,s:0}});
    if(/^[A-Z][A-Z ]+(\(|$)/.test(first)&&r.length===1){sect=first;hdr=true;cells[0].s=1;out.push(cells);return}
    if(sect.indexOf('WEEKLY')===0){
      if(hdr){hdr=false;cells.forEach(function(c){c.s=2});out.push(cells);return}
      var isTot=first==='Total',isTarget=first==='Target',isDiff=first==='Difference';
      if(isTot||isTarget||isDiff)cells[0].s=1;
      var full=/^\d{4}-/.test(first)&&parseFloat(r[8])===7;
      for(var i=1;i<=6;i++){var c=cells[i];if(!c||!c.n)continue;
        if(full&&tg[i]!=null)c.s=c.v>=tg[i]-0.049?4:5;
        else if(isTot&&mult&&tg[i]!=null)c.s=c.v>=tg[i]*mult-0.049?4:5;
        else if(isDiff)c.s=c.v>=-0.049?4:5;
        else if(isTot||isTarget)c.s=8}
      if(full){var st=r[10];if(cells[9]&&cells[9].n)cells[9].s=st==='Short'?5:4;if(cells[10])cells[10].s=st==='Short'?7:6}
      out.push(cells);return}
    if(/^(WHERE|DAILY)/.test(sect)&&hdr){hdr=false;cells.forEach(function(c){c.s=2});out.push(cells);return}
    if(first==='Live Crewing audit export')cells[0].s=1;
    out.push(cells)});
  return out}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function col(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
function sheetXml(cr){
  var w=0;cr.forEach(function(r){if(r.length>w)w=r.length});
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="30" customWidth="1"/>'+(w>1?'<col min="2" max="'+w+'" width="17" customWidth="1"/>':'')+'</cols><sheetData>';
  cr.forEach(function(r,ri){x+='<row r="'+(ri+1)+'">';
    r.forEach(function(c,ci){if(c.v===''&&!c.s)return;var ref=col(ci)+(ri+1);
      if(c.n)x+='<c r="'+ref+'" s="'+c.s+'"><v>'+c.v+'</v></c>';
      else x+='<c r="'+ref+'" s="'+c.s+'" t="inlineStr"><is><t xml:space="preserve">'+esc(c.v)+'</t></is></c>'});
    x+='</row>'});
  return x+'</sheetData></worksheet>'}
var STYLES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>'
+'<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
+'<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF63BE7B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8696B"/><bgColor indexed="64"/></patternFill></fill></fills>'
+'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
+'<cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
+'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
+'<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs>'
+'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
var CT_NS='http://schemas.openxmlformats.org/package/2006/content-types';
var FILES=function(sheet){return [
 ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="'+CT_NS+'"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
 ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Audit" sheetId="1" r:id="rId1"/></sheets></workbook>'],
 ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
 ['xl/styles.xml',STYLES],['xl/worksheets/sheet1.xml',sheet]]};
var T=null;function crc(b){if(!T){T=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0}}var c2=0xFFFFFFFF;for(var i=0;i<b.length;i++)c2=T[(c2^b[i])&255]^(c2>>>8);return (c2^0xFFFFFFFF)>>>0}
function zip(files){var enc=new TextEncoder(),parts=[],cd=[],off=0;
  function u16(v){return [v&255,(v>>>8)&255]}function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]}
  files.forEach(function(f){var nm=enc.encode(f[0]),d=enc.encode(f[1]),c=crc(d);
    var lh=[].concat(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(c),u32(d.length),u32(d.length),u16(nm.length),u16(0));
    parts.push(new Uint8Array(lh),nm,d);
    cd.push([].concat(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(c),u32(d.length),u32(d.length),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off)),nm);
    off+=lh.length+nm.length+d.length});
  var cdLen=0,cdParts=[];cd.forEach(function(x){var a=x instanceof Uint8Array?x:new Uint8Array(x);cdParts.push(a);cdLen+=a.length});
  var eocd=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdLen),u32(off),u16(0)));
  var all=parts.concat(cdParts,[eocd]),n=0;all.forEach(function(a){n+=a.length});var out=new Uint8Array(n),p=0;all.forEach(function(a){out.set(a,p);p+=a.length});return out}
function buildAuditXLSX(csv,K,kind){var rows=colourRows(parseCsv(csv),K,kind);return zip(FILES(sheetXml(rows)))}
var api={buildAuditXLSX:buildAuditXLSX,parseCsv:parseCsv,colourRows:colourRows,zip:zip,crc:crc};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuditXLSX=api;
})(typeof self!=='undefined'?self:this);
