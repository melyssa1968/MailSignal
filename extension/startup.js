// Runs before the SDK bundle. Cache identity while the Chrome context is valid.
(() => {
  const extensionId=chrome.runtime.id,extensionUrl=chrome.runtime.getURL(''),version=chrome.runtime.getManifest().version;
  let stage='Extension loaded; starting Gmail integration',changedAt=Date.now();
  globalThis.mailSignalStartup={set(value){stage=value;changedAt=Date.now();console.info('[MailSignal]',value);}};
  const healthy=()=>{try{return chrome.runtime.id===extensionId;}catch{return false;}};
  function contextLost(){
    globalThis.mailSignalContextLost=true;
    globalThis.mailSignalStartup.set('Refresh Gmail to reconnect MailSignal. Wait for your draft to save.');
    globalThis.mailSignalDisconnect?.();
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(!healthy()||sender.id!==extensionId||message?.type!=='mailsignal-status')return;
    reply({stage,seconds:Math.floor((Date.now()-changedAt)/1000),version});
  });
  function handleError(event){
    const error=event.error||event.reason;
    const message=String(error?.message||event.message||error||'');
    const ownError=event.filename?.startsWith(extensionUrl)||String(error?.stack||'').includes(extensionUrl);
    if(!ownError)return;
    if(!healthy()&&/extension context invalidated/i.test(message)){
      // This expected lifecycle error is handled with teardown and a visible notice.
      // Leave unrelated errors visible, including identical text in a healthy context.
      contextLost();event.preventDefault();event.stopImmediatePropagation();return;
    }
    globalThis.mailSignalStartup.set('Extension error: '+message);
  }
  window.addEventListener('error',handleError,true);
  window.addEventListener('unhandledrejection',handleError,true);
  console.info('[MailSignal]',stage);
})();
