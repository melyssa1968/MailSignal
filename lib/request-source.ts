import { isIP } from 'node:net';
import relayRanges from './apple-relay-ranges.json';
const SITE_HOST='mail-signal.melyssa-plunkett.chatgpt.site';
const DISPATCH='site---6aa95fe7a9dc81919c4304607b822fd3';
export const clean=(v:unknown,max=240)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max)||null:null;
export function canonicalIp(value:unknown):string|null {
 const ip=clean(value,64);if(!ip||!isIP(ip)||ip.includes('%'))return null;
 if(isIP(ip)===4)return ip;
 const normalized=new URL('http://['+ip+']/').hostname.slice(1,-1);
 if(normalized.startsWith('::ffff:')){
  const parts=normalized.slice(7).split(':');if(parts.length===2){const n=parseInt(parts[0],16)*65536+parseInt(parts[1],16);return [24,16,8,0].map(b=>(n>>>b)&255).join('.');}
 }
 return normalized;
}
function ipNumber(ip:string):bigint {
 if(isIP(ip)===4)return ip.split('.').reduce((a,n)=>(a<<BigInt(8))+BigInt(n),BigInt(0));
 const halves=ip.split('::'),left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[];
 const parts=halves.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;
 return parts.reduce((a,n)=>(a<<BigInt(16))+BigInt('0x'+n),BigInt(0));
}
export function publicIp(value:unknown):string|null {
 const ip=canonicalIp(value);if(!ip)return null;
 if(isIP(ip)===4){const [a,b,c]=ip.split('.').map(Number);if(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113))return null;}
 else if(!/^[23]/.test(ip)||ip.startsWith('2001:db8:')||ip==='2001:db8::'||ip==='2a06:98c0:3600::103')return null;
 return ip;
}
export function appleRelay(ip:string):boolean {
 const normalized=publicIp(ip);if(!normalized)return false;
 const ranges=isIP(normalized)===4?relayRanges.v4:relayRanges.v6,n=ipNumber(normalized);
 let lo=0,hi=ranges.length-1;
 while(lo<=hi){const mid=(lo+hi)>>>1,[start,end]=ranges[mid];if(n<BigInt(start))hi=mid-1;else if(n>BigInt(end))lo=mid+1;else return true;}
 return false;
}
export function sourceDescription(source:any,kind:string) {
 const ua=source.client||'',network=source.network||'';
 let type='unverified_client',label='Unverified client',evidence='The request alone does not establish a human reader.',confidence='limited';
 if(kind==='google_proxy'||/GoogleImageProxy/i.test(ua)){type='google_proxy';label='Google image proxy';confidence='strong';evidence='GoogleImageProxy request signature; the device and location belong to the proxy.';}
 else if(source.ip&&appleRelay(source.ip)){type='privacy_relay';label='Apple privacy relay';confidence='strong';evidence='IP matches Apple’s published relay ranges ('+relayRanges.updated+'). This can be a privacy preload or relayed browser activity.';}
 else if(/proofpoint|mimecast|barracuda|messagelabs|sophos|symantec.*(cloud|security)/i.test(network)){type='security_scanner';label='Likely security service';confidence='moderate';evidence='Network owner identifies an email security service; this does not establish human activity.';}
 else if(kind==='automated'){type='automated';label='Bot / scanner / prefetch';confidence='strong';evidence='Request signature or purpose identifies automation.';}
 else if(/YahooMailProxy|Outlook.*(imageproxy|proxy)|ImageProxy/i.test(ua)){type='image_proxy';label='Mail image proxy';confidence='moderate';evidence='Request signature indicates an intermediary image service.';}
 else if(/amazon|google|microsoft|digitalocean|hetzner|ovh|cloudflare|akamai|fastly|linode|vultr|oracle.*cloud/i.test(network)){type='hosting_network';label='Cloud / hosting network';confidence='moderate';evidence='Network owner is a hosting provider. A proxy, VPN, scanner or genuine browser session is possible.';}
 else if(kind==='unknown_client'||ua==='Mozilla/5.0'||!ua){type='unknown';label='Unidentified client';evidence='Client signature is missing or generic; it cannot identify an app or device.';}
 const mediated=['google_proxy','privacy_relay','image_proxy'].includes(type);
 const device=mediated||type==='unknown'?null:/iPad|Tablet/i.test(ua)?'Tablet':/iPhone|Android.*Mobile|Mobile/i.test(ua)?'Mobile':/Windows NT|Macintosh|X11|Linux x86/i.test(ua)?'Desktop':null;
 const clientApp=mediated?label:/Thunderbird/i.test(ua)?'Thunderbird':/Outlook/i.test(ua)?'Outlook':/Edg\//i.test(ua)?'Edge':/Chrome\//i.test(ua)?'Chrome':/Firefox\//i.test(ua)?'Firefox':/Safari\//i.test(ua)?'Safari':null;
 const locationScope=mediated||['hosting_network','security_scanner','automated'].includes(type)?'Intermediary network location':'Approximate request location';
 const locationConfidence=!source.country?'Unavailable':mediated?'Reader location hidden':source.accuracyKm>100?'Broad area only':source.city?'Approximate city / region':'Country only';
 return {type,label,evidence,confidence,device,clientApp,locationScope,locationConfidence};
}
export function requestSource(request:Request,kind:string) {
 const cf=(request as Request & {cf?:Record<string,unknown>}).cf;
 // Trust only this Site’s Cloudflare dispatch, never arbitrary forwarding/location headers.
 const trusted=!!cf||(new URL(request.url).hostname===SITE_HOST&&request.headers.get('x-dispatched-app')===DISPATCH&&!!request.headers.get('cf-ray'));
 const country=clean(cf?.country||(trusted?request.headers.get('cf-ipcountry'):null));
 const ip=publicIp(trusted?request.headers.get('cf-connecting-ip'):null);
 const source={version:2,ip,ipSource:ip?'Cloudflare connection':null,city:clean(cf?.city),region:clean(cf?.region),country:country&&/^[A-Z]{2}$/.test(country)&&!['XX','T1'].includes(country)?country:null,network:clean(cf?.asOrganization),asn:typeof cf?.asn==='number'?cf.asn:null,timezone:clean(cf?.timezone),accuracyKm:null as number|null,geoProvider:cf?.city?'Cloudflare':null as string|null,geoStatus:ip?'pending':'unavailable',client:clean(request.headers.get('user-agent'),700),purpose:clean(request.headers.get('sec-purpose')||request.headers.get('purpose')||request.headers.get('x-purpose')),fetchMode:clean(request.headers.get('sec-fetch-mode')),fetchDest:clean(request.headers.get('sec-fetch-dest')),fetchUser:clean(request.headers.get('sec-fetch-user')),proxy:kind==='google_proxy'?'Google image proxy (request signature)':null as string|null};
 return {...source,assessment:sourceDescription(source,kind)};
}
export function parseRequestSource(value:string|null) {if(!value)return null;try{const data=JSON.parse(value);return data&&typeof data==='object'&&!Array.isArray(data)?data:null;}catch{return null;}}
