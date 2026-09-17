const key=document.getElementById('key'),appId=document.getElementById('appid'),status=document.getElementById('status');
chrome.storage.local.get(['key','appId']).then(c=>{key.value=c.key||'';appId.value=c.appId||'';});
document.getElementById('save').addEventListener('click',async()=>{if(!key.value.trim()||!appId.value.trim().startsWith('sdk_')){status.textContent='Enter your connection key and a registered InboxSDK App ID (beginning sdk_).';return;}await chrome.storage.local.set({key:key.value.trim(),appId:appId.value.trim()});const r=await chrome.runtime.sendMessage({type:'mailsignal',action:'check'});status.textContent=r?.error?r.error:('Dashboard connection verified. Refresh Gmail. '+(r.publicReady?'Public pixel endpoint enabled.':'Pixel endpoint still needs activation.'));});
const gmailStatus=document.getElementById('gmail-status');
document.getElementById('check-gmail').addEventListener('click',async()=>{
 gmailStatus.textContent='Checking open Gmail tabs…';
 try{
  const tabs=await chrome.tabs.query({url:'https://mail.google.com/*'});
  if(!tabs.length){gmailStatus.textContent='No Gmail tab found in this Chrome profile. Open work Gmail here, then check again.';return;}
  const results=await Promise.all(tabs.map(async(tab,index)=>{
   try{const r=await chrome.tabs.sendMessage(tab.id,{type:'mailsignal-status'},{frameId:0});return 'Gmail tab '+(index+1)+': '+r.stage+' ('+r.seconds+' seconds; extension '+r.version+').';}
   catch{return 'Gmail tab '+(index+1)+': Extension not responding. Refresh this Gmail tab after reloading MailSignal in chrome://extensions.';}
  }));
  gmailStatus.textContent=results.join('\n');gmailStatus.style.whiteSpace='pre-line';
 }catch{gmailStatus.textContent='Could not check Gmail. Check that MailSignal has access to mail.google.com in chrome://extensions.';}
});

const latest=document.getElementById('last-outcome');
function showOutcome(v){latest.textContent=v?new Date(v.at).toLocaleString()+': '+v.message:'No send result recorded by this extension yet.';}
chrome.storage.local.get('lastOutcome').then(v=>showOutcome(v.lastOutcome));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.lastOutcome)showOutcome(changes.lastOutcome.newValue);});
