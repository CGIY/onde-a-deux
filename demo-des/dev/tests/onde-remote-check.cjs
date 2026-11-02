/* Remote identity, retry, ordering and permission checks. No live service used. */
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const G=require('../src/onde-app-core.js');
const {create}=require('../src/onde-app-remote.js');
const endpoint='https://example.supabase.co/functions/v1/desir-game';
const roomId='b98c371d-6355-4d37-a9bc-18f1228fd386';
const config={endpoint,publishableKey:'sb_publishable_test',pollIntervalMs:10000};
let checks=0;function check(fn){fn();checks++;}
function memory(){const values=new Map();return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
function eventTarget(){const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},emit(type,data={}){for(const fn of listeners.get(type)||[])fn(data);}};}
function env(fetcher,storage=memory(),extra={}){const doc={...eventTarget(),hidden:false},intervals=[];return {game:G,fetch:fetcher,storage,crypto:webcrypto,document:doc,location:{href:'https://cgiy.github.io/onde-a-deux/demo-des/?v=test'},btoa,atob,AbortController,setTimeout,clearTimeout,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},intervals,...extra};}
function state(actor='a'){return {...G.createState(),activePlayer:actor};}
function reply(actor='a',revision=1,game=state(actor),extras={}){return {roomId,actor,revision,state:game,paired:true,quota:{remaining:1,window:'morning',label:'Matin',nextAt:'2026-11-02T11:00:00.000Z'},...extras};}
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}
function payload(options){return JSON.parse(options.body);}
function loginReply(options,actor='a',revision=1,game=state(actor)){return reply(actor,revision,game,{connection:{token:options.headers.Authorization.slice(7),actor,roomId}});}
function drawn(){let value=G.reduce(state(),{type:'ROLL_CATEGORY',value:2,hand:G.cards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id)});return value;}
function drafted(){return G.reduce(drawn(),{type:'ROLL_CARD',value:1});}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 // Disabled configuration cannot accidentally contact any service.
 {
  let calls=0;const r=create({},env(async()=>{calls++;}));check(()=>assert.equal(r.enabled,false));await assert.rejects(r.restore(),{code:'unconfigured'});check(()=>assert.equal(calls,0));
 }
 // The prospective token exists before login; neither identifier nor password is stored.
 {
  const storage=memory(),calls=[];let token;
  const r=create(config,env(async(url,options)=>{const p=payload(options);calls.push(p);if(p.op==='login'){
   const pending=JSON.parse(storage.getItem('desir-connection-v1-registration'));token=options.headers.Authorization.slice(7);check(()=>assert.match(token,/^[A-Za-z0-9_-]{43}$/));check(()=>assert.equal(pending.token,token));check(()=>assert.equal(options.headers.apikey,config.publishableKey));check(()=>assert.equal(options.cache,'no-store'));check(()=>assert.equal(options.credentials,'omit'));return response(loginReply(options,'b'));
  }return response(reply('b'));},storage));
  const result=await r.login('fixture-user','fixture-password');check(()=>assert.equal(result.actor,'b'));check(()=>assert.equal(result.quota.remaining,1));check(()=>assert.deepEqual(r.connection,{roomId,actor:'b'}));check(()=>assert.equal(r.connection.token,undefined));check(()=>assert.equal(storage.getItem('desir-connection-v1-registration'),null));check(()=>assert.ok(!Array.from(storage.values.values()).join('').includes('fixture-password')));check(()=>assert.ok(!Array.from(storage.values.values()).join('').includes('fixture-user')));
  const recovered=create(config,env(async(url,options)=>{check(()=>assert.equal(options.headers.Authorization,'Bearer '+token));check(()=>assert.equal(payload(options).op,'state'));return response(reply('b'));},storage));await recovered.restore();check(()=>assert.equal(recovered.connection.actor,'b'));
 }
 // A lost login response is recovered with only the saved token after reload.
 {
  const storage=memory(),calls=[];const r=create(config,env(async(url,options)=>{calls.push(options);throw new TypeError('lost response');},storage));
  await assert.rejects(r.login('fixture-user','fixture-password'),{code:'offline'});check(()=>assert.equal(calls.length,2));check(()=>assert.equal(calls[0].headers.Authorization,calls[1].headers.Authorization));check(()=>assert.equal(payload(calls[0]).requestId,payload(calls[1]).requestId));check(()=>assert.ok(!Array.from(storage.values.values()).join('').includes('fixture-password')));
  const recovered=create(config,env(async(url,options)=>{check(()=>assert.equal(payload(options).op,'state'));return response(reply('a'));},storage));await recovered.restore();check(()=>assert.equal(recovered.connection.actor,'a'));check(()=>assert.equal(storage.getItem('desir-connection-v1-registration'),null));
 }
 // A prospective token not yet registered returns to login and is retained for retry.
 {
  const storage=memory();const initial=create(config,env(async()=>{throw Error('offline');},storage));await assert.rejects(initial.login('fixture-user','fixture-password'));
  const prospective=JSON.parse(storage.getItem('desir-connection-v1-registration')).token;let loginToken;
  const r=create(config,env(async(url,options)=>{if(payload(options).op==='state'&&!loginToken)return response({error:{code:'unauthorized'}},401);loginToken=options.headers.Authorization.slice(7);return response(loginReply(options));},storage));
  check(()=>assert.equal(r.connection,null));check(()=>assert.equal(r.pendingRegistration.op,'login'));check(()=>assert.equal(Object.keys(r.pendingRegistration).length,1));
  check(()=>assert.ok(storage.getItem('desir-connection-v1-registration')));assert.equal(await r.restore(),null);await r.login('fixture-user','fixture-password');check(()=>assert.equal(loginToken,prospective));const after=await r.restore();check(()=>assert.equal(after.actor,'a'));
 }
 // Native AbortError numeric codes are converted into the same safe offline state.
 {
  let calls=0;const r=create(config,env(async()=>{calls++;throw new DOMException('This operation was aborted','AbortError');}));await assert.rejects(r.login('fixture-user','fixture-password'),{code:'offline'});check(()=>assert.equal(calls,2));check(()=>assert.equal(r.status.phase,'offline'));
 }
 // Wrong actor data is never accepted or persisted as a valid access.
 {
  const storage=memory();const r=create(config,env(async(url,options)=>response({...loginReply(options),state:state('b')}),storage));await assert.rejects(r.login('fixture-user','fixture-password'),{code:'invalid_response'});check(()=>assert.equal(r.connection,null));check(()=>assert.equal(storage.getItem('desir-connection-v1'),null));
 }
 // Storage refusal stops login before sending the password to the server.
 {
  let calls=0;const storage={getItem(){return null;},setItem(){throw Error('quota');},removeItem(){}};const r=create(config,env(async()=>{calls++;},storage));await assert.rejects(r.login('fixture-user','fixture-password'),{code:'storage'});check(()=>assert.equal(calls,0));
 }
 // Dice fields and actor supplied by a caller are stripped; the server roll wins.
 {
  let sent;const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));sent=p;return response(reply('a',2,drawn(),{roll:{kind:6,value:2}}));}));await r.login('fixture-user','fixture-password');
  const result=await r.action({type:'ROLL_CATEGORY',roundId:'onde-1',value:6,actor:'b',hand:['spoiler'],at:'forged'});check(()=>assert.deepEqual(sent.action,{type:'ROLL_CATEGORY',roundId:'onde-1'}));check(()=>assert.match(sent.requestId,/^[0-9a-f-]{36}$/));check(()=>assert.deepEqual(result.roll,{kind:6,value:2}));check(()=>assert.equal(result.state.round.categoryId,'detente'));check(()=>assert.equal(r.snapshot.roll,undefined));
  await assert.rejects(r.action({type:'RESET',roundId:'onde-1'}),{code:'not_allowed'});
 }
 // A reroll carries only its intent; the server owns the new D4 face and state.
 {
  const draft=drafted(),rerolled=G.reduce(draft,{type:'REROLL_CARD',value:2});let sent;
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'a',1,draft));sent=p;return response(reply('a',2,rerolled,{roll:{kind:4,value:2},quota:{remaining:0,window:'morning',label:'Matin',nextAt:'2026-11-02T11:00:00.000Z'}}));}));await r.login('fixture-user','fixture-password');
  const result=await r.action({type:'REROLL_CARD',roundId:'onde-1',value:4,actor:'b',previousCardId:'forged',cardRerolled:false,hand:['spoiler'],hp:0});
  check(()=>assert.deepEqual(sent.action,{type:'REROLL_CARD',roundId:'onde-1'}));check(()=>assert.deepEqual(result.roll,{kind:4,value:2}));check(()=>assert.notEqual(result.state.round.cardId,draft.round.cardId));check(()=>assert.equal(result.state.round.cardRerolled,true));check(()=>assert.equal(result.quota.remaining,0));check(()=>assert.equal(r.snapshot.roll,undefined));
 }
 // A reroll already taken on another device integrates the new state without a connection failure.
 {
  const draft=drafted(),rerolled=G.reduce(draft,{type:'REROLL_CARD',value:3}),storage=memory();let calls=0;
  const r=create(config,env(async(url,options)=>{if(payload(options).op==='login')return response(loginReply(options,'a',1,draft));calls++;return response({...reply('a',2,rerolled),error:{code:'invalid_phase'}},409);},storage));await r.login('fixture-user','fixture-password');
  await assert.rejects(r.action({type:'REROLL_CARD',roundId:'onde-1'}),{code:'invalid_phase'});check(()=>assert.equal(calls,1));check(()=>assert.equal(r.status.phase,'connected'));check(()=>assert.equal(r.snapshot.state.round.cardRerolled,true));check(()=>assert.equal(storage.getItem('desir-connection-v1-action'),null));
 }
 // Delayed refresh cannot overwrite a more recent action response.
 {
  let release;const delayed=new Promise(resolve=>release=resolve);const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='state'){await delayed;return response(reply('a',1));}return response(reply('a',2,drawn(),{roll:{kind:6,value:2}}));}));await r.login('fixture-user','fixture-password');const old=r.refresh();await tick();await r.action({type:'ROLL_CATEGORY',roundId:'onde-1'});release();const current=await old;check(()=>assert.equal(current.revision,2));check(()=>assert.equal(r.snapshot.state.phase,'card'));
 }
 // A conflict is integrated once, rejected to the caller, and not automatically replayed.
 {
  let actions=0;const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='action'){actions++;return response({...reply('a',2,drawn()),error:{code:'conflict'}},409);}return response(reply('a',2,drawn()));}));await r.login('fixture-user','fixture-password');let error;try{await r.action({type:'ROLL_CATEGORY',roundId:'onde-1'});}catch(e){error=e;}check(()=>assert.equal(error.code,'conflict'));check(()=>assert.equal(error.snapshot.revision,2));check(()=>assert.equal(actions,1));check(()=>assert.equal(r.snapshot.state.phase,'card'));let recovered=false;r.subscribeToChanges(e=>{if(e.status.phase==='connected')recovered=true;});await r.refresh();check(()=>assert.equal(recovered,true));
 }
 // An explicit re-login can replace a revoked token, without keeping the previous actor's view.
 {
  let revoked=false,second=false;const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login'){if(!second)return response(loginReply(options,'a',10));return response(loginReply(options,'b',1,state('b')));}if(revoked)return response({error:{code:'unauthorized'}},401);return response(reply('a',10));}));await r.login('fixture-a','fixture-password');revoked=true;await assert.rejects(r.refresh(),{code:'unauthorized'});second=true;await r.login('fixture-b','fixture-password');check(()=>assert.equal(r.connection.actor,'b'));check(()=>assert.equal(r.snapshot.actor,'b'));check(()=>assert.equal(r.snapshot.revision,1));
 }
 // Revocation suspends background refreshes through failed credentials until a new login succeeds.
 {
  const storage=memory(),accounts=new Map(),loginTokens=[];let revokedToken=null,states=0;
  const serviceWorker={...eventTarget(),async register(){return {active:{}};}};
  const environment=env(async(url,options)=>{
   const p=payload(options),token=options.headers.Authorization.slice(7);
   if(p.op==='login'){
    loginTokens.push(token);
    if(p.password==='bad-secret')return response({error:{code:'invalid_credentials'}},401);
    const actor=p.username==='fixture-b'?'b':'a';accounts.set(token,actor);return response(loginReply(options,actor,actor==='a'?10:1,state(actor)));
   }
   states++;if(token===revokedToken)return response({error:{code:'unauthorized'}},401);
   return response(reply(accounts.get(token),1,state(accounts.get(token))));
  },storage,{navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-a','fixture-secret-a');r.start();revokedToken=loginTokens[0];
  environment.intervals[0]();await tick();check(()=>assert.equal(r.authenticated,false));check(()=>assert.equal(states,1));
  environment.intervals[0]();environment.intervals[0]();environment.document.emit('visibilitychange');serviceWorker.emit('message',{data:{type:'desir-state-refresh'}});await tick();check(()=>assert.equal(states,1));
  await assert.rejects(r.login('fixture-b','bad-secret'),{code:'invalid_credentials'});check(()=>assert.equal(r.authenticated,false));environment.intervals[0]();await tick();check(()=>assert.equal(states,1));
  const next=await r.login('fixture-b','fixture-secret-b');check(()=>assert.equal(next.actor,'b'));check(()=>assert.equal(next.revision,1));check(()=>assert.equal(r.authenticated,true));check(()=>assert.notEqual(loginTokens[1],revokedToken));check(()=>assert.equal(loginTokens[2],loginTokens[1]));
  environment.intervals[0]();await tick();check(()=>assert.equal(states,2));check(()=>assert.equal(r.snapshot.actor,'b'));check(()=>assert.equal(storage.getItem('desir-connection-v1-registration'),null));check(()=>assert.ok(!Array.from(storage.values.values()).join('').includes('secret')));r.stop();
 }
 // A committed action whose response is lost is retried with the same durable ID after reload.
 {
  const storage=memory(),ids=[],receipts=new Map();let fail=true,commits=0;
  const fetcher=async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='action'){ids.push(p.requestId);if(!receipts.has(p.requestId)){commits++;receipts.set(p.requestId,reply('a',2,drawn(),{roll:{kind:6,value:2}}));}if(fail)throw Error('lost');return response(receipts.get(p.requestId));}return response(reply('a',2,drawn()));};
  const r=create(config,env(fetcher,storage));await r.login('fixture-user','fixture-password');await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{code:'offline'});check(()=>assert.ok(storage.getItem('desir-connection-v1-action')));fail=false;const next=create(config,env(fetcher,storage));await next.restore();check(()=>assert.equal(commits,1));check(()=>assert.equal(new Set(ids).size,1));check(()=>assert.equal(next.snapshot.state.phase,'card'));check(()=>assert.equal(storage.getItem('desir-connection-v1-action'),null));
 }
 // Losing a committed reroll response never requests a different replacement card after reload.
 {
  const storage=memory(),ids=[],receipts=new Map();let fail=true,commits=0,authoritative=drafted();
  const fetcher=async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'a',1,authoritative));if(p.op==='action'){
   ids.push(p.requestId);check(()=>assert.deepEqual(p.action,{type:'REROLL_CARD',roundId:'onde-1'}));
   if(!receipts.has(p.requestId)){commits++;authoritative=G.reduce(authoritative,{type:'REROLL_CARD',value:3});receipts.set(p.requestId,reply('a',2,authoritative,{roll:{kind:4,value:3},quota:{remaining:0,window:'morning',label:'Matin',nextAt:'2026-11-02T11:00:00.000Z'}}));}
   if(fail)throw Error('lost reroll response');return response(receipts.get(p.requestId));
  }return response(reply('a',2,authoritative));};
  const r=create(config,env(fetcher,storage));await r.login('fixture-user','fixture-password');await assert.rejects(r.action({type:'REROLL_CARD',roundId:'onde-1',value:4}),{code:'offline'});check(()=>assert.equal(commits,1));check(()=>assert.ok(storage.getItem('desir-connection-v1-action')));
  fail=false;const recovered=create(config,env(fetcher,storage));await recovered.restore();check(()=>assert.equal(commits,1));check(()=>assert.equal(new Set(ids).size,1));check(()=>assert.equal(recovered.snapshot.state.round.cardRoll,3));check(()=>assert.equal(recovered.snapshot.state.round.cardRerolled,true));check(()=>assert.equal(storage.getItem('desir-connection-v1-action'),null));
 }
 // Permission request is initiated by the click before asynchronous notification preparation.
 {
  const calls=[],key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url');let subscription=null;const Notification={permission:'default',requestPermission(){calls.push('permission');this.permission='granted';return Promise.resolve('granted');}};
  const pushManager={async getSubscription(){return subscription;},async subscribe(options){calls.push('subscribe-browser');check(()=>assert.equal(options.userVisibleOnly,true));check(()=>assert.equal(options.applicationServerKey.length,65));subscription={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'fixture',auth:'fixture'}})};return subscription;}};
  const serviceWorker={...eventTarget(),async register(url,options){calls.push('register');check(()=>assert.equal(url,'https://cgiy.github.io/onde-a-deux/demo-des/sw.js'));check(()=>assert.equal(options.scope,'/onde-a-deux/demo-des/'));return {active:{},pushManager};}};
  const environment=env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='push_config'){calls.push('config');return response({vapidPublicKey:key});}if(p.op==='subscribe'){calls.push('subscribe-server');check(()=>assert.equal(p.subscription.endpoint,'https://web.push.apple.com/test'));return response({ok:true});}return response(reply());},memory(),{Notification,PushManager:function(){},navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-user','fixture-password');await r.prepareNotifications();calls.length=0;const work=r.enableNotifications();check(()=>assert.equal(calls[0],'permission'));await work;check(()=>assert.equal(r.notificationStatus.subscribed,true));check(()=>assert.equal(r.notificationStatus.permission,'granted'));check(()=>assert.ok(calls.includes('subscribe-server')));
 }
 // iOS outside the Home Screen never opens a permission prompt.
 {
  let prompts=0;const Notification={permission:'default',requestPermission(){prompts++;return Promise.resolve('granted');}};const r=create(config,env(async(url,options)=>response(loginReply(options)),memory(),{Notification,PushManager:function(){},navigator:{userAgent:'iPhone',standalone:false,serviceWorker:{register(){throw Error('must not register');}}}}));await r.login('fixture-user','fixture-password');await assert.rejects(r.enableNotifications(),{code:'install_required'});check(()=>assert.equal(prompts,0));check(()=>assert.equal(r.notificationStatus.supported,false));
 }
 // Background tabs do not poll; returning to the tab performs a refresh.
 {
  let states=0;const environment=env(async(url,options)=>{if(payload(options).op==='login')return response(loginReply(options));states++;return response(reply());});const r=create(config,environment);await r.login('fixture-user','fixture-password');r.start();environment.document.hidden=true;environment.intervals[0]();await tick();check(()=>assert.equal(states,0));environment.document.hidden=false;environment.document.emit('visibilitychange');await tick();check(()=>assert.equal(states,1));r.stop();
 }
 console.log(`Dés·ir remote transport: ${checks} targeted checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
