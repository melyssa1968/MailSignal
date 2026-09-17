import {owner,db,json,fail,ApiError} from '@/lib/server';
import {signalCategory,signalReason,recipientsFor,eligibleRecipients} from '@/lib/signals';
import {settingsFor} from '@/lib/preferences';
import {parseRequestSource} from '@/lib/request-source';
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{
 const uid=await owner(r),{id}=await params;
 const m=await db().prepare('SELECT m.*,c.subject FROM messages m JOIN campaigns c ON c.id=m.campaign_id WHERE m.id=? AND c.owner=? AND m.sent_at IS NOT NULL').bind(id,uid).first<any>();
 if(!m||!eligibleRecipients(m,(await settingsFor(uid)).excludedDomains).length)throw new ApiError(404,'Email not found.');
 const e=await db().prepare('SELECT id,received_at,kind,source_info FROM events WHERE message_id=? ORDER BY received_at ASC,id ASC LIMIT 501').bind(id).all<any>();
 return json({subject:m.subject,recipients:recipientsFor(m),sentAt:m.sent_at,truncated:e.results.length>500,events:e.results.slice(0,500).map(({source_info,...v})=>({...v,source:parseRequestSource(source_info),category:signalCategory(v.kind,v.received_at,m.sent_at),reason:signalReason(v.kind,v.received_at,m.sent_at),secondsAfterSend:(v.received_at-m.sent_at)/1000}))});
}catch(e){return fail(e);}}
