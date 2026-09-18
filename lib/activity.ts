import { db } from './server';
import { parseRequestSource } from './request-source';

// One classification path for both the list and timeline. Read-time burst
// detection also corrects historical data without destroying raw evidence.
export async function activityFor(uid:string, now=Date.now()) {
 const r=await db().prepare(`WITH scoped AS (
 SELECT e.*,m.sent_at FROM events e JOIN messages m ON m.id=e.message_id
 JOIN campaigns c ON c.id=m.campaign_id WHERE c.owner=? AND m.sent_at IS NOT NULL
 ), annotated AS (
 SELECT e.*,
 (SELECT COUNT(DISTINCT b.message_id) FROM scoped b WHERE b.kind=e.kind AND b.received_at BETWEEN e.received_at-1000 AND e.received_at+1000) AS burst_messages,
 EXISTS(SELECT 1 FROM sender_views v WHERE v.message_id=e.message_id AND e.received_at BETWEEN v.observed_at-5000 AND v.observed_at+5000) AS sender_overlap
 FROM scoped e
 ) SELECT * FROM annotated ORDER BY received_at,id`).bind(uid).all<any>();
 return r.results.map(e=>describeActivity(e,now));
}
export function describeActivity(e:any,now=Date.now()) {
 const source=parseRequestSource(e.source_info);
 const age=e.received_at-e.sent_at;
 let category='Later image activity',reason='An image loaded after sending. No automation pattern was detected; this still does not verify a human read.',excluded=false;
 if(e.ignored_at){category='Ignored by you';reason='Excluded from activity counts. The original request is retained.';excluded=true;}
 else if(e.sender_overlap){category='Possible self-view';reason='Your connected Gmail reported displaying this message within 5 seconds of this request. A coincident recipient view is possible.';excluded=true;}
 else if(e.burst_messages>=3){category='Simultaneous activity';reason=`${e.burst_messages} different emails had the same request category within 1 second of this event. This suggests shared loading or automation; the cause is unknown.`;excluded=true;}
 else if(e.kind==='automated'){category='Automated / prefetch';reason='The request signature indicates a scanner, bot, or prefetch. It is excluded from activity counts.';excluded=true;}
 else if(age<0){category='Before send confirmation';reason='Arrived before send confirmation. Timing cannot establish a recipient view.';excluded=true;}
 else if(age<=10000){category='Immediate image load';reason='Arrived within 10 seconds of send confirmation. A genuine fast open is possible, but this is excluded from the main activity count.';excluded=true;}
 else if(e.kind==='unknown_client'){category='Unrecognized request';reason='The request did not identify a browser or known image proxy. It is retained for review, not counted as engagement.';excluded=true;}
 else if(now-e.received_at<3000){category='Checking activity';reason='Waiting briefly to check for simultaneous requests across other emails.';excluded=true;}
 const {source_info,...rest}=e;
 return {...rest,source,category,reason,excluded,secondsAfterSend:age/1000};
}
export function summarizeActivity(events:any[]) {
 const usable=events.filter(e=>!e.excluded);
 // Multiple loads less than 30 seconds apart count as one activity session.
 const sessions:any[]=[];
 for(const e of usable)if(!sessions.length||e.received_at-sessions[sessions.length-1].received_at>=30000)sessions.push(e);
 return {first_request:events[0]?.received_at??null,last_request:events[events.length-1]?.received_at??null,loads:events.length,opens:sessions.length,uncertain:events.filter(e=>e.excluded).length,first_open:usable[0]?.received_at??null,last_open:usable[usable.length-1]?.received_at??null};
}
