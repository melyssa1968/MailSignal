const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const ts=require('typescript');const {DatabaseSync}=require('node:sqlite');const {webcrypto}=require('node:crypto');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements){try{out.push(await s.all());}catch(e){throw e;}}sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const backgroundTasks=[];let geoCalls=0,geoFails=false;async function geoFetch(url){geoCalls++;if(geoFails)throw new Error('Lookup down');const ip=decodeURIComponent(String(url).split('/').at(-1).replace(/\.json$/,''));return Response.json({ip,city:'Test Boston',region:'Massachusetts',country_code:'US',organization_name:'Fixture ISP',asn:12345,timezone:'America/New_York',accuracy:25});}
let user={userId:'owner-a',email:'owner@example.com'};const env={DB,PIXEL_PUBLIC_READY:'true'};const cache={};
function load(name){const file=path.resolve(name);if(cache[file])return cache[file].exports;const module={exports:{}};cache[file]=module;
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 function req(id){if(id==='next/server')return {after:fn=>{backgroundTasks.push(Promise.resolve().then(fn));}};if(id.endsWith('.json'))return require(path.resolve(path.dirname(file),id));if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>user};if(id.startsWith('@/'))return load(id.slice(2)+'.ts');if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id)+'.ts');return require(id);}
 const wrapper=new vm.Script('(function(require,module,exports){'+compiled+'\n})',{filename:file}).runInNewContext({fetch:geoFetch,AbortSignal,URL,Request,Response,Headers,Uint8Array,TextEncoder,Date,crypto:webcrypto,atob,console});wrapper(req,module,module.exports);return module.exports;
}
const origin='https://test.example.com';function request(route,body,method='POST',headers={}){return new Request(origin+route,{method,headers:{'content-type':'application/json',origin,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const ctx=id=>({params:Promise.resolve({id})});
(async()=>{
 const tracking=load('lib/tracking.ts');assert.equal(tracking.classifyRequest('GoogleImageProxy'),'google_proxy');assert.equal(tracking.classifyRequest('security scanner'),'automated');assert.equal(tracking.classifyRequest('Mozilla AppleWebKit'),'unverified');assert.equal(tracking.classifyRequest(''),'unknown_client');assert.deepEqual(Array.from(tracking.recipientList('A@example.com,a@example.com; b@example.com')),['a@example.com','b@example.com']);assert.throws(()=>tracking.recipientList('bad-email'));assert.equal(tracking.csvCell('=1+1'),'"\'=1+1"');
 const create=load('app/api/campaigns/route.ts');
 user=null;assert.equal((await create.POST(request('/api/campaigns',{}))).status,401);user={userId:'owner-a',email:'owner@example.com'};
 assert.equal((await create.POST(request('/api/campaigns',{},'POST',{origin:'https://evil.example.com'}))).status,403);
 let r=await create.POST(request('/api/campaigns',{name:'Integration test',subject:'A subject $&',body:'Hi <friend> $&',recipients:'a@example.com\nb@example.com'}));assert.equal(r.status,201);const {id}=await r.json();
 const ms=sql.prepare('SELECT * FROM messages').all();assert.equal(ms.length,2);
 const detail=load('app/api/campaigns/[id]/route.ts');user={userId:'other-owner',email:'other@example.com'};assert.equal((await detail.GET(request('/api/campaigns/'+id,undefined,'GET'),ctx(id))).status,404);user={userId:'owner-a',email:'owner@example.com'};
 const scriptRoute=load('app/api/campaigns/[id]/script/route.ts');const output=await (await scriptRoute.POST(request('/api/campaigns/'+id+'/script',{}),ctx(id))).json();new vm.Script(output.script);assert.ok(output.script.includes('Hi &lt;friend&gt; $&'));assert.ok(!output.script.includes('__CONFIG__'));assert.ok(!sql.prepare('SELECT secret_hash FROM campaigns').get().secret_hash.includes('key'));
 const parsed=JSON.parse(output.script.match(/const CAMPAIGN = ([\s\S]*?);\n/)[1]);const auth={authorization:'Bearer '+parsed.key};
 const dispatch=load('app/api/dispatch/route.ts');assert.equal((await dispatch.POST(request('/api/dispatch',{messageId:ms[0].id,action:'claim'}))).status,401);
 r=await dispatch.POST(request('/api/dispatch',{messageId:ms[0].id,action:'claim'},'POST',auth));assert.equal(r.status,200);
 assert.equal((await dispatch.POST(request('/api/dispatch',{messageId:ms[0].id,action:'claim'},'POST',auth))).status,409);
 const pixel=load('app/p/[token]/route.ts');const hit=(id,ua='GoogleImageProxy',cf)=>{const r=new Request(origin+'/p/'+id+'.gif',{headers:{'user-agent':ua}});if(cf)Object.defineProperty(r,'cf',{value:cf});return pixel.GET(r,{params:Promise.resolve({token:id+'.gif'})});};
 r=await hit(ms[0].id);assert.equal(r.headers.get('content-type'),'image/gif');assert.equal((await r.arrayBuffer()).byteLength,42);
 await hit(ms[0].id);await hit(ms[0].id,'security scanner');await hit(ms[1].id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events').get().n,3);
 await pixel.HEAD();assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events').get().n,3);
 const snapshot=load('app/api/snapshot/route.ts');let data=await (await snapshot.GET(request('/api/snapshot?days=7',undefined,'GET'))).json();assert.equal(data.totals.sent,0);assert.equal(data.totals.opens,0);
 await dispatch.POST(request('/api/dispatch',{messageId:ms[0].id,action:'sent'},'POST',auth));data=await (await snapshot.GET(request('/api/snapshot?days=7',undefined,'GET'))).json();assert.equal(data.totals.sent,1);assert.equal(data.totals.opens,2);assert.equal(data.totals.unique_opens,1);assert.equal(data.totals.automated,1);assert.equal(data.chart.reduce((s,r)=>s+r.opens,0),2);
 user={userId:'other-owner',email:'other@example.com'};const other=await (await snapshot.GET(request('/api/snapshot',undefined,'GET'))).json();assert.equal(other.campaigns.length,0);assert.equal(other.activity.length,0);user={userId:'owner-a',email:'owner@example.com'};
 await detail.PATCH(request('/api/campaigns/'+id,{status:'paused'},'PATCH'),ctx(id));await hit(ms[0].id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events').get().n,3);assert.equal((await dispatch.POST(request('/api/dispatch',{messageId:ms[1].id,action:'claim'},'POST',auth))).status,409);
 const resolveRoute=load('app/api/messages/[id]/route.ts');
 await detail.PATCH(request('/api/campaigns/'+id,{status:'active'},'PATCH'),ctx(id));
 await dispatch.POST(request('/api/dispatch',{messageId:ms[1].id,action:'claim'},'POST',auth));await hit(ms[1].id);
 user={userId:'other-owner',email:'other@example.com'};assert.equal((await resolveRoute.PATCH(request('/api/messages/'+ms[1].id,{resolution:'not_sent'},'PATCH'),ctx(ms[1].id))).status,404);user={userId:'owner-a',email:'owner@example.com'};
 assert.equal((await resolveRoute.PATCH(request('/api/messages/'+ms[1].id,{resolution:'not_sent'},'PATCH'),ctx(ms[1].id))).status,200);assert.equal(sql.prepare('SELECT sending_at FROM messages WHERE id=?').get(ms[1].id).sending_at,null);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events').get().n,3);
 await dispatch.POST(request('/api/dispatch',{messageId:ms[1].id,action:'claim'},'POST',auth));assert.equal((await resolveRoute.PATCH(request('/api/messages/'+ms[1].id,{resolution:'sent'},'PATCH'),ctx(ms[1].id))).status,200);assert.ok(sql.prepare('SELECT sent_at FROM messages WHERE id=?').get(ms[1].id).sent_at);
 env.PIXEL_PUBLIC_READY='false';assert.equal((await pixel.GET(new Request(origin+'/p/health.gif'),{params:Promise.resolve({token:'health.gif'})})).status,503);await hit(ms[0].id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events').get().n,3);
 const domain=load('lib/domains.ts');assert.deepEqual(Array.from(domain.normalizeDomains(['@ACME.COM','acme.com','example.org.'])),['acme.com','example.org']);assert.throws(()=>domain.normalizeDomains(['https://acme.com']));assert.equal(domain.isExcluded('someone@team.acme.com',['acme.com']),true);assert.equal(domain.isExcluded('someone@notacme.com',['acme.com']),false);
 const settingsRoute=load('app/api/settings/route.ts');await settingsRoute.PATCH(request('/api/settings',{excludedDomains:['acme.com']},'PATCH'));
 const keyRoute=load('app/api/extension/key/route.ts');const keyResult=await (await keyRoute.POST(request('/api/extension/key',{}))).json();const extensionAuth={authorization:'Bearer '+keyResult.key};const gmail=load('app/api/gmail/route.ts');env.PIXEL_PUBLIC_READY='true';
 const prepare=(recipient,extra={})=>gmail.POST(request('/api/gmail',{action:'prepare',requestId:webcrypto.randomUUID(),recipients:[recipient],sender:'owner@mycompany.com',subject:'Individual sale',...extra},'POST',extensionAuth));
 const emptyRecipients=await prepare('',{recipients:[]});assert.equal(emptyRecipients.status,400);assert.match((await emptyRecipients.json()).error,/could not read the recipients/);
 const tooManyRecipients=await prepare('',{recipients:Array.from({length:101},(_,n)=>`person${n}@example.net`)});assert.equal(tooManyRecipients.status,400);assert.match((await tooManyRecipients.json()).error,/up to 100 recipients/);
 assert.equal((await (await prepare('someone@acme.com')).json()).skip,true);assert.equal((await (await prepare('someone@team.acme.com')).json()).skip,true);assert.equal((await (await prepare('owner@mycompany.com')).json()).skip,true);assert.ok((await (await prepare('someone@example.net',{recipients:['a@example.net','b@example.net']})).json()).id);
 const rid=webcrypto.randomUUID();const prepared=await (await prepare('a@notacme.com',{requestId:rid})).json();assert.ok(prepared.id);const replay=await (await prepare('a@notacme.com',{requestId:rid})).json();assert.equal(replay.id,prepared.id);await hit(prepared.id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events WHERE message_id=?').get(prepared.id).n,0);
 await gmail.POST(request('/api/gmail',{action:'sent',id:prepared.id},'POST',extensionAuth));await hit(prepared.id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events WHERE message_id=?').get(prepared.id).n,1);
 const emailsRoute=load('app/api/emails/route.ts');let emailList=await (await emailsRoute.GET(request('/api/emails',undefined,'GET'))).json();assert.ok(emailList.emails.some(e=>e.id===prepared.id));assert.ok(!JSON.stringify(emailList).includes(keyResult.key));
 await settingsRoute.PATCH(request('/api/settings',{excludedDomains:['acme.com','notacme.com']},'PATCH'));await hit(prepared.id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events WHERE message_id=?').get(prepared.id).n,1);emailList=await (await emailsRoute.GET(request('/api/emails',undefined,'GET'))).json();assert.ok(!emailList.emails.some(e=>e.id===prepared.id));
 user={userId:'other-owner',email:'other@example.com'};const otherSettings=await (await settingsRoute.GET(request('/api/settings',undefined,'GET'))).json();assert.equal(otherSettings.excludedDomains.length,0);user={userId:'owner-a',email:'owner@example.com'};
 const signals=load('lib/signals.ts');assert.equal(signals.signalCategory('google_proxy',10000,10000),'Possible automatic load');assert.equal(signals.signalCategory('unverified',20000,10000),'Possible automatic load');assert.equal(signals.signalCategory('unverified',20001,10000),'Possible open');assert.equal(signals.signalCategory('automated',99999,10000),'Possible automated request');
 const mixed=await (await prepare('cc@acme.com',{recipients:['cc@acme.com','prospect@outside.net']})).json();assert.ok(mixed.id);await gmail.POST(request('/api/gmail',{action:'sent',id:mixed.id},'POST',extensionAuth));await hit(mixed.id,'GoogleImageProxy',{city:'Test City',region:'Test Region',country:'US',asOrganization:'Test Network',asn:15169});await hit(mixed.id,'security scanner');
 const timelineRoute=load('app/api/messages/[id]/events/route.ts');const timeline=await (await timelineRoute.GET(request('/api/messages/'+mixed.id+'/events',undefined,'GET'),ctx(mixed.id))).json();assert.equal(timeline.events.length,2);const geo=timeline.events.find(e=>e.kind==='google_proxy').source;assert.equal(geo.city,'Test City');assert.equal(geo.network,'Test Network');assert.equal(geo.asn,15169);assert.match(geo.proxy,/Google/);assert.equal(timeline.events.find(e=>e.kind==='automated').source.city,null);const sourceHelper=load('lib/request-source.ts');assert.equal(sourceHelper.requestSource(new Request(origin,{headers:{'cf-ipcity':'Spoofed','x-forwarded-for':'1.2.3.4'}}),'unverified').city,null);assert.equal(sourceHelper.parseRequestSource(null),null);assert.equal(sourceHelper.parseRequestSource('invalid'),null);assert.equal(timeline.recipients.length,2);assert.equal(timeline.events.find(e=>e.kind==='google_proxy').excluded,true);
 let updatedList=await (await emailsRoute.GET(request('/api/emails',undefined,'GET'))).json();let mixedRow=updatedList.emails.find(e=>e.id===mixed.id);assert.equal(mixedRow.loads,2);assert.equal(mixedRow.opens,0);assert.equal(mixedRow.uncertain,2);
 user={userId:'other-owner',email:'other@example.com'};assert.equal((await timelineRoute.GET(request('/api/messages/'+mixed.id+'/events',undefined,'GET'),ctx(mixed.id))).status,404);user={userId:'owner-a',email:'owner@example.com'};
 await settingsRoute.PATCH(request('/api/settings',{excludedDomains:['acme.com','outside.net']},'PATCH'));await hit(mixed.id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM events WHERE message_id=?').get(mixed.id).n,2);

 // Regression: five emails from unrelated recipients, same request burst.
 await settingsRoute.PATCH(request('/api/settings',{excludedDomains:[]},'PATCH'));
 const burst=[];for(let n=0;n<5;n++){const b=await (await prepare('burst'+n+'@outside.net')).json();burst.push(b.id);sql.prepare('UPDATE messages SET sent_at=? WHERE id=?').run(Date.now()-3600000,b.id);}
 const burstAt=Date.now()-60000;
 for(let n=0;n<5;n++)sql.prepare('INSERT INTO events(id,message_id,received_at,kind) VALUES(?,?,?,?)').run('burst-'+n,burst[n],burstAt+[0,3,21,22,119][n],'unverified');
 const activity=load('lib/activity.ts');let classified=await activity.activityFor('owner-a');
 assert.equal(classified.filter(e=>e.id.startsWith('burst-')&&e.category==='Simultaneous activity').length,5);
 let list=await (await emailsRoute.GET(request('/api/emails',undefined,'GET'))).json();assert.ok(list.emails.filter(e=>burst.includes(e.id)).every(e=>e.opens===0));
 // A later independent browser load counts; duplicate fetches form one session.
 for(let n=0;n<2;n++)sql.prepare('INSERT INTO events(id,message_id,received_at,kind) VALUES(?,?,?,?)').run('later-'+n,burst[0],burstAt+10000+n*100,'unverified');
 list=await (await emailsRoute.GET(request('/api/emails',undefined,'GET'))).json();assert.equal(list.emails.find(e=>e.id===burst[0]).opens,1);assert.equal(list.emails.find(e=>e.id===burst[0]).first_request,burstAt);assert.equal(list.emails.find(e=>e.id===burst[0]).last_request,burstAt+10100);
 let t=await (await timelineRoute.GET(request('/api/messages/'+burst[0]+'/events',undefined,'GET'),ctx(burst[0]))).json();assert.equal(t.events.filter(e=>!e.excluded).length,2);assert.equal(t.summary.first_request,list.emails.find(e=>e.id===burst[0]).first_request);assert.equal(t.summary.last_request,list.emails.find(e=>e.id===burst[0]).last_request);const one=activity.summarizeActivity([{received_at:1000,excluded:true},{received_at:2000,excluded:false},{received_at:3000,excluded:true}]);assert.equal(one.first_open,one.last_open);assert.notEqual(one.first_request,one.last_request);
 assert.equal((await timelineRoute.PATCH(request('/api/messages/'+burst[0]+'/events',{eventId:'later-0',ignored:true},'PATCH'),ctx(burst[0]))).status,200);
 t=await (await timelineRoute.GET(request('/api/messages/'+burst[0]+'/events',undefined,'GET'),ctx(burst[0]))).json();assert.equal(t.events.find(e=>e.id==='later-0').category,'Ignored by you');
 user={userId:'other-owner',email:'other@example.com'};assert.equal((await timelineRoute.PATCH(request('/api/messages/'+burst[0]+'/events',{eventId:'later-0',ignored:false},'PATCH'),ctx(burst[0]))).status,404);user={userId:'owner-a',email:'owner@example.com'};
 assert.equal((await timelineRoute.PATCH(request('/api/messages/'+burst[0]+'/events',{eventId:'later-0',ignored:false},'PATCH'),ctx(burst[0]))).status,200);
 // Sender-view reports only affect owned messages and a narrow timing window.
 await gmail.POST(request('/api/gmail',{action:'self_view',ids:[burst[0]]},'POST',extensionAuth));await hit(burst[0]);
 classified=await activity.activityFor('owner-a');assert.ok(classified.some(e=>e.message_id===burst[0]&&e.category==='Possible self-view'));assert.ok(classified.some(e=>e.id==='later-0'&&!e.excluded));
 assert.equal(tracking.classifyRequest('Mozilla/5.0','prefetch'),'automated');assert.equal(tracking.classifyRequest('curl/8'),'automated');
 console.log('PASS: 119ms cross-message burst regression, screened counts, timeline agreement, duplicate sessions, reversible ignoring with owner isolation, and narrow sender-view correlation.');
 // Source collection only trusts the known Cloudflare deployment, not client forwarding headers.
 const sourceLib=load('lib/request-source.ts');
 const edgeHeaders={'cf-connecting-ip':'8.8.8.8','cf-ipcountry':'US','cf-ray':'fixture-ray','x-dispatched-app':'site---6aa95fe7a9dc81919c4304607b822fd3','user-agent':'Mozilla/5.0 (Windows NT 10.0) Chrome/150.0'};
 const edgeRequest=new Request('https://mail-signal.melyssa-plunkett.chatgpt.site/p/test',{headers:edgeHeaders});
 const captured=sourceLib.requestSource(edgeRequest,'unverified');assert.equal(captured.ip,'8.8.8.8');assert.equal(captured.country,'US');
 assert.equal(sourceLib.requestSource(new Request('https://untrusted.example/',{headers:edgeHeaders}),'unverified').ip,null);
 assert.equal(sourceLib.requestSource(new Request(origin,{headers:{'x-forwarded-for':'8.8.8.8','cf-connecting-ip':'8.8.8.8','cf-ipcity':'Fake'}}),'unverified').ip,null);
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','fc00::1','::ffff:127.0.0.1','2a06:98c0:3600::103','8.8.8.8, 1.1.1.1'])assert.equal(sourceLib.publicIp(ip),null);
 assert.equal(sourceLib.publicIp('2001:4860:4860::8888'),'2001:4860:4860::8888');
 assert.equal(sourceLib.canonicalIp('::ffff:8.8.8.8'),'8.8.8.8');
 const ranges=JSON.parse(fs.readFileSync('lib/apple-relay-ranges.json'));const sample4=Number(ranges.v4[0][0]);const relayIp=[24,16,8,0].map(b=>(sample4>>>b)&255).join('.');
 assert.equal(sourceLib.appleRelay(relayIp),true);assert.equal(sourceLib.appleRelay('8.8.8.8'),false);
 const relaySource={...captured,ip:relayIp};assert.equal(sourceLib.sourceDescription(relaySource,'unverified').type,'privacy_relay');
 assert.equal(sourceLib.sourceDescription({...captured,network:'Microsoft Corporation'},'unverified').type,'hosting_network');
 assert.equal(sourceLib.sourceDescription({...captured,network:'Mimecast Services Limited'},'unverified').type,'security_scanner');
 const enrichment=load('lib/source-enrichment.ts'),enriched=await enrichment.enrichSource(captured,'unverified');assert.equal(enriched.city,'Test Boston');assert.equal(enriched.accuracyKm,25);assert.equal(enriched.assessment.device,'Desktop');
 const beforeGeo=geoCalls;await enrichment.enrichSource(captured,'unverified');assert.equal(geoCalls,beforeGeo,'Cached IP must not call provider again');
 geoFails=true;const fallback=await enrichment.enrichSource({...captured,ip:'1.1.1.1'},'unverified');assert.equal(fallback.country,'US');assert.equal(fallback.geoStatus,'unavailable');geoFails=false;
 const pixelRow=activity.describeActivity({kind:'unverified',source_info:JSON.stringify(relaySource),sent_at:0,received_at:60000,event_type:'pixel'},100000);assert.equal(pixelRow.excluded,true);
 const clickRow=activity.describeActivity({kind:'unverified',source_info:JSON.stringify({...relaySource,fetchUser:'?1'}),sent_at:0,received_at:60000,event_type:'click'},100000);assert.equal(clickRow.excluded,false);
 // Link preparation stores URLs only, reparents forwarded links, and cannot create an arbitrary redirect.
 const withLinks=await (await prepare('links@outside.net',{links:['https://example.com/proposal?a=1&b=2','javascript:alert(1)','https://user:password@example.com/']})).json();
 assert.equal(withLinks.links.length,1);const linkToken=new URL(withLinks.links[0].url).pathname.split('/').at(-1);
 const linkRoute=load('app/l/[token]/route.ts'),linkCtx={params:Promise.resolve({token:linkToken})};
 const eventCount=()=>sql.prepare('SELECT COUNT(*) n FROM events WHERE message_id=?').get(withLinks.id).n;
 let redirect=await linkRoute.GET(new Request(withLinks.links[0].url,{headers:{'user-agent':'Mozilla/5.0 (Macintosh) Chrome/150.0','sec-fetch-user':'?1'}}),linkCtx);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://example.com/proposal?a=1&b=2');assert.equal(eventCount(),0,'Unsent/draft link requests must not count');
 await gmail.POST(request('/api/gmail',{action:'sent',id:withLinks.id},'POST',extensionAuth));
 await linkRoute.HEAD(new Request(withLinks.links[0].url),linkCtx);assert.equal(eventCount(),0);
 await linkRoute.GET(new Request(withLinks.links[0].url,{headers:{'user-agent':'Mozilla/5.0 (Macintosh) Chrome/150.0','sec-fetch-user':'?1'}}),linkCtx);assert.equal(eventCount(),1);
 let clickEvent=sql.prepare('SELECT * FROM events WHERE message_id=?').get(withLinks.id);assert.equal(clickEvent.event_type,'click');
 const summary=activity.summarizeActivity([activity.describeActivity({...clickEvent,sent_at:clickEvent.received_at-1000},Date.now()+10000)]);assert.equal(summary.loads,0);assert.equal(summary.clicks,1);assert.equal(summary.opens,0,'Clicks must never become inferred image opens');
 const fwd=await (await prepare('forward@outside.net',{links:[withLinks.links[0].url]})).json();assert.notEqual(fwd.links[0].url,withLinks.links[0].url);
 const fwdToken=new URL(fwd.links[0].url).pathname.split('/').at(-1);assert.equal(sql.prepare('SELECT url FROM tracked_links WHERE id=?').get(fwdToken).url,'https://example.com/proposal?a=1&b=2');
 await detail.PATCH(request('/api/campaigns/'+sql.prepare('SELECT campaign_id FROM messages WHERE id=?').get(withLinks.id).campaign_id,{status:'paused'},'PATCH'),ctx(sql.prepare('SELECT campaign_id FROM messages WHERE id=?').get(withLinks.id).campaign_id));
 assert.equal((await linkRoute.GET(new Request(withLinks.links[0].url),linkCtx)).status,302);assert.equal(eventCount(),1,'Pausing tracking preserves destinations without recording clicks');
 assert.equal((await linkRoute.GET(new Request(origin+'/l/bad?url=https://evil.example'),{params:Promise.resolve({token:'bad'})})).status,404);
 console.log('PASS: trusted IP capture, spoof rejection, IPv4/IPv6, private-IP rejection, Apple relay ranges, source classes, cached enrichment and outage fallback, separate clicks, safe redirects, unsent/HEAD/paused suppression, and forwarded-link identities.');
 await Promise.all(backgroundTasks);
 await keyRoute.DELETE(request('/api/extension/key',{},'DELETE'));assert.equal((await prepare('someone@example.net')).status,401);
 console.log('PASS: individual Gmail preparation, multi-recipient eligibility and event classification, send confirmation, key revocation, ownership, exact/subdomain exclusions, and retroactive hiding/collection suppression.');
 console.log('PASS: real SQLite route integration checks cover ownership, CSRF, recipient validation, safe script encoding, duplicate-send claims, GIF response, unsent suppression, distinct opens, bot exclusion, pause, HEAD, and activation gate.');
})().catch(e=>{console.error(e);process.exitCode=1;});
