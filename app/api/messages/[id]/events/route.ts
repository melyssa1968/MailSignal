import {owner,db,json,fail,ApiError,jsonInput} from '@/lib/server';
import {recipientsFor,eligibleRecipients} from '@/lib/signals';
import {settingsFor} from '@/lib/preferences';
import {activityFor} from '@/lib/activity';
async function owned(id:string,uid:string){
 const m=await db().prepare('SELECT m.*,c.subject FROM messages m JOIN campaigns c ON c.id=m.campaign_id WHERE m.id=? AND c.owner=? AND m.sent_at IS NOT NULL').bind(id,uid).first<any>();
 if(!m||!eligibleRecipients(m,(await settingsFor(uid)).excludedDomains).length)throw new ApiError(404,'Email not found.');return m;
}
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{
 const uid=await owner(r),{id}=await params,m=await owned(id,uid);
 const events=(await activityFor(uid)).filter(e=>e.message_id===id);
 return json({id,subject:m.subject,recipients:recipientsFor(m),sentAt:m.sent_at,truncated:events.length>500,events:events.slice(-500)});
}catch(e){return fail(e);}}
export async function PATCH(r:Request,{params}:{params:Promise<{id:string}>}){try{
 const uid=await owner(r,true),{id}=await params;await owned(id,uid);const i=await jsonInput(r);
 if(typeof i.eventId!=='string'||typeof i.ignored!=='boolean')throw new ApiError(400,'Invalid activity update.');
 const e=await db().prepare('SELECT id FROM events WHERE id=? AND message_id=?').bind(i.eventId,id).first();if(!e)throw new ApiError(404,'Activity not found.');
 await db().prepare('UPDATE events SET ignored_at=? WHERE id=? AND message_id=?').bind(i.ignored?Date.now():null,i.eventId,id).run();return json({ok:true});
}catch(e){return fail(e);}}
