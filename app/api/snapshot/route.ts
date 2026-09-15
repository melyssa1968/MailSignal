import { owner, db, json, fail, publicReady } from '@/lib/server';
export async function GET(request:Request){try{
 const uid=await owner(request),days=Number(new URL(request.url).searchParams.get('days')||7),range=[7,30,90].includes(days)?days:7;
 const start=new Date();start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-range+1);const since=start.getTime();
 const results=await db().batch([
 db().prepare(`SELECT c.id,c.name,c.subject,c.body,c.status,c.created_at,COUNT(DISTINCT m.id) AS recipients,COUNT(DISTINCT CASE WHEN m.sent_at IS NOT NULL THEN m.id END) AS sent,COUNT(CASE WHEN e.kind!='automated' THEN e.id END) AS opens,COUNT(DISTINCT CASE WHEN e.kind!='automated' THEN m.id END) AS unique_opens,COUNT(CASE WHEN e.kind='automated' THEN e.id END) AS automated FROM campaigns c LEFT JOIN messages m ON m.campaign_id=c.id LEFT JOIN events e ON e.message_id=m.id AND e.received_at>=? AND m.sent_at IS NOT NULL WHERE c.owner=? GROUP BY c.id ORDER BY c.created_at DESC`).bind(since,uid),
 db().prepare(`SELECT e.id,e.kind,e.received_at,m.email,c.name AS campaign_name,c.id AS campaign_id FROM events e JOIN messages m ON e.message_id=m.id JOIN campaigns c ON m.campaign_id=c.id WHERE c.owner=? AND e.received_at>=? AND m.sent_at IS NOT NULL ORDER BY e.received_at DESC LIMIT 100`).bind(uid,since),
 db().prepare(`SELECT strftime('%Y-%m-%d',e.received_at/1000,'unixepoch') AS day,COUNT(*) AS opens,COUNT(DISTINCT m.id) AS unique_opens FROM events e JOIN messages m ON e.message_id=m.id JOIN campaigns c ON m.campaign_id=c.id WHERE c.owner=? AND e.received_at>=? AND e.kind!='automated' AND m.sent_at IS NOT NULL GROUP BY day ORDER BY day`).bind(uid,since)
 ]);
 const campaigns=results[0].results as any[], rows=results[2].results as any[];
 const chart=Array.from({length:range},(_,i)=>{const day=new Date(since+i*86400000).toISOString().slice(0,10);return rows.find(r=>r.day===day)??{day,opens:0,unique_opens:0};});
 const totals=campaigns.reduce((s,c)=>{for(const k of Object.keys(s))s[k]+=Number(c[k]);return s;},{recipients:0,sent:0,opens:0,unique_opens:0,automated:0});
 return json({campaigns,activity:results[1].results,chart,totals,publicReady:publicReady(),refreshedAt:Date.now()});
}catch(e){return fail(e);}}
