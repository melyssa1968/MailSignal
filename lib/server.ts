import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export function db():D1Database { if (!env.DB) throw new ApiError(503,'Campaign storage is temporarily unavailable. Please retry.'); return env.DB; }
export async function owner(request:Request, mutation=false) {
 const u=await getChatGPTUser();
 if(!u) throw new ApiError(401,'Please sign in to access your campaigns.');
 if(mutation) {
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin) throw new ApiError(403,'Request origin is not allowed.');
 if(!request.headers.get('content-type')?.includes('application/json')) throw new ApiError(415,'Expected JSON.');
 }
 return u.userId;
}
export async function jsonInput(request:Request) {
 if(Number(request.headers.get('content-length')||0)>60000)throw new ApiError(413,'Request is too large.');
 const raw=await request.text();if(raw.length>60000)throw new ApiError(413,'Request is too large.');
 try { return JSON.parse(raw); } catch {throw new ApiError(400,'Invalid JSON.');}
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function fail(e:unknown){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('MailSignal request failed',e instanceof Error?e.message:'unknown');return json({error:'Could not complete this request. Your input has been preserved; please retry.'},503);}
export async function campaignFor(id:string,uid:string){const c=await db().prepare('SELECT * FROM campaigns WHERE id=? AND owner=?').bind(id,uid).first<any>();if(!c)throw new ApiError(404,'Campaign not found.');return c;}
export async function hashKey(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export function publicReady(){return (env as unknown as Record<string,string>).PIXEL_PUBLIC_READY==='true';}
