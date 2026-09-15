import { ApiError, db, fail, hashKey, json, jsonInput, publicReady } from '@/lib/server';
export async function POST(request:Request){try{
 if(!publicReady())throw new ApiError(503,'The public pixel endpoint is not activated yet.');
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!token||token.length>200)throw new ApiError(401,'A campaign sender key is required.');
 const i=await jsonInput(request);if(!['claim','sent','failed'].includes(i.action))throw new ApiError(400,'Invalid sender action.');
 const c=await db().prepare('SELECT id,status FROM campaigns WHERE secret_hash=?').bind(await hashKey(token)).first<{id:string;status:string}>();
 if(!c)throw new ApiError(401,'The sender key is invalid or has been replaced.');
 const m=await db().prepare('SELECT id,sent_at,sending_at FROM messages WHERE id=? AND campaign_id=?').bind(String(i.messageId),c.id).first<any>();
 if(!m)throw new ApiError(404,'Message not found.');
 if(m.sent_at)return json({status:'already_sent'});
 if(i.action==='claim'){
 if(c.status!=='active')throw new ApiError(409,'This campaign is paused.');
 const r=await db().prepare('UPDATE messages SET sending_at=? WHERE id=? AND sending_at IS NULL AND sent_at IS NULL').bind(Date.now(),m.id).run();
 if(!r.meta.changes)throw new ApiError(409,'A previous send may have completed. Review Gmail Sent before retrying.');
 return json({status:'claimed'});
 }
 if(!m.sending_at)throw new ApiError(409,'Message was not claimed for sending.');
 if(i.action==='sent')await db().prepare('UPDATE messages SET sent_at=sending_at,sending_at=NULL WHERE id=? AND sent_at IS NULL').bind(m.id).run();
 else await db().batch([db().prepare('DELETE FROM events WHERE message_id=?').bind(m.id),db().prepare('UPDATE messages SET sending_at=NULL WHERE id=? AND sent_at IS NULL').bind(m.id)]);
 return json({status:i.action==='sent'?'sent':'ready'});
}catch(e){return fail(e);}}
