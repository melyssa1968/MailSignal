import { ApiError, db, fail, json, jsonInput, owner } from '@/lib/server';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const uid=await owner(request,true),{id}=await params,input=await jsonInput(request);
 if(!['sent','not_sent'].includes(input.resolution))throw new ApiError(400,'Confirm whether Gmail sent the email.');
 const m=await db().prepare('SELECT m.id,m.sending_at,m.sent_at FROM messages m JOIN campaigns c ON m.campaign_id=c.id WHERE m.id=? AND c.owner=?').bind(id,uid).first<any>();
 if(!m)throw new ApiError(404,'Message not found.');
 if(!m.sending_at||m.sent_at)throw new ApiError(409,'This message no longer needs review. Refresh the campaign.');
 if(input.resolution==='sent')await db().prepare('UPDATE messages SET sent_at=sending_at,sending_at=NULL WHERE id=? AND sent_at IS NULL').bind(id).run();
 else await db().batch([db().prepare('DELETE FROM events WHERE message_id=?').bind(id),db().prepare('UPDATE messages SET sending_at=NULL WHERE id=? AND sent_at IS NULL').bind(id)]);
 return json({status:input.resolution==='sent'?'sent':'ready'});
}catch(e){return fail(e);}}
