import { owner, db, json, fail, jsonInput, ApiError } from '@/lib/server';
import { recipientList } from '@/lib/tracking';
export async function POST(request:Request) { try {
 const uid=await owner(request,true), input=await jsonInput(request);
 const name=String(input.name??'').trim(),subject=String(input.subject??'').trim(),body=String(input.body??'').trim();
 if(!name||name.length>100||!subject||subject.length>200||/[\r\n]/.test(subject)||!body||body.length>20000)throw new ApiError(400,'Add a campaign name, a single-line subject, and an email message (up to 20,000 characters).');
 let emails:string[];try{emails=recipientList(String(input.recipients??''));}catch(e){throw new ApiError(400,(e as Error).message);}
 const count=await db().prepare('SELECT COUNT(*) AS n FROM campaigns WHERE owner=?').bind(uid).first<{n:number}>();
 if((count?.n??0)>=100)throw new ApiError(400,'This workspace supports up to 100 campaigns.');
 const id=crypto.randomUUID(),now=Date.now();
 await db().batch([db().prepare('INSERT INTO campaigns(id,owner,name,subject,body,created_at) VALUES(?,?,?,?,?,?)').bind(id,uid,name,subject,body,now),...emails.map(email=>db().prepare('INSERT INTO messages(id,campaign_id,email) VALUES(?,?,?)').bind(crypto.randomUUID(),id,email))]);
 return json({id},201);
}catch(e){return fail(e);} }
