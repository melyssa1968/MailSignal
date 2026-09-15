import { owner,db,json,fail } from '@/lib/server';
import { settingsFor } from '@/lib/preferences';
import { isExcluded } from '@/lib/domains';
export async function GET(r:Request){try{
 const uid=await owner(r),s=await settingsFor(uid);
 const result=await db().prepare(`SELECT m.id,m.email,m.sent_at,c.id AS group_id,c.subject,c.status,c.source,c.created_at,COUNT(CASE WHEN e.kind!='automated' THEN e.id END) AS opens,MIN(CASE WHEN e.kind!='automated' THEN e.received_at END) AS first_open,MAX(CASE WHEN e.kind!='automated' THEN e.received_at END) AS last_open FROM messages m JOIN campaigns c ON c.id=m.campaign_id LEFT JOIN events e ON e.message_id=m.id WHERE c.owner=? AND m.sent_at IS NOT NULL GROUP BY m.id ORDER BY m.sent_at DESC LIMIT 1000`).bind(uid).all<any>();
 return json({emails:result.results.filter(m=>!isExcluded(m.email,s.excludedDomains)),settings:s,refreshedAt:Date.now()});
}catch(e){return fail(e);}}
