import { owner,db,json,fail } from '@/lib/server';
import { settingsFor } from '@/lib/preferences';
import { eligibleRecipients,recipientsFor } from '@/lib/signals';
export async function GET(r:Request){try{
 const uid=await owner(r),s=await settingsFor(uid);
 const result=await db().prepare(`SELECT m.id,m.email,m.recipients_json,m.sender,m.sent_at,c.id AS group_id,c.subject,c.status,c.source,c.created_at,
 COUNT(e.id) AS loads,
 COUNT(CASE WHEN e.kind!='automated' AND e.received_at>m.sent_at+10000 THEN e.id END) AS opens,
 COUNT(CASE WHEN e.kind='automated' OR e.received_at<=m.sent_at+10000 THEN e.id END) AS uncertain,
 MIN(e.received_at) AS first_open,MAX(e.received_at) AS last_open
 FROM messages m JOIN campaigns c ON c.id=m.campaign_id LEFT JOIN events e ON e.message_id=m.id WHERE c.owner=? AND m.sent_at IS NOT NULL GROUP BY m.id ORDER BY m.sent_at DESC LIMIT 1000`).bind(uid).all<any>();
 return json({emails:result.results.filter(m=>eligibleRecipients(m,s.excludedDomains).length).map(m=>({...m,recipients:recipientsFor(m)})),settings:s,refreshedAt:Date.now()});
}catch(e){return fail(e);}}
