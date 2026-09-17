import '@inboxsdk/core/background';
const ORIGIN='https://mail-signal.melyssa-plunkett.chatgpt.site';
async function call(body){
 const {key}=await chrome.storage.local.get('key');if(!key)throw new Error('Set up MailSignal from the extension icon.');
 const r=await fetch(ORIGIN+'/api/gmail',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),credentials:'omit',signal:AbortSignal.timeout(8000)});
 if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('Tracking is temporarily unavailable.');
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Tracking request failed.');return data;
}
async function confirm(id){const name='pending:'+id;await chrome.storage.local.set({[name]:{id,at:Date.now()}});try{const result=await call({action:'sent',id});await chrome.storage.local.remove(name);return result;}catch{return {queued:true};}}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg?.type!=='mailsignal')return;
 const allowed=sender.url?.startsWith('https://mail.google.com/')||sender.url?.startsWith(chrome.runtime.getURL(''));
 if(!allowed){reply({error:'Unrecognized extension caller.'});return;}
 (async()=>{
  if(msg.action==='outcome'){await chrome.storage.local.set({lastOutcome:{message:String(msg.message).slice(0,350),at:Date.now()}});return {ok:true};}
  if(msg.action==='config'){const {appId,key}=await chrome.storage.local.get(['appId','key']);return {appId,configured:!!(appId&&key)};}
  if(msg.action==='sent'&&typeof msg.id==='string'&&/^[a-f0-9-]{36}$/.test(msg.id))return confirm(msg.id);
  if(msg.action==='check')return call({action:'check'});
  if(msg.action==='self_view')return call({action:'self_view',ids:msg.ids});
  if(msg.action==='prepare')return call({action:'prepare',requestId:msg.requestId,recipients:msg.recipients,sender:msg.sender,subject:msg.subject});
  throw new Error('Unknown request.');
 })().then(reply,e=>reply({error:e.message}));return true;
});
chrome.action.onClicked.addListener(()=>chrome.runtime.openOptionsPage());
chrome.alarms.create('retry-confirmations',{periodInMinutes:1});
chrome.alarms.onAlarm.addListener(async a=>{if(a.name!=='retry-confirmations')return;const all=await chrome.storage.local.get(null);for(const [k,v] of Object.entries(all)){if(!k.startsWith('pending:'))continue;if(Date.now()-v.at>86400000){await chrome.storage.local.remove(k);continue;}try{await call({action:'sent',id:v.id});await chrome.storage.local.remove(k);}catch{}}});
