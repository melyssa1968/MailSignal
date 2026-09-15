import { owner,db,json,fail,jsonInput,ApiError } from '@/lib/server';
import { settingsFor } from '@/lib/preferences';
import { normalizeDomains } from '@/lib/domains';
export async function GET(r:Request){try{return json(await settingsFor(await owner(r)));}catch(e){return fail(e);}}
export async function PATCH(r:Request){try{const uid=await owner(r,true),i=await jsonInput(r);let domains:string[];try{domains=normalizeDomains(i.excludedDomains);}catch(e){throw new ApiError(400,(e as Error).message);}await db().prepare('INSERT INTO preferences(owner,excluded_domains) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET excluded_domains=excluded.excluded_domains').bind(uid,JSON.stringify(domains)).run();return json(await settingsFor(uid));}catch(e){return fail(e);}}
