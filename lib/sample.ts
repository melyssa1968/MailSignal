import type { Snapshot,Campaign } from './tracking';
export function sampleSnapshot(days:number):Snapshot{
 const now=Date.now();
 const campaigns:Campaign[]=[
 {id:'sample-1',name:'September product update',subject:'A few things we think you’ll love',body:'Hi there,\nHere is what is new this month.',status:'active',created_at:now-4*86400000,recipients:96,sent:96,opens:106,unique_opens:58,automated:6},
 {id:'sample-2',name:'Fall webinar invitations',subject:'You’re invited: the future of work',body:'We would love to see you at our next event.',status:'active',created_at:now-6*86400000,recipients:65,sent:65,opens:80,unique_opens:36,automated:4},
 {id:'sample-3',name:'Customer check-in',subject:'How is everything going?',body:'Checking in to see how things are going.',status:'active',created_at:now-3*86400000,recipients:32,sent:32,opens:45,unique_opens:26,automated:2},
 {id:'sample-4',name:'Partnership introductions',subject:'An idea for working together',body:'I would love to explore a partnership.',status:'paused',created_at:now-5*86400000,recipients:17,sent:17,opens:27,unique_opens:12,automated:1},
 ];
 const totals={recipients:210,sent:210,opens:258,unique_opens:132,automated:13};
 const series=[18,27,45,30,58,45,35];
 const chart=Array.from({length:days},(_,i)=>({day:new Date(now-(days-1-i)*86400000).toISOString().slice(0,10),opens:i>=days-7?series[i-days+7]:0,unique_opens:i>=days-7?Math.round(series[i-days+7]*0.66):0}));
 const emails=['alex@example.com','jordan@example.com','sam@example.com','riley@example.com','taylor@example.com','casey@example.com'];
 const activity=emails.map((email,i)=>({id:'e'+i,email,campaign_name:campaigns[i%4].name,campaign_id:campaigns[i%4].id,kind:i===3?'automated':i%2===0?'google_proxy':'unverified',received_at:now-(i*7+1)*60000}));
 return {campaigns,activity,chart,totals,publicReady:false,refreshedAt:now};
}