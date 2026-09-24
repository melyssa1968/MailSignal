import { db } from './server';
const HOST='mail-signal.melyssa-plunkett.chatgpt.site';
export function safeLink(value:unknown):string|null {
 if(typeof value!=='string'||value.length>4000)return null;
 try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;return u.href;}catch{return null;}
}
export async function prepareLinks(messageId:string,uid:string,urls:unknown,origin:string) {
 if(!Array.isArray(urls))return [];
 const candidates=[...new Set(urls.filter((u):u is string=>typeof u==='string'))].slice(0,50).map(original=>({original,target:safeLink(original)})).filter(x=>x.target);
 const local=(url:string)=>new URL(url).hostname===HOST||new URL(url).origin===new URL(origin).origin;
 const token=(url:string)=>new URL(url).pathname.match(/^\/l\/([a-f0-9-]{36})$/)?.[1];
 const priorIds=candidates.filter(x=>local(x.target!)).map(x=>token(x.target!)).filter((id):id is string=>!!id);
 const prior=new Map<string,string>();
 if(priorIds.length){const rows=await db().prepare(`SELECT l.id,l.url FROM tracked_links l JOIN messages m ON m.id=l.message_id JOIN campaigns c ON c.id=m.campaign_id WHERE c.owner=? AND l.id IN (${priorIds.map(()=>'?').join(',')})`).bind(uid,...priorIds).all<{id:string;url:string}>();for(const row of rows.results)prior.set(row.id,row.url);}
 const resolved=candidates.map(x=>({...x,target:local(x.target!)?safeLink(prior.get(token(x.target!)||'')):x.target})).filter(x=>x.target);
 const targets=[...new Set(resolved.map(x=>x.target!))];if(!targets.length)return [];
 await db().batch(targets.map(url=>db().prepare('INSERT INTO tracked_links(id,message_id,url) VALUES(?,?,?) ON CONFLICT(message_id,url) DO NOTHING').bind(crypto.randomUUID(),messageId,url)));
 const stored=await db().prepare('SELECT id,url FROM tracked_links WHERE message_id=?').bind(messageId).all<{id:string;url:string}>(),byUrl=new Map(stored.results.map(l=>[l.url,l.id]));
 return resolved.map(l=>({original:l.original,url:new URL('/l/'+byUrl.get(l.target!),origin).href}));
}
