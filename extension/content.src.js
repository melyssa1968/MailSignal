import * as InboxSDK from '@inboxsdk/core';
const ORIGIN='https://mail-signal.melyssa-plunkett.chatgpt.site';
function rpc(payload){return chrome.runtime.sendMessage({type:'mailsignal',...payload}).then(r=>{if(r?.error)throw new Error(r.error);return r;});}
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
 const sdk=await InboxSDK.load(2,cfg.appId,{eventTracking:false});
  globalThis.mailSignalStartup?.set('Connected to Gmail. Open a new Compose window.');
 // Best-effort correlation when Gmail renders tracked images in this browser.
 // The remote image can load before DOM observation; server correlation retains
 // overlapping events as uncertain instead of claiming recipient engagement.
 const seenViews=new Map();
 const scanViews=()=>{
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
 new MutationObserver(()=>{clearTimeout(scanTimer);scanTimer=setTimeout(scanViews,100);}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
 scanViews();
 sdk.Compose.registerComposeViewHandler(compose=>{
  globalThis.mailSignalStartup?.set('Compose detected; adding tracking control');
  let enabled=true,trackId=null,requestId=crypto.randomUUID(),fingerprint='',inserted=false,outcome='Tracking was not ready when this email was sent.';
  const report=message=>{globalThis.mailSignalStartup?.set(message);notification(message);rpc({action:'outcome',message}).catch(()=>{});};
  const bar=compose.addComposeNotice({orderHint:-100});const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;const text=document.createElement('span');text.textContent=' Track this email · connecting…';label.append(checkbox,text);Object.assign(label.style,{font:'14px Arial',display:'flex',gap:'8px',alignItems:'center',padding:'8px 12px',color:'#183c2e',background:'#eef7f0',border:'1px solid #bfd6c5',borderRadius:'6px',margin:'6px 0'});bar.el.append(label);globalThis.mailSignalStartup?.set('Tracking control created above the message');
  const visibilityTimer=setTimeout(()=>{if(compose.destroyed)return;const rect=checkbox.getBoundingClientRect();const visible=checkbox.isConnected&&rect.width>0&&rect.height>0&&getComputedStyle(checkbox).visibility!=='hidden';globalThis.mailSignalStartup?.set(visible?'Tracking checkbox is displayed above the message':'Compose found, but tracking control has no visible layout');},1000);
  compose.on('destroy',()=>clearTimeout(visibilityTimer));
  checkbox.addEventListener('change',()=>{enabled=checkbox.checked;text.textContent=enabled?'Track this email · domain exclusions apply':'Tracking off';});
  let sendDetails=null;
  // presending runs before Gmail clears/collapses a reply's recipient controls.
  // Capture afresh for every Send, including retries, rather than reuse a draft cache.
  compose.on('presending',()=>{sendDetails=null;try{sendDetails={details:composeDetails(compose),at:Date.now()};}catch{}});
  compose.on('sendCanceled',()=>{sendDetails=null;trackId=null;inserted=false;});
  async function register(){
   await compose.getDraftID();if(compose.destroyed)return;
   compose.registerRequestModifier(async params=>{
    trackId=null;inserted=false;
    if(params.isPlainText){outcome='Not tracked: plain-text email.';return params;}
    // Modify only the outgoing send payload. Never load a pixel in a saved draft.
    const body=stripOurPixels(params.body);
    if(!enabled){outcome='Not tracked: tracking was switched off.';return {body};}
    try{
     const {recipients,sender,subject}=sendDetails&&Date.now()-sendDetails.at<30000&&sendDetails.details.recipients.length?sendDetails.details:composeDetails(compose);
     if(!recipients.length)throw new Error('MailSignal could not read the reply recipients. Expand the To/Cc fields before sending your next email.');
     if(recipients.length>100)throw new Error('Tracking supports up to 100 recipients per email.');
     const fp=JSON.stringify([recipients,sender,subject]);if(fingerprint!==fp){requestId=crypto.randomUUID();fingerprint=fp;}
     const result=await rpc({action:'prepare',requestId,recipients,sender,subject});
     if(result.skip){outcome='Not tracked: '+result.reason;text.textContent=outcome;return {body};}
     trackId=result.id;inserted=true;outcome='Pixel added; waiting for Gmail to confirm sending.';
     return {body:body+'<img src="'+result.pixelUrl+'" width="1" height="1" alt="" style="width:1px;height:1px;border:0" />'};
    }catch(e){outcome='Not tracked: '+e.message;return {body};}
   });
   text.textContent='Track this email · domain exclusions apply';
  }
  register().catch(()=>{outcome='Not tracked: Gmail tracking hook could not be registered.';checkbox.checked=false;checkbox.disabled=true;enabled=false;text.textContent='Tracking unavailable for this draft';});
  compose.on('sent',()=>{sendDetails=null;if(!inserted||!trackId){report(outcome);return;}rpc({action:'sent',id:trackId}).then(r=>{report(r.queued?'Email sent. Tracking confirmation is pending; retrying automatically.':r.skip?'Email sent; tracking skipped because recipients are now excluded.':'Email tracking registered. Image loads do not confirm who read it.');}).catch(()=>report('Email sent, but tracking confirmation failed.'));});
 });
})().catch(e=>{globalThis.mailSignalStartup?.set('Startup failed: '+e.message);notification('Could not start: '+e.message);});
