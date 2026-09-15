import { db } from './server';
export async function settingsFor(uid:string){const r=await db().prepare('SELECT excluded_domains,extension_key_hash,extension_seen_at FROM preferences WHERE owner=?').bind(uid).first<any>();return {excludedDomains:r?JSON.parse(r.excluded_domains) as string[]:[],extensionKeySet:!!r?.extension_key_hash,extensionSeenAt:r?.extension_seen_at??null};}
