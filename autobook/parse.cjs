function parseBook(text) {
  const m = /^#BOOK\s+(\[.*\])\s*$/m.exec(text || '');
  if (!m) return {error: 'no #BOOK line'};
  let a;
  try { a = JSON.parse(m[1]); } catch (e) { return {error: 'bad #BOOK json'}; }
  if (!Array.isArray(a) || !a.length || a.length > 20) return {error: 'bad #BOOK list'};
  const re = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/;
  for (const r of a) if (!r || !re.test(r.from) || !re.test(r.to) || r.to <= r.from) return {error: 'bad range ' + JSON.stringify(r)};
  return {ranges: a.map(r => ({from: r.from, to: r.to}))};
}
const isTest = t => /^\s*T4 TEST/.test(t || '');
function fmtFw(iso) { const [d, t] = iso.split('T'); const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y + ' ' + t; }
module.exports = {parseBook, isTest, fmtFw};
