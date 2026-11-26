/* Server-bound Book Off approval. No locally generated booking challenges. */
(function(root){
  'use strict';
  const encode = a => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const decode = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  function options(p,registration){
    const result={...p,challenge:decode(p.challenge)};
    if(registration)result.user={...p.user,id:decode(p.user.id)};
    for(const k of ['allowCredentials','excludeCredentials'])if(p[k])result[k]=p[k].map(c=>({...c,id:decode(c.id)}));
    return result;
  }
  function response(c){
    if(!c)throw Error('Verification not completed');
    const r={clientDataJSON:encode(c.response.clientDataJSON)};
    for(const k of ['authenticatorData','signature','attestationObject'])if(c.response[k])r[k]=encode(c.response[k]);
    if(c.response.userHandle)r.userHandle=encode(c.response.userHandle);
    if(c.response.getTransports)r.transports=c.response.getTransports();
    return {id:c.id,rawId:encode(c.rawId),type:c.type,response:r,clientExtensionResults:c.getClientExtensionResults?.()||{}};
  }
  function create({url,key,storage,fetch:send=root.fetch.bind(root),credentials=root.navigator?.credentials,verify}){
    let busy=false;
    async function call(path,body,owner){
      const r=await send(url+path,{
        method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Relay-Key':key,...(owner?{'X-Owner-Enrollment':owner}:{})},
        body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),cache:'no-store',
      });
      const j=await r.json();
      if(!r.ok||!j.ok){const error=Error(j.error||'Relay rejected request');error.status=r.status;throw error}
      return j;
    }
    async function approve(b,{probe=false}={}){
      const j=await call('/auth/book-off/options',b);
      try{
        const c=await verify(signal=>credentials.get({signal,publicKey:options(j.publicKey,false)}));
        if(!c){await call('/auth/book-off/cancel',{approvalId:j.approvalId}).catch(()=>{});return null}
        const approval={id:j.approvalId,response:response(c)};
        if(probe)return call('/auth/book-off/probe',{...b,approval});
        return approval;
      }catch(e){await call('/auth/book-off/cancel',{approvalId:j.approvalId}).catch(()=>{});throw e}
    }
    async function submit(text){
      if(busy)return {ok:false,state:'busy',message:'Another approval is in progress. Nothing else sent.'};
      busy=true;
      let record,identity;
      try{
        if(!root.isSecureContext||!credentials?.get)return {ok:false,state:'unsupported',message:'System verification unavailable. Nothing sent.'};
        const config=await call('/auth/config');
        if(config.mode!=='enforce')return {ok:false,state:'preparation',message:'Booking approval is not enabled yet. Setup/probe only; nothing sent.'};
        identity=encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
        const k='oncall-approved-book-off:'+identity;
        record=JSON.parse(storage.getItem(k)||'null');
        if(record)return {ok:false,state:'uncertain',recoverable:true,id:record.id,message:'Check FireWatch · This request has already been submitted; no automatic retry.'};
        const b={id:crypto.randomUUID(),text};
        const approval=await approve(b);
        if(!approval)return {ok:false,state:'cancelled',message:'Cancelled · Booking not sent.'};
        // Persist identity BEFORE POST. Lost replies are looked up by the same ID, never resent.
        record={id:b.id,at:Date.now()};
        storage.setItem(k,JSON.stringify(record));
        root.trackBookingResult?.({id:b.id,status:'queued',uncertain:true,deferRefresh:true});
        try{
          const receipt=await call('/req',{...b,approval});
          if(receipt.id!==b.id){record.id=receipt.id;storage.setItem(k,JSON.stringify(record))}
          root.trackBookingResult?.({...receipt,replacesId:b.id});
          return {...receipt,state:receipt.dup?'existing':'queued',message:receipt.dup?'Existing request · See Booking results. Nothing sent again.':'Sent to relay · Waiting for FireWatch'};
        }catch{
          root.trackBookingResult?.({id:b.id,uncertain:true});
          return {ok:false,state:'uncertain',id:b.id,message:'Check FireWatch · Submission outcome uncertain; not retried automatically.'};
        }
      }catch(e){
        return {ok:false,state:'rejected',message:'Booking not sent · '+(e?.name==='NotAllowedError'?'Verification cancelled or not completed.':e.message)};
      }finally{busy=false}
    }
    async function enrol(owner){
      const j=await call('/auth/register/options',{},owner);
      const c=await credentials.create({publicKey:options(j.publicKey,true)});
      return call('/auth/register/verify',{response:response(c)},owner);
    }
    async function probe(){
      // Intentionally fake dates; this endpoint can NEVER enter the booking queue.
      const b={id:crypto.randomUUID(),text:'Passkey probe only\n#BOOK [{"from":"2099-01-05T18:00","to":"2099-01-06T06:00"}]'};
      return approve(b,{probe:true});
    }
    async function reconcile(text){
      if(busy)return {ok:false,state:'busy',message:'Another approval is in progress.'};
      busy=true;
      try{
        const hash=encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),k='oncall-approved-book-off:'+hash;
        const record=JSON.parse(storage.getItem(k)||'null');
        if(!record)return {ok:false,message:'No saved attempt to reconcile.'};
        try{
          const status=await call('/status?id='+encodeURIComponent(record.id));
          root.trackBookingResult?.(status);
          return {ok:false,message:'Relay has this request. Check Booking results and FireWatch; do not resend.'};
        }catch(e){if(e.status!==404)throw e}
        if(Date.now()-record.at<180000)return {ok:false,message:'Wait at least three minutes after the attempt, then check again. Nothing sent.'};
        const b={id:crypto.randomUUID(),text};
        const proof=await approve(b,{probe:true});
        if(!proof?.verified||proof.queued!==false)return {ok:false,message:'Not verified. Retry protection retained.'};
        storage.removeItem(k);
        root.trackBookingResult?.({id:record.id,reconciled:true});
        return {ok:false,state:'reconciled',message:'Retry protection reset after owner verification. Nothing queued. Review the dates and send again for a fresh approval.'};
      }catch(e){return {ok:false,message:'Could not reconcile. Retry protection retained. '+e.message}}
      finally{busy=false}
    }
    return {submit,enrol,probe,reconcile};
  }
  root.BookOffSecurity={create,options,response};
})(globalThis);
