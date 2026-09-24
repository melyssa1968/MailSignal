import { owner, db, json, fail, jsonInput, ApiError, campaignFor } from '@/lib/server';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,ctx:Context){try{
 const uid=await owner(request),{id}=await ctx.params,c=await campaignFor(id,uid);
 const messages=await db().prepare(`SELECT m.id,m.email,m.sent_at,m.sending_at,COUNT(CASE WHEN e.kind!='automated' AND m.sent_at IS NOT NULL THEN e.id END) AS opens,MIN(CASE WHEN e.kind!='automated' AND m.sent_at IS NOT NULL THEN e.received_at END) AS first_open,MAX(CASE WHEN e.kind!='automated' AND m.sent_at IS NOT NULL THEN e.received_at END) AS last_open FROM messages m LEFT JOIN events e ON e.event_type='pixel' AND e.message_id=m.id WHERE m.campaign_id=? GROUP BY m.id ORDER BY m.email`).bind(id).all();
 const {secret_hash,owner:ownerId,...safe}=c;return json({campaign:safe,messages:messages.results});
}catch(e){return fail(e);}}
export async function PATCH(request:Request,ctx:Context){try{
 const uid=await owner(request,true),{id}=await ctx.params;await campaignFor(id,uid);const input=await jsonInput(request);
 if(!['active','paused'].includes(input.status))throw new ApiError(400,'Choose active or paused.');
 await db().prepare('UPDATE campaigns SET status=? WHERE id=? AND owner=?').bind(input.status,id,uid).run();return json({status:input.status});
}catch(e){return fail(e);}}
