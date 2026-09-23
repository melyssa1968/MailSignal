import { db,json,fail,hashKey,ApiError,jsonInput,publicReady } from '@/lib/server';
import { settingsFor } from '@/lib/preferences';
import { isExcluded } from '@/lib/domains';
import { eligibleRecipients } from '@/lib/signals';
import { recipientList } from '@/lib/tracking';
export async function POST(r:Request){try{
 const token=r.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||token.length>200)throw new ApiError(401,'Connect the extension from MailSignal settings.');
 const account=await db().prepare('SELECT owner FROM preferences WHERE extension_key_hash=?').bind(await hashKey(token)).first<{owner:string}>();if(!account)throw new ApiError(401,'The extension key was revoked or replaced.');
 const uid=account.owner,i=await jsonInput(r),s=await settingsFor(uid);
 await db().prepare('UPDATE preferences SET extension_seen_at=? WHERE owner=?').bind(Date.now(),uid).run();
 if(i.action==='check')return json({...s,publicReady:publicReady()});
 if(i.action==='self_view'){
  const ids=Array.isArray(i.ids)?[...new Set(i.ids)]:[];
  if(!ids.length||ids.length>50||ids.some(v=>typeof v!=='string'||!/^[a-f0-9-]{36}$/.test(v)))throw new ApiError(400,'Invalid view metadata.');
  const now=Date.now();
  for(const id of ids)await db().prepare(`INSERT INTO sender_views(id,message_id,observed_at) SELECT ?,m.id,? FROM messages m JOIN campaigns c ON c.id=m.campaign_id WHERE m.id=? AND c.owner=? AND m.sent_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sender_views v WHERE v.message_id=m.id AND v.observed_at>?)`).bind(crypto.randomUUID(),now,id,uid,now-5000).run();
  return json({ok:true});
 }
 if(i.action==='prepare'){
  if(!publicReady())throw new ApiError(503,'The tracking endpoint is not active.');
  if(!Array.isArray(i.recipients)||i.recipients.some((x:unknown)=>typeof x!=='string'))throw new ApiError(400,'Recipient metadata is invalid.');
  // Never claim a particular recipient opened a message delivered to several people.
  if(!i.recipients.length)throw new ApiError(400,'MailSignal could not read the recipients. Update the extension and expand the To/Cc fields before sending your next email.');
  if(i.recipients.length>100)throw new ApiError(400,'Tracking supports up to 100 recipients per email.');
  let emails:string[];try{emails=recipientList(i.recipients.join(','));}catch{throw new ApiError(400,'The recipient address is invalid.');}
  const sender=typeof i.sender==='string'?i.sender.trim().toLowerCase():'';
  const eligible=emails.filter(e=>e!==sender&&!isExcluded(e,s.excludedDomains));
  if(!eligible.length)return json({skip:true,reason:'All recipients are excluded or match the sender.'});
  const subject=String(i.subject??'').trim();if(subject.length>500||/[\r\n]/.test(subject))throw new ApiError(400,'Invalid email subject.');
  const draftId=String(i.requestId??'');if(!/^[a-f0-9-]{36}$/.test(draftId))throw new ApiError(400,'Invalid tracking request.');
  const existing=await db().prepare('SELECT m.id,m.email,m.recipients_json,c.subject FROM messages m JOIN campaigns c ON m.campaign_id=c.id WHERE c.id=? AND c.owner=? AND c.source=?').bind(draftId,uid,'gmail').first<any>();
  if(existing){if(existing.recipients_json!==JSON.stringify(emails)||existing.subject!==subject)throw new ApiError(409,'Email details changed. Try sending again.');return json({id:existing.id,pixelUrl:new URL('/p/'+existing.id+'.gif',r.url).href});}
  const count=await db().prepare('SELECT COUNT(*) AS n FROM campaigns WHERE owner=? AND source=? AND created_at>?').bind(uid,'gmail',Date.now()-86400000).first<{n:number}>();if((count?.n??0)>=200)throw new ApiError(429,'Daily personal-email tracking limit reached. Turn tracking off to send normally.');
  const id=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO campaigns(id,owner,name,subject,body,status,source,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(draftId,uid,subject||'(No subject)',subject,'','active','gmail',Date.now()),db().prepare('INSERT INTO messages(id,campaign_id,email,recipients_json,sender) VALUES(?,?,?,?,?)').bind(id,draftId,eligible[0],JSON.stringify(emails),sender)]);
  return json({id,pixelUrl:new URL('/p/'+id+'.gif',r.url).href},201);
 }
 if(i.action==='sent'){
  const m=await db().prepare('SELECT m.id,m.email,m.recipients_json,m.sender,m.sent_at FROM messages m JOIN campaigns c ON c.id=m.campaign_id WHERE m.id=? AND c.owner=? AND c.source=?').bind(String(i.id),uid,'gmail').first<any>();if(!m)throw new ApiError(404,'Tracked email not found.');
  if(!eligibleRecipients(m,s.excludedDomains).length)return json({skip:true});
  if(!m.sent_at)await db().prepare('UPDATE messages SET sent_at=? WHERE id=? AND sent_at IS NULL').bind(Date.now(),m.id).run();
  return json({confirmed:true});
 }
 throw new ApiError(400,'Unsupported Gmail integration action.');
}catch(e){return fail(e);}}
