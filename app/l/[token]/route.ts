import { db,publicReady } from '@/lib/server';
import { settingsFor } from '@/lib/preferences';
import { eligibleRecipients } from '@/lib/signals';
import { classifyRequest } from '@/lib/tracking';
import { requestSource } from '@/lib/request-source';
import { enrichEvent } from '@/lib/source-enrichment';
import { safeLink } from '@/lib/link-tracking';
import { after } from 'next/server';
async function resolve(request:Request,token:string,record:boolean) {
 if(!/^[a-f0-9-]{36}$/.test(token))return new Response('Link not found.',{status:404});
 const link=await db().prepare('SELECT l.id,l.url,m.id AS message_id,m.email,m.recipients_json,m.sender,m.sent_at,c.owner,c.status FROM tracked_links l JOIN messages m ON m.id=l.message_id JOIN campaigns c ON c.id=m.campaign_id WHERE l.id=?').bind(token).first<any>();
 if(!link||!safeLink(link.url))return new Response('Link not found.',{status:404});
 if(record&&link.sent_at&&link.status==='active'&&publicReady())try{
  if(eligibleRecipients(link,(await settingsFor(link.owner)).excludedDomains).length){
   const kind=classifyRequest(request.headers.get('user-agent')||'',[request.headers.get('sec-purpose'),request.headers.get('purpose')].filter(Boolean).join(' '));
   const source=requestSource(request,kind),id=crypto.randomUUID();
   await db().prepare('INSERT INTO events(id,message_id,received_at,kind,source_info,event_type,link_id) VALUES(?,?,?,?,?,?,?)').bind(id,link.message_id,Date.now(),kind,JSON.stringify({...source,destination:link.url}),'click',link.id).run();
   if(source.ip)after(()=>enrichEvent(id,{...source,destination:link.url},kind));
  }
 }catch{console.warn('Link activity could not be recorded');}
 return new Response(null,{status:302,headers:{Location:link.url,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
}
export async function GET(r:Request,{params}:{params:Promise<{token:string}>}){return resolve(r,(await params).token,true);}
export async function HEAD(r:Request,{params}:{params:Promise<{token:string}>}){return resolve(r,(await params).token,false);}
