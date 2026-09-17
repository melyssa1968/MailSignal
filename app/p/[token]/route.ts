import { db, publicReady } from '@/lib/server';
import { settingsFor } from '@/lib/preferences';
import { eligibleRecipients } from '@/lib/signals';
import { classifyRequest } from '@/lib/tracking';
import { requestSource } from '@/lib/request-source';
const gif=Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0));
function pixel(head=false){return new Response(head?null:gif,{headers:{'Content-Type':'image/gif','Cache-Control':'private, no-store, no-cache, must-revalidate, max-age=0','Pragma':'no-cache','Expires':'0','X-Content-Type-Options':'nosniff'}});}
export async function HEAD(){return pixel(true);}
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(token==='health.gif')return publicReady()?pixel():new Response('Pixel endpoint needs activation.',{status:503});
 const id=token.replace(/\.gif$/,'');
 if(!/^[a-f0-9-]{36}$/.test(id)||!publicReady())return pixel();
 try{
 const m=await db().prepare('SELECT m.email,m.recipients_json,m.sender,c.owner FROM messages m JOIN campaigns c ON c.id=m.campaign_id WHERE m.id=?').bind(id).first<{email:string;recipients_json:string;sender:string|null;owner:string}>();
 if(!m||!eligibleRecipients(m,(await settingsFor(m.owner)).excludedDomains).length)return pixel();
 const kind=classifyRequest(request.headers.get('user-agent')||'');
 await db().prepare(`INSERT INTO events(id,message_id,received_at,kind,source_info) SELECT ?,m.id,?,?,? FROM messages m JOIN campaigns c ON m.campaign_id=c.id WHERE m.id=? AND c.status='active' AND (m.sent_at IS NOT NULL OR m.sending_at IS NOT NULL)`)
 .bind(crypto.randomUUID(),Date.now(),kind,JSON.stringify(requestSource(request,kind)),id).run();
 }catch(e){console.error('Pixel event write failed',e instanceof Error?e.message:'unknown');}
 return pixel();
}
