import * as InboxSDK from '@inboxsdk/core';
const ORIGIN='https://mail-signal.melyssa-plunkett.chatgpt.site';
let disconnected=false,sdkInstance=null;
const cleanupListeners=new Set();
function stopIntegration(){
 for(const cleanup of cleanupListeners){try{cleanup();}catch(e){console.warn('[MailSignal] Cleanup failed',e);}}cleanupListeners.clear();
 const sdk=sdkInstance;sdkInstance=null;if(sdk)try{sdk.destroy();}catch(e){console.warn('[MailSignal] Gmail integration cleanup failed',e);}
}
const disconnectListeners=new Set();
function markDisconnected(){
 if(disconnected)return;disconnected=true;
 globalThis.mailSignalStartup?.set('Refresh Gmail to reconnect MailSignal. Your draft stays in Gmail.');
 for(const fn of disconnectListeners){try{fn();}catch{}}
 stopIntegration();
 const existing=document.getElementById?.('mailsignal-reconnect');if(existing)return;
 const banner=document.createElement('div');banner.id='mailsignal-reconnect';banner.setAttribute('role','alert');
 Object.assign(banner.style,{position:'fixed',top:'12px',right:'24px',zIndex:'2147483647',maxWidth:'440px',padding:'16px',background:'#fff4d6',color:'#382e17',border:'1px solid #ba8b20',borderRadius:'8px',font:'14px/1.6 Arial'});
 const message=document.createElement('span');message.textContent='MailSignal needs to reconnect. Wait for Gmail to save your draft, then refresh this tab. New sends are not tracked until you refresh. ';
 const button=document.createElement('button');button.textContent='Refresh Gmail';button.addEventListener('click',()=>location.reload());banner.append(message,button);(document.body||document.documentElement).append(banner);
}
function healthy(){try{return !!chrome.runtime.id;}catch{return false;}}
globalThis.mailSignalDisconnect=markDisconnected;
if(globalThis.mailSignalContextLost)markDisconnected();
async function rpc(payload){
 try{if(disconnected||!healthy()){markDisconnected();throw new Error('Refresh Gmail to reconnect MailSignal.');}const r=await chrome.runtime.sendMessage({type:'mailsignal',...payload});if(r?.error)throw new Error(r.error);return r;}
 catch(e){if(/context invalidated|extension.*invalid|receiving end does not exist/i.test(e.message)){markDisconnected();throw new Error('Refresh Gmail to reconnect MailSignal.');}throw e;}
}
if(typeof window!=='undefined'&&!disconnected){
 const check=()=>{if(!healthy())markDisconnected();};
 // Check before Gmail/SDK interaction handlers, not only on a slow timer.
 window.addEventListener('focus',check,true);document.addEventListener('visibilitychange',check,true);
 document.addEventListener('pointerdown',check,true);document.addEventListener('keydown',check,true);
 const healthTimer=setInterval(check,1000);
 const unload=()=>{disconnected=true;stopIntegration();};window.addEventListener('pagehide',unload,{once:true});
 cleanupListeners.add(()=>{clearInterval(healthTimer);window.removeEventListener('focus',check,true);document.removeEventListener('visibilitychange',check,true);document.removeEventListener('pointerdown',check,true);document.removeEventListener('keydown',check,true);window.removeEventListener('pagehide',unload);});
}
function outgoingLinks(html){const t=document.createElement('template');t.innerHTML=html;let bytes=0;return [...new Set([...t.content.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/^https?:\/\//i.test(h||'')&&h.length<=4000))].filter(h=>{bytes+=h.length;return bytes<=30000;}).slice(0,50);}
function trackLinks(html,links){if(!Array.isArray(links)||!links.length)return html;const map=new Map(links.map(l=>[l.original,l.url])),t=document.createElement('template');t.innerHTML=html;t.content.querySelectorAll('a[href]').forEach(a=>{const url=map.get(a.getAttribute('href'));if(url&&url.startsWith(ORIGIN+'/l/'))a.setAttribute('href',url);});return t.innerHTML;}

function notification(message){const el=document.createElement('div');el.textContent='MailSignal: '+message;el.setAttribute('role','status');Object.assign(el.style,{position:'fixed',right:'24px',bottom:'24px',maxWidth:'350px',padding:'16px',background:'#183c2e',color:'white',zIndex:'2147483647',font:'14px/1.6 Arial',borderRadius:'10px',boxShadow:'0 4px 20px #0003'});document.body.append(el);setTimeout(()=>el.remove(),10000);}
function stripOurPixels(html){const template=document.createElement('template');template.innerHTML=html;template.content.querySelectorAll('img').forEach(img=>{const raw=img.getAttribute('src')||'';try{const u=new URL(raw,ORIGIN);const original=u.hash.slice(1);if((u.origin===ORIGIN&&u.pathname.startsWith('/p/'))||original.startsWith(ORIGIN+'/p/'))img.remove();}catch{}});return template.innerHTML;}
function recipientAddresses(compose){
 const root=compose.getElement();
 const recipients=[];
 for(const [field,method] of [['to','getToRecipients'],['cc','getCcRecipients'],['bcc','getBccRecipients']]){
  const contacts=compose[method]();
  if(contacts.length){recipients.push(...contacts.map(contact=>contact.emailAddress));continue;}
  // Collapsed replies can keep addresses in form fields without visible chips.
  // Stay inside this compose's recipient fields, never the thread or quoted body.
  const nodes=root.querySelectorAll(`input[name="${field}"], textarea[name="${field}"], [name="${field}"] [role="option"][data-hovercard-id]`);
  for(const node of nodes){
   if(node.closest('[contenteditable="true"], [g_editable="true"], .gmail_quote'))continue;
   const value=(node.getAttribute('data-hovercard-id')||node.value||'').trim();
   if(!value)continue;
   // Split lists outside quoted display names and <address> brackets.
   const parts=value.match(/(?:"(?:[^"\\]|\\.)*"|<[^>]*>|[^,;"<>])+/g)||[];
   for(const part of parts)recipients.push(part.match(/<([^<>]+)>\s*$/)?.[1]||part.trim());
  }
 }
 const normalized=recipients.map(address=>typeof address==='string'?address.trim().toLowerCase():'');
 if(normalized.some(address=>! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)))throw new Error('MailSignal could not read the recipients. Expand the To/Cc fields before sending your next email.');
 return [...new Set(normalized)];
}
function composeDetails(compose){
 return {recipients:recipientAddresses(compose),sender:compose.getFromContact().emailAddress,subject:compose.getSubject()};
}
(async()=>{
 globalThis.mailSignalStartup?.set('Reading saved settings');
 const cfg=await rpc({action:'config'});if(!cfg.configured){globalThis.mailSignalStartup?.set('Setup incomplete: save your key and App ID in this Chrome profile.');notification('Finish the extension setup to track emails. Gmail sending is unchanged.');return;}
 globalThis.mailSignalStartup?.set('Waiting for InboxSDK to connect to Gmail');
 const sdk=sdkInstance=await InboxSDK.load(2,cfg.appId,{eventTracking:false});
 if(disconnected||!healthy()){markDisconnected();stopIntegration();return;}
  globalThis.mailSignalStartup?.set('Connected to Gmail. Open a new Compose window.');
 // Best-effort correlation when Gmail renders tracked images in this browser.
 // The remote image can load before DOM observation; server correlation retains
 // overlapping events as uncertain instead of claiming recipient engagement.
 const seenViews=new Map();
 const scanViews=()=>{
  if(disconnected)return;
  const ids=new Set();
  document.querySelectorAll('img[src]').forEach(img=>{
   let value=img.getAttribute('src')||'';try{value=decodeURIComponent(value);}catch{}
   const start=value.indexOf(ORIGIN+'/p/');if(start<0)return;
   const id=value.slice(start+ORIGIN.length+3).match(/^([a-f0-9-]{36})(?:\.gif)?(?:[?#&]|$)/)?.[1];
   if(id&&Date.now()-(seenViews.get(id)||0)>60000){ids.add(id);seenViews.set(id,Date.now());}
  });
  if(ids.size)rpc({action:'self_view',ids:[...ids].slice(0,50)}).catch(()=>{});
 };
 let scanTimer;
 const observer=new MutationObserver(()=>{if(disconnected)return;clearTimeout(scanTimer);scanTimer=setTimeout(scanViews,100);});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
 cleanupListeners.add(()=>{observer.disconnect();clearTimeout(scanTimer);});
 scanViews();
 const observeClick=event=>{
  if(disconnected)return;
  let href=event.target?.closest?.('a[href]')?.getAttribute('href');if(!href)return;
  try{let url=new URL(href,location.href);if(url.hostname==='www.google.com'&&url.pathname==='/url')url=new URL(url.searchParams.get('q')||url.searchParams.get('url')||'');
   if(url.origin!==ORIGIN)return;const id=url.pathname.match(/^\/l\/([a-f0-9-]{36})$/)?.[1];if(id)rpc({action:'self_link',id}).catch(()=>{});
  }catch{}
 };
 document.addEventListener('click',observeClick,true);cleanupListeners.add(()=>document.removeEventListener('click',observeClick,true));
 const unregisterCompose=sdk.Compose.registerComposeViewHandler(compose=>{
  if(disconnected)return;
  globalThis.mailSignalStartup?.set('Compose detected; adding tracking control');
  let enabled=true,trackId=null,requestId=crypto.randomUUID(),fingerprint='',inserted=false,outcome='Tracking was not ready when this email was sent.';
  const report=message=>{globalThis.mailSignalStartup?.set(message);notification(message);rpc({action:'outcome',message}).catch(()=>{});};
  const bar=compose.addComposeNotice({orderHint:-100});const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;const text=document.createElement('span');text.textContent=' Track this email · connecting…';label.append(checkbox,text);Object.assign(label.style,{font:'14px Arial',display:'flex',gap:'8px',alignItems:'center',padding:'8px 12px',color:'#183c2e',background:'#eef7f0',border:'1px solid #bfd6c5',borderRadius:'6px',margin:'6px 0'});bar.el.append(label);globalThis.mailSignalStartup?.set('Tracking control created above the message');
  const visibilityTimer=setTimeout(()=>{if(compose.destroyed)return;const rect=checkbox.getBoundingClientRect();const visible=checkbox.isConnected&&rect.width>0&&rect.height>0&&getComputedStyle(checkbox).visibility!=='hidden';globalThis.mailSignalStartup?.set(visible?'Tracking checkbox is displayed above the message':'Compose found, but tracking control has no visible layout');},1000);
  const disconnect=()=>{clearTimeout(visibilityTimer);checkbox.checked=false;checkbox.disabled=true;enabled=false;text.textContent='Tracking disconnected · refresh Gmail';};disconnectListeners.add(disconnect);if(disconnected)disconnect();
  compose.on('destroy',()=>{clearTimeout(visibilityTimer);disconnectListeners.delete(disconnect);});
  checkbox.addEventListener('change',()=>{enabled=checkbox.checked;text.textContent=enabled?'Track this email · domain exclusions apply':'Tracking off';});
  let sendDetails=null;
  // presending runs before Gmail clears/collapses a reply's recipient controls.
  // Capture afresh for every Send, including retries, rather than reuse a draft cache.
  compose.on('presending',()=>{sendDetails=null;try{sendDetails={details:composeDetails(compose),at:Date.now()};}catch{}});
  compose.on('sendCanceled',()=>{sendDetails=null;trackId=null;inserted=false;});
  async function register(){
   await compose.getDraftID();if(compose.destroyed||disconnected)return;
   compose.registerRequestModifier(async params=>{
    trackId=null;inserted=false;
    if(params.isPlainText){outcome='Not tracked: plain-text email.';return params;}
    // Modify only the outgoing send payload. Never load a pixel in a saved draft.
    const body=stripOurPixels(params.body);
    if(!enabled){outcome=disconnected?'Email sent without tracking. Refresh Gmail to reconnect MailSignal.':'Not tracked: tracking was switched off.';return {body};}
    try{
     const {recipients,sender,subject}=sendDetails&&Date.now()-sendDetails.at<30000&&sendDetails.details.recipients.length?sendDetails.details:composeDetails(compose);
     if(!recipients.length)throw new Error('MailSignal could not read the reply recipients. Expand the To/Cc fields before sending your next email.');
     if(recipients.length>100)throw new Error('Tracking supports up to 100 recipients per email.');
     const fp=JSON.stringify([recipients,sender,subject,outgoingLinks(body)]);if(fingerprint!==fp){requestId=crypto.randomUUID();fingerprint=fp;}
     const result=await rpc({action:'prepare',requestId,recipients,sender,subject,links:outgoingLinks(body)});
     if(disconnected||!healthy()){markDisconnected();throw new Error('Refresh Gmail to reconnect MailSignal.');}
     if(result.skip){outcome='Not tracked: '+result.reason;text.textContent=outcome;return {body};}
     trackId=result.id;inserted=true;outcome='Pixel added; waiting for Gmail to confirm sending.';
     return {body:trackLinks(body,result.links)+'<img src="'+result.pixelUrl+'" width="1" height="1" alt="" style="width:1px;height:1px;border:0" />'};
    }catch(e){outcome='Not tracked: '+e.message;return {body};}
   });
   text.textContent='Track this email · domain exclusions apply';
  }
  register().catch(()=>{if(disconnected)return;outcome='Not tracked: Gmail tracking hook could not be registered.';checkbox.checked=false;checkbox.disabled=true;enabled=false;text.textContent='Tracking unavailable for this draft';});
  compose.on('sent',()=>{sendDetails=null;if(!inserted||!trackId){report(outcome);return;}rpc({action:'sent',id:trackId}).then(r=>{report(r.queued?'Email sent. Tracking confirmation is pending; retrying automatically.':r.skip?'Email sent; tracking skipped because recipients are now excluded.':'Email tracking registered. Image loads do not confirm who read it.');}).catch(()=>report('Email sent, but tracking confirmation failed.'));});
 });
 if(typeof unregisterCompose==='function')cleanupListeners.add(unregisterCompose);
})().catch(e=>{if(disconnected)return;globalThis.mailSignalStartup?.set('Startup failed: '+e.message);notification('Could not start: '+e.message);});
