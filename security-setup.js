(function(){
  const el=id=>document.getElementById(id),url='https://live-crewing-relay.paulm-crewing.workers.dev';
  let busy=false;
  async function run(kind){
    if(busy)return;
    busy=true;el('enrol').disabled=el('probe').disabled=true;
    try{
      if(!isSecureContext||!navigator.credentials?.get)throw Error('Open the HTTPS app in a supported browser.');
      const key=el('relay-key').value.trim();
      if(!key)throw Error('Enter the relay key.');
      const client=BookOffSecurity.create({url,key,storage:localStorage,verify:get=>get()});
      const token=el('owner-token').value;
      el('owner-token').value='';
      const result=kind==='enrol'?await client.enrol(token):await client.probe();
      el('result').textContent=kind==='enrol'?'Owner passkey enrolled. Now run the non-booking probe.':
        result?.verified&&result.queued===false?'Server verified the system prompt. Nothing queued.':'Probe not confirmed. Nothing queued.';
    }catch(e){el('result').textContent='Not completed: '+e.message}
    finally{busy=false;el('enrol').disabled=el('probe').disabled=false}
  }
  el('enrol').onclick=()=>run('enrol');el('probe').onclick=()=>run('probe');
})();
