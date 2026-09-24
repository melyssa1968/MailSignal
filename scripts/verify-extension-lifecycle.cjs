const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const startup=fs.readFileSync('extension/startup.js','utf8');
const content=ts.transpileModule(fs.readFileSync('extension/content.src.js','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const flush=()=>new Promise(setImmediate),origin='chrome-extension://fixture/';
function target(){const handlers=new Map();return {addEventListener(n,f){if(!handlers.has(n))handlers.set(n,new Set());handlers.get(n).add(f);},removeEventListener(n,f){handlers.get(n)?.delete(f);},fire(n,e={}){for(const f of [...handlers.get(n)||[]]){f(e);if(e.stopped)break;}},count(n){return handlers.get(n)?.size||0;}};}
async function fixture(delayed=false){
 const state={valid:true,destroys:0,registrations:0,unregisters:0,disconnects:0,apiCalls:0,manifestCalls:0},elements=[],intervals=new Set(),window=target(),document=target();
 function element(tag){const e={tag,style:{},setAttribute(){},append(){},addEventListener(){}};elements.push(e);return e;}
 Object.assign(document,{createElement:element,body:element('body'),querySelectorAll:()=>[],getElementById:id=>elements.find(e=>e.id===id)});
 const sdk={destroy(){state.destroys++;},Compose:{registerComposeViewHandler(){state.registrations++;return ()=>state.unregisters++;}}};
 let resolveLoad,statusHandler;
 const chrome={runtime:{get id(){return state.valid?'fixture':undefined;},getURL(){if(!state.valid)throw new Error('Extension context invalidated.');return origin;},getManifest(){state.manifestCalls++;if(!state.valid)throw new Error('Extension context invalidated.');return {version:'0.5.1'};},onMessage:{addListener(f){statusHandler=f;}},async sendMessage(){state.apiCalls++;if(!state.valid)throw new Error('Extension context invalidated.');return {configured:true,appId:'sdk_fixture'};}}};
 const context=vm.createContext({window,document,chrome,URL,Date,console:{info(){},warn(...args){throw new Error(args.join(' '));}},setTimeout:()=>1,clearTimeout(){},setInterval:f=>{intervals.add(f);return f;},clearInterval:f=>intervals.delete(f),MutationObserver:class{observe(){}disconnect(){state.disconnects++;}}});
 new vm.Script(startup).runInContext(context);
 new vm.Script('(function(require,exports){'+content+'})').runInContext(context)(()=>({load:()=>delayed?new Promise(r=>resolveLoad=r):Promise.resolve(sdk)}),{});
 await flush();
 return {state,window,document,intervals,context,statusHandler,resolve:()=>resolveLoad(sdk),banners:()=>elements.filter(e=>e.id==='mailsignal-reconnect').length};
}
function errorEvent(message,filename=origin+'content.js'){return {message,filename,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};}
(async()=>{
 const f=await fixture();assert.equal(f.state.registrations,1);assert.equal(f.intervals.size,1);
 f.state.valid=false;f.document.fire('pointerdown');
 assert.equal(f.state.destroys,1);assert.equal(f.state.unregisters,1);assert.equal(f.state.disconnects,1);assert.equal(f.intervals.size,0);assert.equal(f.document.count('click'),0);assert.equal(f.banners(),1);
 f.window.fire('focus');f.document.fire('keydown');assert.equal(f.state.destroys,1);
 let replied=false;f.statusHandler({type:'mailsignal-status'},{id:'fixture'},()=>replied=true);assert.equal(replied,false);assert.equal(f.state.manifestCalls,1,'Status handler uses cached manifest after invalidation');
 const late=await fixture(true);late.state.valid=false;late.window.fire('focus');late.resolve();await flush();
 assert.equal(late.state.destroys,1);assert.equal(late.state.registrations,0);assert.equal(late.banners(),1,'Late SDK completion must not restart integration');
 const fromError=await fixture();const healthyError=errorEvent('Extension context invalidated.');fromError.window.fire('error',healthyError);assert.equal(healthyError.prevented,false,'Do not suppress errors when context is healthy');
 fromError.state.valid=false;const foreign=errorEvent('Extension context invalidated.','chrome-extension://other/content.js');fromError.window.fire('error',foreign);assert.equal(foreign.prevented,false);
 const own=errorEvent('Extension context invalidated.');fromError.window.fire('error',own);assert.equal(own.prevented,true);assert.equal(fromError.state.destroys,1);assert.equal(fromError.banners(),1);
 const rejected=errorEvent('');rejected.reason={message:'Extension context invalidated.',stack:origin+'content.js:64'};fromError.window.fire('unhandledrejection',rejected);assert.equal(rejected.prevented,true);assert.equal(fromError.banners(),1);
 const unrelated=errorEvent('Unexpected SDK failure');fromError.window.fire('error',unrelated);assert.equal(unrelated.prevented,false,'Unrelated errors remain visible');
 const page=await fixture();page.window.fire('pagehide');assert.equal(page.state.destroys,1);assert.equal(page.banners(),0);assert.equal(page.intervals.size,0);
 console.log('PASS: SDK teardown, observer/listener/timer cleanup, pre-interaction invalidation, late SDK startup, safe status replies, scoped error handling, and normal page exit.');
})().catch(e=>{console.error(e);process.exitCode=1;});
