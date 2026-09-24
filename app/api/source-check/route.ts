import { owner,json,fail } from '@/lib/server';
import { requestSource } from '@/lib/request-source';
import { enrichSource } from '@/lib/source-enrichment';
import { classifyRequest } from '@/lib/tracking';
export async function GET(r:Request){try{await owner(r);const kind=classifyRequest(r.headers.get('user-agent')||'');return json({source:await enrichSource(requestSource(r,kind),kind),note:'This checks your current browser connection. It does not create an email activity event.'});}catch(e){return fail(e);}}
