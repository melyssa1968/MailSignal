export type Campaign = { id:string; name:string; subject:string; body:string; status:string; created_at:number; recipients:number; sent:number; opens:number; unique_opens:number; automated:number };
export type SignalEvent = { id:string; email:string; campaign_name:string; campaign_id:string; kind:string; received_at:number };
export type Snapshot = { campaigns:Campaign[]; activity:SignalEvent[]; chart:{day:string; opens:number; unique_opens:number}[]; totals:{recipients:number;sent:number;opens:number;unique_opens:number;automated:number}; publicReady:boolean; refreshedAt:number };
export function classifyRequest(ua:string, purpose='') {
 if (/prefetch|prerender/i.test(purpose)||/bot|crawler|spider|scanner|prefetch|headless|barracuda|proofpoint|mimecast|curl|wget|python|node-fetch|undici/i.test(ua)) return 'automated';
 if (/GoogleImageProxy/i.test(ua)) return 'google_proxy';
 return /Mozilla|AppleWebKit|Outlook|Thunderbird/i.test(ua)?'unverified':'unknown_client';
}
export function escapeHtml(s:string) { return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function recipientList(raw:string) {
 const emails = [...new Set(raw.split(/[\s,;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean))];
 if (!emails.length || emails.length>100) throw new Error('Enter 1–100 email addresses.');
 if (emails.some(s=>s.length>254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s))) throw new Error('Check the recipient email addresses.');
 return emails;
}
export function csvCell(value:unknown) { let s=String(value??''); if (/^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"'; }
export function agentInsights(s:Snapshot) {
 const {sent,opens,unique_opens,automated}=s.totals;
 const best=[...s.campaigns].filter(c=>c.sent>=5).sort((a,b)=>b.unique_opens/b.sent-a.unique_opens/a.sent)[0];
 return [
 best ? {title:best.name+' leads on observed engagement', text:Math.round(best.unique_opens/best.sent*100)+'% of its '+best.sent+' sent emails registered an image load in this period. Compare replies before expanding the campaign.',type:'performance'} : {title:sent?'Your signals are starting to arrive':'Ready for your first campaign',text:sent?unique_opens+' of '+sent+' sent emails registered a load in this period. A missing load does not prove an email went unread.':'Create a campaign, enable the public pixel endpoint, then send from your Gmail account.',type:'performance'},
 {title:automated?'Some requests look automated':'Read the signal in context',text:automated?automated+' likely automated requests are excluded from observed opens. Other proxies and privacy preloads can still appear in your counts.':'Image loads are an engagement signal, not proof someone read your message. Gmail caching can hide repeat opens.',type:'quality'},
 {title:opens>unique_opens?'Repeat image loads detected':'Your data stays focused',text:opens>unique_opens?(opens-unique_opens)+' additional image loads followed first loads in this period. These may include repeat views, forwarding, or privacy services.':'The agent records the time and request category. It does not collect recipient IP addresses or infer locations.',type:'context'}
 ];
}
