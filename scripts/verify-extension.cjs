const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{webcrypto}=require('node:crypto');
const sent=[],elements=[];let registerCompose;const viewId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const observedImages=[{getAttribute:()=>`https://ci3.googleusercontent.com/proxy/opaque#https://mail-signal.melyssa-plunkett.chatgpt.site/p/${viewId}.gif`}];
function element(tag){let html='';const e={style:{},append(){},appendChild(){},setAttribute(){},remove(){},addEventListener(name,fn){this[name]=fn;},get innerHTML(){return html;},set innerHTML(v){html=v;},content:{querySelectorAll(){return [];}}};elements.push([tag,e]);return e;}
const sdk={Compose:{registerComposeViewHandler(fn){registerCompose=fn;}}};let failPrepare=false;
const chrome={runtime:{async sendMessage(payload){sent.push(payload);if(payload.action==='config')return {configured:true,appId:'test-only-fixture'};if(payload.action==='prepare')return failPrepare?{error:'Network unavailable'}:{id:'test-message',pixelUrl:'https://mail-signal.melyssa-plunkett.chatgpt.site/p/test-message.gif'};return {confirmed:true};}}};
const src=ts.transpileModule(fs.readFileSync(process.env.MAILSIGNAL_CONTENT_SOURCE||'extension/content.src.js','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new vm.Script('(function(require,exports){'+src+'})').runInNewContext({chrome,document:{createElement:element,body:element('body'),querySelectorAll:()=>observedImages},MutationObserver:class {observe(){}},clearTimeout:()=>{},Date,crypto:webcrypto,setTimeout:()=>0,URL,console})(()=>({load:async()=>sdk}),{});
const flush=()=>new Promise(setImmediate),original='<p>Hello prospect</p>',lastPrepare=()=>sent.filter(p=>p.action==='prepare').at(-1);
function field(value,{chip=false,body=false}={}){return {value:chip?'':value,getAttribute:name=>chip&&name==='data-hovercard-id'?value:null,closest:()=>body?{}:null};}
async function composeFixture(){
 const state={to:['prospect@example.com'],cc:[],bcc:[],fields:{to:[],cc:[],bcc:[]},sender:'me@mycompany.com',subject:'A sales conversation',gone:false};
 const events={};let modifier;
 const root={querySelectorAll(selector){const name=selector.match(/input\[name="(to|cc|bcc)"\]/)?.[1];assert.ok(name,'Only named recipient fields may be read');return state.fields[name];}};
 const contacts=name=>state[name].map(emailAddress=>({emailAddress}));
 const compose={addComposeNotice(){return {el:element('bar')};},async getDraftID(){return 'draft-1';},getElement(){return root;},getToRecipients(){return contacts('to');},getCcRecipients(){return contacts('cc');},getBccRecipients(){return contacts('bcc');},getFromContact(){if(state.gone)throw new Error('reply form closed');return {emailAddress:state.sender};},getSubject(){if(state.gone)throw new Error('reply form closed');return state.subject;},registerRequestModifier(fn){modifier=fn;},on(name,fn){events[name]=fn;}};
 registerCompose(compose);await flush();assert.equal(typeof modifier,'function');
 return {state,events,modifier,checkbox:elements.filter(([tag,e])=>tag==='input'&&e.type==='checkbox').at(-1)[1]};
}
(async()=>{
 await flush();const f=await composeFixture();
 assert.ok(sent.some(p=>p.action==='self_view'&&p.ids.includes(viewId)),'Rendered proxy image should report only its tracked identifier');
 assert.equal(sent.filter(p=>p.action==='prepare').length,0,'Opening a draft must not arm tracking');
 const result=await f.modifier({body:original,isPlainText:false});assert.ok(result.body.startsWith(original));assert.ok(result.body.includes('<img '));
 assert.ok(!('body' in lastPrepare()));assert.ok(!('html' in lastPrepare()));f.events.sent();await flush();assert.ok(sent.some(p=>p.action==='sent'&&p.id==='test-message'));
 f.checkbox.checked=false;f.checkbox.change();assert.equal((await f.modifier({body:original,isPlainText:false})).body,original);
 const count=sent.filter(p=>p.action==='sent').length;f.events.sent();await flush();assert.equal(sent.filter(p=>p.action==='sent').length,count);
 f.checkbox.checked=true;f.checkbox.change();failPrepare=true;assert.equal((await f.modifier({body:original,isPlainText:false})).body,original);failPrepare=false;
 assert.equal((await f.modifier({body:'plain',isPlainText:true})).body,'plain');
 // Regression: Gmail empties a reply form between the click and request hook.
 const reply=await composeFixture();reply.state.cc=['cc@example.net'];reply.state.bcc=['bcc@example.org'];reply.state.subject='Re: Our meeting';
 reply.events.presending?.();reply.state.to=[];reply.state.cc=[];reply.state.bcc=[];reply.state.gone=true;
 assert.match((await reply.modifier({body:original,isPlainText:false})).body,/<img /);
 assert.deepEqual(Array.from(lastPrepare().recipients),['prospect@example.com','cc@example.net','bcc@example.org']);assert.equal(lastPrepare().subject,'Re: Our meeting');assert.equal(lastPrepare().sender,'me@mycompany.com');
 // Collapsed replies have hidden fields but no rendered recipient chips.
 const collapsed=await composeFixture();collapsed.state.to=[];
 collapsed.state.fields={to:[field('"Last, First" <Prospect@Example.COM>; Second <second@example.net>'),field('quoted@example.org',{body:true})],cc:[field('cc@mycompany.com'),field('prospect@example.com',{chip:true})],bcc:[field('bcc@example.net',{chip:true})]};
 collapsed.events.presending();collapsed.state.fields={to:[],cc:[],bcc:[]};collapsed.state.gone=true;
 assert.match((await collapsed.modifier({body:original,isPlainText:false})).body,/<img /);
 assert.deepEqual(Array.from(lastPrepare().recipients),['prospect@example.com','second@example.net','cc@mycompany.com','bcc@example.net'],'Keep internal CC for server exclusions, deduplicate, and omit quoted-body addresses');
 // Canceled attempts cannot leak recipients into the next send.
 collapsed.events.sendCanceled();const before=sent.filter(p=>p.action==='prepare').length;
 collapsed.state.gone=false;assert.equal((await collapsed.modifier({body:original,isPlainText:false})).body,original);assert.equal(sent.filter(p=>p.action==='prepare').length,before);
 collapsed.events.sent();await flush();assert.match(sent.filter(p=>p.action==='outcome').at(-1).message,/could not read.*recipients/i);
 collapsed.state.to=['new@example.org'];collapsed.events.presending();collapsed.state.to=[];collapsed.state.gone=true;
 assert.match((await collapsed.modifier({body:original,isPlainText:false})).body,/<img /);assert.deepEqual(Array.from(lastPrepare().recipients),['new@example.org']);
 // Separate reply windows keep their own current metadata.
 const other=await composeFixture();other.state.to=['other@example.net'];other.events.presending();other.state.to=[];other.state.gone=true;
 await reply.modifier({body:original,isPlainText:false});assert.equal(lastPrepare().recipients[0],'prospect@example.com');
 await other.modifier({body:original,isPlainText:false});assert.deepEqual(Array.from(lastPrepare().recipients),['other@example.net']);
 // Clicking Send again refreshes the snapshot even without a cancellation event.
 other.state.gone=false;other.state.to=['edited@example.com'];other.events.presending();other.state.to=[];other.state.gone=true;
 await other.modifier({body:original,isPlainText:false});assert.deepEqual(Array.from(lastPrepare().recipients),['edited@example.com']);
 other.events.sent();other.state.gone=false;assert.equal((await other.modifier({body:original,isPlainText:false})).body,original,'A sent snapshot cannot be reused');
 console.log('PASS: new compose, reply-form teardown, collapsed reply fields, CC/BCC, deduplication, quoted-body exclusion, cancellation/retry, separate windows, opt-out, plain-text skip, no body upload, sent confirmation, and failure fallback (mocked Gmail SDK; not live Gmail).');
})().catch(e=>{console.error(e);process.exitCode=1;});
