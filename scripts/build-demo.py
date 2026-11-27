from pathlib import Path
import re
import html
root=Path(__file__).resolve().parent.parent
def replace_once(text, old, new, count=1):
 if text.count(old)!=1: raise ValueError('Expected one occurrence: '+old[:100])
 return text.replace(old,new,1)
app=(root/'index.html').read_text(encoding='utf-8')
boot=(root/'demo-bootstrap.js').read_text(encoding='utf-8')
boot=replace_once(boot, "  if (new URLSearchParams(location.search).get('demo') !== '1') return;", "  // This generated page is exclusively for Demo mode.")
assert '</script' not in boot.lower()
csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"
app=replace_once(app,'<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">\n<script>'+boot+'</script>', 1)
app=re.sub(r'<link[^>]*>', '', app, flags=re.I)
app=replace_once(app,'url(startup-crewing.jpg)', 'none')
app=replace_once(app,"const ME_NAME='Paul Matthews'", "const ME_NAME='Alex Example'")
app=replace_once(app,"asOf:'2026-10-31',rate:14.3947,fwRate:14.40", "asOf:'2026-01-01',rate:12.34,fwRate:12.50")
app=replace_once(app,"const PAYSLIP={rate:14.3947,dist:5.31,asOf:'31 Oct 2026'},FW_RATE=14.40", "const PAYSLIP={rate:12.34,dist:4.56,asOf:'example'},FW_RATE=12.50")
app=replace_once(app,"async function relaySend(text){try{", "async function relaySend(text){if(window.__demoMode)return false;try{")
app=replace_once(app,"const supported='Notification' in window&&'serviceWorker' in navigator;", "const supported=false;")
app=replace_once(app,"if(!('Notification' in window)||Notification.permission", "if(window.__demoMode||!('Notification' in window)||Notification.permission")
app=replace_once(app,"if('serviceWorker' in navigator){", "if(!window.__demoMode&&'serviceWorker' in navigator){")
app=replace_once(app,"  const key=storedRelayKey();\n  if(!key){paint('Device not connected','Unavailable');return}", "  if(window.__demoMode){paint('Example connected','Example recent');return}\n  const key=storedRelayKey();\n  if(!key){paint('Device not connected','Unavailable');return}")
app=replace_once(app,"This sends your choice to be booked in FireWatch using your PIN shortcut. Nothing changes in FireWatch until the booking runs.","Demo only: review fictional times. No booking will be sent.")
app=replace_once(app,'Confirm and send</button>', 'Confirm demo</button>')
def inline(m):
 name=m.group(1); code=(root/name).read_text(encoding='utf-8')
 assert '</script' not in code.lower(),name
 if name=='events-page.js':
  code=replace_once(code,"  try { state.key = root.localStorage.getItem(KEY) || ''; } catch (e) {}", "  try { state.key = root.localStorage.getItem(KEY) || ''; } catch (e) {}\n  if (root.__demoMode) { state.key = 'example'; state.snap = root.__demoEvents; }")
  code=replace_once(code,'    if (!state.key || state.pending) return;', '    if (root.__demoMode || !state.key || state.pending) return;')
 return '<script>\n'+code+'\n</script>'
app=re.sub(r'<script src="([^"]+)"\s*></script>',inline,app)
assert not re.search(r'<script\s+src=',app,re.I)
assert 'fonts.googleapis.com' not in app
app=re.sub(r'(?m)^[ \t]+$', '', app)

wrapper='''<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live Crewing Demo</title><style>html,body{height:100%;margin:0;background:#0e1014;color:white;font:14px system-ui}.bar{height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 12px}a{color:white}iframe{width:100%;height:calc(100% - 42px);border:0}</style></head><body><div class="bar"><strong>Demo · fictional data</strong><a href="./index.html">Exit Demo</a></div><iframe title="Live Crewing Demo" sandbox="allow-scripts" srcdoc="'''+html.escape(app,quote=True)+'''"></iframe></body></html>'''
(root/'demo.html').write_text(wrapper,encoding='utf-8',newline='')
