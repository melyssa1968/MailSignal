import { db } from './server';
import { canonicalIp,clean,publicIp,sourceDescription } from './request-source';
export async function enrichSource(source:any,kind:string) {
 if(!publicIp(source.ip))return source;
 let geo:any=null;
 try{
  const cached=await db().prepare('SELECT value FROM source_cache WHERE ip=? AND expires_at>?').bind(source.ip,Date.now()).first<{value:string}>();
  if(cached)geo=JSON.parse(cached.value);
  else {
   // Only the requesting public IP is sent to this fixed provider; no email data.
   const r=await fetch('https://get.geojs.io/v1/ip/geo/'+encodeURIComponent(source.ip)+'.json',{signal:AbortSignal.timeout(5000),redirect:'error',headers:{Accept:'application/json'}});
   if(!r.ok)throw new Error('Lookup unavailable');
   const raw=await r.text();if(raw.length>16000)throw new Error('Invalid lookup response');
   const data=JSON.parse(raw);if(canonicalIp(data.ip)!==source.ip)throw new Error('IP mismatch');
   const asn=Number(data.asn),accuracy=Number(data.accuracy);
   geo={city:clean(data.city),region:clean(data.region),country:typeof data.country_code==='string'&&/^[A-Z]{2}$/.test(data.country_code)?data.country_code:null,network:data.organization_name==='Unknown'?null:clean(data.organization_name),asn:Number.isSafeInteger(asn)&&asn>0&&asn!==64512?asn:null,timezone:clean(data.timezone),accuracyKm:data.accuracy!=null&&Number.isFinite(accuracy)&&accuracy>=0?accuracy:null,geoProvider:'GeoJS',geoStatus:'resolved'};
   await db().prepare('INSERT INTO source_cache(ip,value,expires_at) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at').bind(source.ip,JSON.stringify(geo),Date.now()+86400000).run();
   await db().prepare('DELETE FROM source_cache WHERE expires_at<?').bind(Date.now()).run();
  }
 }catch{geo={geoStatus:'unavailable'};}
 const result={...source,...geo};result.country=result.country||source.country;
 result.assessment=sourceDescription(result,kind);
 if(result.assessment.type==='privacy_relay')result.proxy='Apple privacy relay (published IP ranges)';
 return result;
}
export async function enrichEvent(id:string,source:any,kind:string) {
 try{const enriched=await enrichSource(source,kind);await db().prepare('UPDATE events SET source_info=? WHERE id=?').bind(JSON.stringify(enriched),id).run();}catch{console.warn('Source enrichment unavailable');}
}
