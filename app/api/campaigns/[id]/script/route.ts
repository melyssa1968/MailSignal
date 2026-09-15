import { owner, db, json, fail, campaignFor, hashKey } from '@/lib/server';
import { escapeHtml } from '@/lib/tracking';
import { senderTemplate } from '@/lib/gmail-sender';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const uid=await owner(request,true),{id}=await params,c=await campaignFor(id,uid);
 const rows=await db().prepare('SELECT id,email FROM messages WHERE campaign_id=? AND sent_at IS NULL AND sending_at IS NULL ORDER BY email').bind(id).all();
 if(!rows.results.length)return json({script:'',count:0});
 const secret=crypto.randomUUID()+crypto.randomUUID();
 await db().prepare('UPDATE campaigns SET secret_hash=? WHERE id=?').bind(await hashKey(secret),id).run();
 const config={base:new URL(request.url).origin,key:secret,name:c.name,subject:c.subject,body:c.body,html:escapeHtml(c.body).replaceAll('\n','<br>'),recipients:rows.results};
 return json({script:senderTemplate.replace('__CONFIG__',()=>JSON.stringify(config,null,2)),count:rows.results.length});
}catch(e){return fail(e);}}
