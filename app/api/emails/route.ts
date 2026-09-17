import { owner,db,json,fail } from '@/lib/server';
import { settingsFor } from '@/lib/preferences';
import { eligibleRecipients,recipientsFor } from '@/lib/signals';
import {activityFor,summarizeActivity} from '@/lib/activity';
export async function GET(r:Request){try{
 const uid=await owner(r),s=await settingsFor(uid),events=await activityFor(uid);
 const result=await db().prepare(`SELECT m.id,m.email,m.recipients_json,m.sender,m.sent_at,c.id AS group_id,c.subject,c.status,c.source,c.created_at FROM messages m JOIN campaigns c ON c.id=m.campaign_id WHERE c.owner=? AND m.sent_at IS NOT NULL ORDER BY m.sent_at DESC LIMIT 1000`).bind(uid).all<any>();
 const byMessage=new Map<string,any[]>();for(const e of events){const a=byMessage.get(e.message_id)||[];a.push(e);byMessage.set(e.message_id,a);}
 return json({emails:result.results.filter(m=>eligibleRecipients(m,s.excludedDomains).length).map(m=>({...m,recipients:recipientsFor(m),...summarizeActivity(byMessage.get(m.id)||[])})),settings:s,refreshedAt:Date.now()});
}catch(e){return fail(e);}}
