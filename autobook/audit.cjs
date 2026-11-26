const fs = require('fs'), path = require('path');
const dir = () => process.env.AUDIT_DIR || 'C:\\Users\\paulm\\Documents\\Claude doc\\live-crewing-audit';
function ukStamp() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date()).map(x => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day + '_' + p.hour + p.minute;
}
function write(rec) {
  fs.mkdirSync(dir(), {recursive: true});
  const base = path.join(dir(), ukStamp() + '_' + (rec.dry ? 'DRY_' : '') + String(rec.id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40));
  fs.writeFileSync(base + '.json', JSON.stringify(rec, null, 1));
  const md = ['# ' + (rec.dry ? 'DRY RUN ' : '') + 'Booking ' + rec.id, '', 'Status: **' + rec.status + '**', '', 'Request text:', '```', rec.text || '', '```', '', 'Ranges: ' + JSON.stringify(rec.ranges || []), '', '## Steps'].concat((rec.steps || []).map(s => '- ' + s.at + ' ' + s.step + ': ' + s.result)).concat(['', '## Confirmation Required text', '```', (rec.confirmations || []).join('\n---\n'), '```', '', 'Read-back: ' + (rec.readback || 'n/a'), '', 'Report: ' + (rec.report || '')]).join('\n');
  fs.writeFileSync(base + '.md', md);
  return base;
}
module.exports = {write, dir, ukStamp};
