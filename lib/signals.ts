import { isExcluded } from './domains';
export const IMMEDIATE_MS=10000;
export function recipientsFor(m:{email:string;recipients_json?:string|null}):string[]{
 try{const a=JSON.parse(m.recipients_json||'[]');if(Array.isArray(a)&&a.length&&a.every(x=>typeof x==='string'))return a;}catch{}
 return [m.email];
}
export function eligibleRecipients(m:{email:string;recipients_json?:string|null;sender?:string|null},domains:string[]){return recipientsFor(m).filter(e=>e!==m.sender&&!isExcluded(e,domains));}
export function signalCategory(kind:string,at:number,sent:number){
 if(kind==='automated')return 'Possible automated request';
 if(at<sent)return 'Before send confirmation';
 if(at-sent<=IMMEDIATE_MS)return 'Possible automatic load';
 return 'Possible open';
}
export function signalReason(kind:string,at:number,sent:number){
 const timing=at<sent?'Arrived before send confirmation; timing is uncertain.':at-sent<=IMMEDIATE_MS?'Within 10 seconds of send confirmation. This is a timing heuristic, not proof of automation.':'Image loaded more than 10 seconds after send confirmation. This does not verify a human read.';
 return (kind==='automated'?'Request identifies as a bot, scanner, or prefetcher. ':kind==='google_proxy'?'Google image proxy; viewer identity is hidden. ':'Unverified image request. ')+timing;
}
