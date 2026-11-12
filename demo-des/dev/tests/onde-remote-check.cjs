/* Remote identity, retry, ordering and permission checks. No live service used. */
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const G=require('../src/onde-app-core.js');
const {create}=require('../src/onde-app-remote.js');
const endpoint='https://example.supabase.co/functions/v1/desir-game';
const roomId='b98c371d-6355-4d37-a9bc-18f1228fd386';
const config={endpoint,publishableKey:'sb_publishable_test',pollIntervalMs:10000};
let checks=0;function check(fn){fn();checks++;}
function memory(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
function eventTarget(){const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},emit(type,data={}){for(const fn of listeners.get(type)||[])fn(data);}};}
function env(fetcher,storage=memory(),extra={}){const doc={...eventTarget(),hidden:false},intervals=[];return {game:G,fetch:fetcher,storage,crypto:webcrypto,document:doc,location:{href:'https://cgiy.github.io/desir/demo-des/?v=test'},btoa,atob,AbortController,setTimeout,clearTimeout,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},intervals,...extra};}
function state(actor='a'){return G.roomView(G.createRoom(),actor);}
function reply(actor='a',revision=1,game=state(actor),extras={}){return {roomId,actor,revision,state:game,paired:true,gameVersion:6,incoming:[],pendingOutgoing:0,quota:{remaining:1,window:'morning',label:'Matin',nextAt:'2026-11-02T11:00:00.000Z'},...extras};}
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}
function payload(options){return JSON.parse(options.body);}
function loginReply(options,actor='a',revision=1,game=state(actor)){return reply(actor,revision,game,{connection:{token:options.headers.Authorization.slice(7),actor,roomId}});}
function drawn(){return G.reduce(state(),{type:'ROLL_CATEGORY',value:1,hand:G.legacyCards.filter(c=>c.categoryId==='complicite').slice(0,6).map(c=>c.id)});}
function drafted(){return G.reduce(drawn(),{type:'ROLL_CARD',value:1});}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function parallelReply(room,actor='a',revision=1){
 const own=G.roomView(room,actor),pending=room.pendingRounds.map(item=>G.roomView(room,actor,item.round.id)).filter(value=>value?.phase==='pending'&&G.canSeeRound(value,actor));
 const incoming=pending.filter(value=>value.round.from!==actor);
 const pendingOutgoing=pending.filter(value=>value.round.from===actor).length;
 return reply(actor,revision,own,{gameVersion:6,drawAvailable:own.phase==='category',incoming,pendingOutgoing});
}
function badgeRoom(actor='a',sent=false){
 const at='2026-11-08T12:00:00.000Z';let room=G.createRoom({at});const roundId=room.lanes[actor].round.id;
 for(const action of [{type:'ROLL_CATEGORY',catalogueVersion:2,value:1,hand:G.cards.filter(card=>card.categoryId==='complicite').map(card=>card.id)},{type:'ROLL_CARD',value:1},{type:'ROLL_VARIANT',value:1},...(sent?[{type:'SEND',directQueue:true}]:[])])room=G.reduceRoom(room,{...action,actor,roundId,at});
 assert.ok(G.validateRoom(room));assert.ok(G.validateBadgeView(G.badgeView(room,actor),actor));return room;
}
(async()=>{
 // Private image loading accepts only bounded JPEG data and never persists it.
 {
  const storage=memory(),calls=[];let unavailable=false;
  const r=create(config,env(async(url,options)=>{
   const body=payload(options);calls.push({body,token:options.headers.Authorization,cache:options.cache});
   if(body.op==='login')return response(loginReply(options));
   if(unavailable)return response({error:{code:'server_error'}},503);
   return response({portraits:{a:'/9j/2Q==',b:'https://outside.example/portrait',c:'/9j/AA=='}});
  },storage));
  await assert.rejects(r.loadPortraits(),{code:'not_connected'});
  await r.login('fixture-a','fixture-secret');
  const before=r.snapshot;
  const photos=await r.loadPortraits();
  check(()=>assert.deepEqual(photos,{a:'data:image/jpeg;base64,/9j/2Q=='}));
  check(()=>{assert.deepEqual(calls[1].body,{op:'portraits',gameVersion:8});assert.equal(calls[0].token,calls[1].token);assert.equal(calls[1].cache,'no-store');assert.deepEqual(r.snapshot,before);assert.ok([...storage.values.values()].every(value=>!value.includes('/9j/')));});
  unavailable=true;await assert.rejects(r.loadPortraits(),{status:503});
  check(()=>assert.equal(r.authenticated,true));
 }
 // Civil days advance the weekly rate; percentages change only with counts.
 {
  const storage=memory(),writes=[];
  let loseReply=false;
  const rhythm={started_on:'2030-02-01',ended_on:'2030-02-08',with_penetration:1,without_penetration:2,anal:0};
  const r=create(config,env(async(url,options)=>{
   const body=payload(options);
   if(body.op==='login')return response(loginReply(options));
   if(body.op==='rhythm')return response({rhythm,canRecord:true});
   writes.push(body);
   if(loseReply)return response({error:{code:'server_error'}},503);
   return response({rhythm:{...rhythm,with_penetration:2,anal:1},canRecord:true});
  },storage));
  await r.login('fixture-a','fixture-secret');
  const first=await r.loadRhythm();
  rhythm.ended_on='2030-02-09';
  const second=await r.loadRhythm();
  check(()=>{assert.equal(first.total,3);assert.equal(second.total,21/8);assert.deepEqual(second.shares,first.shares);});
  loseReply=true;
  await assert.rejects(r.recordRhythm('anal'),{status:503});
  await assert.rejects(r.recordRhythm('penetration'),{code:'pending_action'});
  loseReply=false;
  const recorded=await r.recordRhythm('anal');
  check(()=>{assert.equal(writes.length,3);assert.equal(new Set(writes.map(write=>write.requestId)).size,1);assert.equal(recorded.total,28/8);assert.deepEqual(recorded.shares,{withPenetration:.5,withoutPenetration:.5,anal:.25});});
  check(()=>assert.ok([...storage.values.values()].every(value=>!value.includes('2030-02-01')&&!value.includes(writes[0].requestId))));
 }
 // New activity metadata is optional and only the streak and date are retained.
 {
  const activity={streak:2,lastDay:'2026-11-08'},r=create(config,env(async(url,options)=>{
   if(payload(options).op==='login')return response({...loginReply(options),activity:{...activity,unrelated:'ignored'}});
   return response(reply());
  }));
  await r.login('fixture-a','fixture-secret');await r.refresh();
  check(()=>assert.deepEqual(r.snapshot.activity,activity));
  for(const bad of [{streak:-1,lastDay:null},{streak:2,lastDay:'2026-02-30'},{streak:0,lastDay:'2026-11-08'}]){
   const invalid=create(config,env(async(url,options)=>response({...loginReply(options),activity:bad})));
   await assert.rejects(invalid.login('fixture-a','fixture-secret'),{code:'invalid_response'});
   check(()=>assert.equal(invalid.connection,null));
  }
 }
 // Validate the new collection and preserve dates and identities on legacy replies.
 {
  const room=badgeRoom(),badges=G.badgeView(room,'a');
  const r=create(config,env(async(url,options)=>response({...loginReply(options,'a',1,G.roomView(room,'a')),gameVersion:8,badges})));
  await r.login('fixture-a','fixture-secret');check(()=>{assert.deepEqual(r.snapshot.badges,badges);assert.equal(r.snapshot.badges.items.length,120);assert.ok(r.snapshot.badges.items.some(item=>item.award?.id.includes(':individual:a:')));});
  const imported=G.badgeView(room,'a',{legacy:true});
  for(const item of imported.items)if(item.award){item.award.at=null;item.award.source='imported';}
  for(const gameVersion of [6,7]){
   const old=create(config,env(async(url,options)=>response({...loginReply(options),gameVersion,badges:imported})));
   await old.login('fixture-a','fixture-secret');
   check(()=>{assert.deepEqual(old.snapshot.badges,imported);assert.equal(old.snapshot.badges.items.length,90);assert.equal(old.snapshot.badges.items.find(item=>item.award).award.at,null);});
  }
 }
 // Malformed badge metadata and the other actor's personal award IDs cannot enter an authenticated snapshot.
 {
  const valid=G.badgeView(badgeRoom(),'a');
  const invalid=[null,G.badgeView(badgeRoom('b'),'b'),{...valid,epoch:'2'},{...valid,items:valid.items.slice(1)},{...valid,items:valid.items.slice(0,60)},{...valid,privateCounters:{b:{draws:99}}}];
  for(const mutate of [view=>view.items[0].progress.value=-1,view=>view.items[0].progress.target=999,view=>view.items[1].id=view.items[0].id,view=>view.items[0].award.at=null,view=>view.items[0].award.sequence=9]){const value=JSON.parse(JSON.stringify(valid));mutate(value);invalid.push(value);}
  for(const badges of invalid){const r=create(config,env(async(url,options)=>response({...loginReply(options),gameVersion:8,badges})));await assert.rejects(r.login('fixture-a','fixture-secret'),{code:'invalid_response'});check(()=>{assert.equal(r.connection,null);assert.equal(r.authenticated,false);});}
 }
 // Replay each old durable receipt with its original protocol, then refresh with v8.
 for(const gameVersion of [6,7]){
  const storage=memory(),calls=[],room=badgeRoom('a',true),badges=G.badgeView(room,'a');
  const fetcher=async(url,options)=>{const p=payload(options);calls.push(p);if(p.op==='login')return response(loginReply(options));if(p.op==='action')return response(reply('a',2,G.roomView(room,'a'),{gameVersion}));return response(reply('a',3,G.roomView(room,'a'),{gameVersion:8,badges}));};
  const r=create(config,env(fetcher,storage));await r.login('fixture-a','fixture-secret');calls.length=0;
  const requestId=webcrypto.randomUUID();storage.setItem('desir-connection-v1-action',JSON.stringify({version:1,gameVersion,endpoint,roomId,actor:'a',requestId,action:{type:'SEND',roundId:'onde-1'}}));
  const restored=create(config,env(fetcher,storage));await restored.restore();
  check(()=>{assert.deepEqual(calls.map(call=>[call.op,call.gameVersion]),[['action',gameVersion],['state',8]]);assert.equal(calls[0].requestId,requestId);assert.equal(restored.authenticated,true);assert.deepEqual(restored.snapshot.badges,badges);assert.equal(restored.snapshot.revision,3);assert.equal(storage.getItem('desir-connection-v1-action'),null);});
 }
 // Missing metadata in an old receipt retains only the same account's last validated collection.
 {
  const first=badgeRoom(),sent=badgeRoom('a',true),before=G.badgeView(first,'a'),after=G.badgeView(sent,'a');
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response({...loginReply(options,'a',1,G.roomView(first,'a')),badges:before});if(p.op==='action')return response(reply('a',2,G.roomView(sent,'a')));return response(reply('a',3,G.roomView(sent,'a'),{badges:after}));}));
  await r.login('fixture-a','fixture-secret');const replayed=await r.action({type:'SEND',roundId:first.lanes.a.round.id});check(()=>{assert.deepEqual(replayed.badges,before);assert.equal(r.authenticated,true);});await r.refresh();check(()=>assert.deepEqual(r.snapshot.badges,after));
  let logins=0;const switched=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login'){logins++;return response(logins===1?{...loginReply(options),badges:before}:loginReply(options,'b'));}return response({error:{code:'unauthorized'}},401);}));
  await switched.login('fixture-a','fixture-secret');await assert.rejects(switched.action({type:'SEND',roundId:'onde-1'}),{status:401});await switched.login('fixture-b','fixture-secret-b');check(()=>{assert.equal(switched.connection.actor,'b');assert.equal(switched.snapshot.badges,undefined);assert.equal(switched.authenticated,true);});
 }
 // The retired live controller is absent, and its commands cannot contact the service.
 {
  const calls=[],r=create(config,env(async(url,options)=>{calls.push(payload(options));return response(loginReply(options));}));
  await r.login('fixture-user','fixture-password');calls.length=0;
  check(()=>{assert.equal(r.hardcore,undefined);assert.equal(Object.hasOwn(r,'hardcore'),false);});
  for(const type of ['PRESS','START','ATTACK'])await assert.rejects(r.action({type,roundId:'onde-1'}),{code:'not_allowed'});
  check(()=>assert.equal(calls.length,0));
 }
 // Parallel snapshots keep several invitations separate from the next active draw.
 {
  let room=G.createRoom();const ids=[],at='2026-11-05T12:00:00.000Z';
  for(let i=0;i<2;i++){
   const id=room.lanes.b.round.id;ids.push(id);
   room=G.reduceRoom(room,{type:'ROLL_CATEGORY',actor:'b',roundId:id,catalogueVersion:2,value:1,hand:G.cards.filter(c=>c.categoryId==='complicite').map(c=>c.id)});
   room=G.reduceRoom(room,{type:'ROLL_CARD',actor:'b',roundId:id,value:1});
   room=G.reduceRoom(room,{type:'ROLL_VARIANT',actor:'b',roundId:id,value:1});
   room=G.reduceRoom(room,{type:'SEND',actor:'b',roundId:id,at,directQueue:true});
  }
  const expected=parallelReply(room),r=create(config,env(async(url,options)=>response({...expected,connection:{token:options.headers.Authorization.slice(7),actor:'a',roomId}})));
  await r.login('fixture-user','fixture-password');check(()=>{assert.equal(r.snapshot.gameVersion,6);assert.equal(r.snapshot.state.round.from,'a');assert.equal(r.snapshot.state.phase,'category');assert.equal(r.snapshot.incoming.length,0);assert.deepEqual(r.snapshot.state.tasks.map(value=>value.id),ids);assert.equal(r.snapshot.pendingOutgoing,0);});
  const invalid=[{...expected,incoming:[expected.state]},...[undefined,1,2,3,4,5].map(gameVersion=>({...expected,gameVersion}))];
  for(const snapshot of invalid){const bad=create(config,env(async(url,options)=>response({...snapshot,connection:{token:options.headers.Authorization.slice(7),actor:'a',roomId}})));await assert.rejects(bad.login('fixture-user','fixture-password'),{code:'invalid_response'});check(()=>assert.equal(bad.connection,null));}
 }
 // A D8 receipt is accepted only when its face matches the authoritative Cocon round.
 {
  const base=state(),draw=G.drawCategory(base,1,4,n=>n);
  const cocon=G.reduce(base,{type:'ROLL_CATEGORY',value:1,...draw});
  const selected=G.reduce(cocon,{type:'ROLL_CARD',value:8});
  for(const [version,value,valid] of [[7,8,true],[7,7,false],[6,8,false]]){
   const calls=[],r=create(config,env(async(url,options)=>{
    const p=payload(options);calls.push(p);
    if(p.op==='login')return response({...loginReply(options,'a',1,cocon),gameVersion:7});
    return response(reply('a',2,selected,{gameVersion:version,roll:{kind:8,value}}));
   }));
   await r.login('fixture-user','fixture-password');
   const result=r.action({type:'ROLL_CARD',roundId:cocon.round.id});
   if(valid){
    const played=await result;
    check(()=>{assert.deepEqual(played.roll,{kind:8,value:8});assert.equal(played.state.phase,'variant');});
   }else await assert.rejects(result,{code:'invalid_response'});
   check(()=>assert.ok(calls.every(call=>call.gameVersion===8)));
  }
 }
 // V8 confirms D8 results outside Cocon along with the full badge projection.
 {
  const at='2026-11-09T10:00:00.000Z',base=G.roomView(G.createRoom({at}),'a');
  const draw=G.drawCategory(base,'projets',G.currentCatalogueVersion);
  const dealt=G.reduce(base,{type:'ROLL_CATEGORY',value:3,at,...draw});
  const selected=G.reduce(dealt,{type:'ROLL_CARD',value:8,at});
  const badges=G.badgeView(selected,'a'),calls=[];
  const r=create(config,env(async(url,options)=>{
   const p=payload(options);calls.push(p);
   if(p.op==='login')return response({...loginReply(options,'a',1,dealt),gameVersion:8,badges});
   return response(reply('a',2,selected,{gameVersion:8,roll:{kind:8,value:8},badges,serverTime:at}));
  }));
  await r.login('fixture-a','fixture-secret');
  const played=await r.action({type:'ROLL_CARD',roundId:dealt.round.id});
  check(()=>{assert.ok(calls.every(call=>call.gameVersion===8));assert.deepEqual(played.roll,{kind:8,value:8});assert.equal(played.state.round.cardId,'eight-projets-ciel');});
  check(()=>{assert.deepEqual(played.badges,badges);assert.equal(played.badges.items.length,120);assert.deepEqual(played.state.cardRerollWallets,selected.cardRerollWallets);});
 }
 // An obsolete durable action cannot trap the new client before the parallel state refresh.
 {
  const storage=memory(),calls=[],room=G.createRoom();
  const fetcher=async(url,options)=>{const p=payload(options);calls.push(p);if(p.op==='action')return response({error:{code:'upgrade_required'}},409);return response({...parallelReply(room),...(p.op==='login'?{connection:{token:options.headers.Authorization.slice(7),actor:'a',roomId}}:{})});};
  const r=create(config,env(fetcher,storage));await r.login('fixture-user','fixture-password');calls.length=0;
  storage.setItem('desir-connection-v1-action',JSON.stringify({version:1,gameVersion:2,endpoint,roomId,actor:'a',requestId:webcrypto.randomUUID(),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}}));
  const recovered=create(config,env(fetcher,storage));await recovered.restore();check(()=>{assert.deepEqual(calls.map(p=>[p.op,p.gameVersion]),[['state',8]]);assert.equal(storage.getItem('desir-connection-v1-action'),null);assert.equal(recovered.status.phase,'connected');assert.equal(recovered.snapshot.gameVersion,6);});
 }
 // Invalid pending journals cannot prevent restoration or replace a saved access.
 {
  const connectionKey='desir-connection-v1',actionKey=connectionKey+'-action',registrationKey=connectionKey+'-registration';
  const token='A'.repeat(43),saved=JSON.stringify({version:1,endpoint,token,roomId,actor:'a',pairingCode:null});
  const action={version:1,gameVersion:7,endpoint,roomId,actor:'a',requestId:webcrypto.randomUUID(),action:{type:'SEND',roundId:'onde-1'}};
  const registration={version:1,endpoint,op:'login',token:'E'.repeat(43),requestId:webcrypto.randomUUID()};
  const invalidActions=[{...action,roomId:webcrypto.randomUUID()},{...action,actor:'b'},{...action,version:2},{...action,requestId:'00000000-0000-0000-0000-000000000000'},
   {...action,action:{type:'PRESS',roundId:'onde-1'}},{...action,action:{type:'SEND'}},{...action,action:{type:'TOGGLE_TASK_CHECK',roundId:'onde-1',taskId:'invalid',checked:true}},
   {...action,action:{type:'JOKER_DRAW',roundId:'onde-1',category:5}}];
  const invalidRegistrations=[{...registration,endpoint:'https://old.example/'},{...registration,version:2},{...registration,op:'register'},
   {...registration,requestId:undefined},{...registration,token:'B'.repeat(43)}];
  for(const [key,fixtures] of [[actionKey,invalidActions],[registrationKey,invalidRegistrations]]){
   for(const raw of ['', '{', 'null', ...fixtures.map(value=>JSON.stringify(value))]){
    const storage=memory(),calls=[];storage.setItem(connectionKey,saved);storage.setItem(key,raw);
    const r=create(config,env(async(url,options)=>{
     calls.push([payload(options).op,options.headers.Authorization]);return response(reply('a',2,state(),{gameVersion:8}));
    },storage));
    await r.restore();await r.refresh();
    check(()=>{
     assert.deepEqual(calls,[['state','Bearer '+token],['state','Bearer '+token]]);
     assert.equal(r.authenticated,true);assert.equal(r.snapshot.revision,2);
     assert.equal(storage.getItem(key),null);assert.equal(storage.getItem(connectionKey),saved);
    });
   }
  }
 }
 // A terminal rejection on a saved request restores the game with the existing token.
 for(const [code,status] of [['stale_round',409],['invalid_phase',409],['upgrade_required',409],['invalid_action',400],['not_allowed',403]]){
  const storage=memory(),calls=[];
  const fetcher=async(url,options)=>{
   const p=payload(options);calls.push([p.op,p.gameVersion,options.headers.Authorization]);
   if(p.op==='login')return response(loginReply(options));
   if(p.op==='action')return response({error:{code}},status);
   return response(reply('a',4,state(),{gameVersion:8}));
  };
  const first=create(config,env(fetcher,storage));await first.login('fixture-a','fixture-password');
  const saved=storage.getItem('desir-connection-v1'),token='Bearer '+JSON.parse(saved).token;
  calls.length=0;
  storage.setItem('desir-connection-v1-action',JSON.stringify({
   version:1,gameVersion:6,endpoint,roomId,actor:'a',requestId:webcrypto.randomUUID(),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}
  }));
  const recovered=create(config,env(fetcher,storage));await recovered.restore();
  check(()=>{
   assert.deepEqual(calls,[['action',6,token],['state',8,token]]);
   assert.equal(recovered.authenticated,true);assert.equal(recovered.snapshot.revision,4);
   assert.equal(storage.getItem('desir-connection-v1'),saved);
   assert.equal(storage.getItem('desir-connection-v1-action'),null);
  });
 }
 // A replayed receipt never flashes an older protocol or quota before the state read.
 {
  const storage=memory(),emitted=[];let releaseState;
  const fetcher=async(url,options)=>{
   const p=payload(options);
   if(p.op==='login')return response(loginReply(options));
   if(p.op==='action')return response(reply('a',2,state(),{quota:{remaining:0,window:'old',label:'Hier',nextAt:null}}));
   return new Promise(resolve=>{releaseState=()=>resolve(response(reply('a',3,state(),{gameVersion:8})));});
  };
  const first=create(config,env(fetcher,storage));await first.login('fixture-a','fixture-password');
  storage.setItem('desir-connection-v1-action',JSON.stringify({
   version:1,gameVersion:6,endpoint,roomId,actor:'a',requestId:webcrypto.randomUUID(),action:{type:'ROLL_CATEGORY',roundId:'onde-1'}
  }));
  const recovered=create(config,env(fetcher,storage));
  recovered.subscribeToChanges(event=>{if(event.snapshot)emitted.push(event.snapshot.gameVersion);});
  const work=recovered.restore();await tick();
  check(()=>{assert.equal(typeof releaseState,'function');assert.equal(recovered.snapshot,null);assert.deepEqual(emitted,[]);});
  releaseState();await work;
  check(()=>{assert.equal(recovered.authenticated,true);assert.ok(emitted.length);assert.ok(emitted.every(version=>version===8));assert.equal(storage.getItem('desir-connection-v1-action'),null);});
 }
 // A failing pending mutation never hides a successfully refreshed, authenticated game.
 {
  const storage=memory(),requests=[];let failAction=true;
  const fetcher=async(url,options)=>{const p=payload(options);requests.push(p);if(p.op==='login')return response(loginReply(options,'b',5,state('b')));if(p.op==='action'&&failAction)return response({error:{code:'server_error'}},503);return response(reply('b',failAction?5:6,state('b')));};
  const first=create(config,env(fetcher,storage));await first.login('fixture-b','fixture-password');
  await assert.rejects(first.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{status:503});
  const pending=storage.getItem('desir-connection-v1-action');
  const recovered=create(config,env(fetcher,storage)),current=await recovered.restore();
  check(()=>{assert.equal(current.actor,'b');assert.equal(current.revision,5);assert.equal(recovered.authenticated,true);assert.equal(recovered.status.phase,'connected');assert.equal(recovered.status.errorCode,'pending_action');assert.equal(storage.getItem('desir-connection-v1-action'),pending);assert.equal(requests.at(-1).op,'state');});
  failAction=false;await recovered.refresh();
  check(()=>{assert.equal(recovered.snapshot.revision,6);assert.equal(recovered.status.errorCode,null);assert.equal(storage.getItem('desir-connection-v1-action'),null);assert.equal(new Set(requests.filter(p=>p.op==='action').map(p=>p.requestId)).size,1);});
 }
 // A poll waiting behind a successful in-flight action does not send that action again.
 {
  const storage=memory(),requests=[];let releaseAction;
  const r=create(config,env(async(url,options)=>{const p=payload(options);requests.push(p);if(p.op==='login')return response(loginReply(options));if(p.op==='action'&&requests.filter(p=>p.op==='action').length===1)return new Promise(resolve=>releaseAction=()=>resolve(response(reply('a',2,drawn()))));return response(reply('a',2,drawn()));},storage));
  await r.login('fixture-user','fixture-password');const action=r.action({type:'ROLL_CATEGORY',roundId:'onde-1'});await tick();const refresh=r.refresh();await tick();releaseAction();await Promise.all([action,refresh]);
  check(()=>{assert.equal(requests.filter(p=>p.op==='action').length,1);assert.equal(requests.at(-1).op,'state');assert.equal(r.snapshot.revision,2);assert.equal(storage.getItem('desir-connection-v1-action'),null);});
 }
 // A delayed unauthorized response for a replaced token cannot revoke the new session.
 {
  let releaseRead;const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'b',4,state('b')));if(p.op==='state')return new Promise(resolve=>releaseRead=()=>resolve(response({error:{code:'unauthorized'}},401)));return response({error:{code:'unauthorized'}},401);}));
  await r.login('fixture-b','fixture-password');const oldRead=r.refresh();await tick();await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{status:401});
  await r.login('fixture-b','fixture-password');check(()=>assert.equal(r.authenticated,true));releaseRead();await assert.rejects(oldRead);
  check(()=>{assert.equal(r.authenticated,true);assert.equal(r.status.phase,'connected');assert.equal(r.snapshot.actor,'b');});
 }
 // An earlier successful read cannot revive a token after a confirmed unauthorized response.
 {
  let releaseRead,reads=0;
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'b',4,state('b')));if(p.op==='state'){reads++;return new Promise(resolve=>releaseRead=()=>resolve(response(reply('b',5,state('b')))));}return response({error:{code:'unauthorized'}},401);}));
  await r.login('fixture-b','fixture-password');const oldRead=r.refresh();await tick();await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{status:401});
  check(()=>assert.equal(r.authenticated,false));releaseRead();await assert.rejects(oldRead,{code:'connection_changed'});
  check(()=>{assert.equal(r.authenticated,false);assert.equal(r.snapshot.revision,4);assert.equal(r.status.errorCode,'unauthorized');});
  await assert.rejects(r.refresh(),{code:'not_connected'});check(()=>{assert.equal(reads,1);assert.equal(r.authenticated,false);});
  await r.login('fixture-b','fixture-password');check(()=>assert.equal(r.authenticated,true));
 }
 // A pending write is retained but never replayed again after the read confirms revocation.
 {
  const storage=memory();let calls=0;
  const fetcher=async(url,options)=>{calls++;const p=payload(options);if(p.op==='login')return response(loginReply(options));return response({error:{code:p.op==='action'?'server_error':'unauthorized'}},p.op==='action'?503:401);};
  const first=create(config,env(fetcher,storage));await first.login('fixture-user','fixture-password');await assert.rejects(first.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{status:503});
  const pending=storage.getItem('desir-connection-v1-action'),recovered=create(config,env(fetcher,storage));await assert.rejects(recovered.restore(),{status:401});const before=calls;
  await assert.rejects(recovered.refresh(),{code:'not_connected'});check(()=>{assert.equal(calls,before);assert.equal(recovered.authenticated,false);assert.equal(storage.getItem('desir-connection-v1-action'),pending);});
 }
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
 // A replacement login can finish after its response was lost, even if the previous access is revoked.
 {
  const storage=memory(),connectionKey='desir-connection-v1',registrationKey=connectionKey+'-registration',actionKey=connectionKey+'-action';
  const oldToken='A'.repeat(43),newToken='E'.repeat(43),calls=[];
  const saved=JSON.stringify({version:1,endpoint,token:oldToken,roomId,actor:'a',pairingCode:null});
  const pending=JSON.stringify({version:1,endpoint,op:'login',token:newToken,requestId:webcrypto.randomUUID()});
  storage.setItem(connectionKey,saved);storage.setItem(registrationKey,pending);
  storage.setItem(actionKey,JSON.stringify({version:1,gameVersion:8,endpoint,roomId,actor:'a',requestId:webcrypto.randomUUID(),action:{type:'SEND',roundId:'onde-1'}}));
  let online=false;
  const fetcher=async(url,options)=>{
   const token=options.headers.Authorization.slice(7);calls.push([payload(options).op,token]);
   if(!online)throw Error('offline');
   if(token===oldToken)return response({error:{code:'unauthorized'}},401);
   return response(reply('b'));
  };
  const r=create(config,env(fetcher,storage));await assert.rejects(r.restore(),{code:'offline'});
  check(()=>{assert.equal(storage.getItem(connectionKey),saved);assert.equal(storage.getItem(registrationKey),pending);assert.ok(storage.getItem(actionKey));});
  online=true;await r.restore();
  check(()=>{
   assert.deepEqual(calls,[['state',newToken],['state',newToken]]);
   assert.equal(r.authenticated,true);assert.equal(r.connection.actor,'b');
   assert.equal(JSON.parse(storage.getItem(connectionKey)).token,newToken);
   assert.equal(storage.getItem(registrationKey),null);assert.equal(storage.getItem(actionKey),null);
  });
  // If the prospective token is unregistered, the established access still works.
  storage.setItem(connectionKey,saved);storage.setItem(registrationKey,pending);
  const fallbackCalls=[],fallback=create(config,env(async(url,options)=>{
   const token=options.headers.Authorization.slice(7);fallbackCalls.push(token);
   return token===newToken?response({error:{code:'unauthorized'}},401):response(reply('a'));
  },storage));
  await fallback.restore();
  check(()=>{assert.deepEqual(fallbackCalls,[newToken,oldToken]);assert.equal(fallback.authenticated,true);assert.equal(storage.getItem(registrationKey),pending);assert.equal(storage.getItem(connectionKey),saved);});
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
  const modern=G.reduce(state(),{type:'ROLL_CATEGORY',value:1,catalogueVersion:2,hand:G.drawHand(state(),1,2)});
  let sent;const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));sent=p;return response(reply('a',2,modern,{roll:{kind:4,value:1}}));}));await r.login('fixture-user','fixture-password');
  const result=await r.action({type:'ROLL_CATEGORY',roundId:'onde-1',value:6,actor:'b',hand:['spoiler'],at:'forged'});check(()=>assert.deepEqual(sent.action,{type:'ROLL_CATEGORY',roundId:'onde-1'}));check(()=>assert.equal(sent.gameVersion,8));check(()=>assert.match(sent.requestId,/^[0-9a-f-]{36}$/));check(()=>assert.deepEqual(result.roll,{kind:4,value:1}));check(()=>assert.equal(result.state.round.categoryId,'complicite'));check(()=>assert.equal(r.snapshot.roll,undefined));
  await assert.rejects(r.action({type:'RESET',roundId:'onde-1'}),{code:'not_allowed'});
 }
 // An older protocol command is discarded before validating retired types or sending any mutation.
 {
  for(const version of [undefined,1,2,3,4,5])for(const type of ['ROLL_CATEGORY','SEND','SEND_DAILY','ACCEPT','PASS','PRESS']){
   const storage=memory(),calls=[];
   const r=create(config,env(async(url,options)=>{const p=payload(options);calls.push(p);if(p.op==='login')return response(loginReply(options));if(p.op==='action')return response({error:{code:'upgrade_required'}},409);return response(reply('a',9));},storage));
   await r.login('fixture-user','fixture-password');calls.length=0;
   const requestId=webcrypto.randomUUID();storage.setItem('desir-connection-v1-action',JSON.stringify({version:1,gameVersion:version,endpoint,roomId,actor:'a',requestId,action:{type,roundId:'onde-1'}}));
   await r.refresh();
   check(()=>{assert.deepEqual(calls.map(call=>[call.op,call.gameVersion]),[['state',8]]);assert.equal(storage.getItem('desir-connection-v1-action'),null);assert.equal(r.snapshot.revision,9);assert.equal(r.snapshot.state.phase,'category');assert.equal(r.authenticated,true);});
  }
 }
 // The refusal submits only its task identity; the authoritative D20 result is used unchanged.
 {
  let sent;const storage=memory();
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'b'));sent=p;return response(reply('b',2,state('b'),{roll:{kind:20,value:20}}));},storage));
  await r.login('fixture-user','fixture-password');
  const result=await r.action({type:'REFUSE_TASK',roundId:'onde-2',taskId:'onde-1',starCost:1,value:1,actor:'a',penalty:4});
  check(()=>{assert.deepEqual(sent.action,{type:'REFUSE_TASK',roundId:'onde-2',taskId:'onde-1',starCost:1});assert.equal(sent.gameVersion,8);assert.deepEqual(result.roll,{kind:20,value:20});assert.equal(storage.getItem('desir-connection-v1-action'),null);});
  for(const type of ['ACCEPT','PASS','SEND_DAILY'])await assert.rejects(r.action({type,roundId:'onde-2'}),{code:'not_allowed'});
  await assert.rejects(r.action({type:'REFUSE_TASK',roundId:'onde-2',taskId:'invalid'}),{code:'invalid_action'});
 }
 // The transport submits a variant intent, and uses only the returned face.
 {
  let game=G.reduce(state(),{type:'ROLL_CATEGORY',value:1,catalogueVersion:2,hand:G.drawHand(state(),1,2)});
  game=G.reduce(game,{type:'ROLL_CARD',value:2});let sent;
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'a',1,game));sent=p;return response(reply('a',2,G.reduce(game,{type:'ROLL_VARIANT',value:6}),{roll:{kind:6,value:6}}));}));
  await r.login('fixture-user','fixture-password');
  const result=await r.action({type:'ROLL_VARIANT',roundId:'onde-1',value:1,variantRoll:1});
  check(()=>assert.deepEqual(sent.action,{type:'ROLL_VARIANT',roundId:'onde-1'}));check(()=>assert.equal(sent.gameVersion,8));check(()=>assert.equal(result.state.round.variantRoll,6));check(()=>assert.equal(result.state.phase,'draft'));check(()=>assert.equal(G.getVariant(result.state.round),G.getCard(game.round.cardId).variants[5]));
 }
 // A reroll carries only its intent; the server owns the new D6 face and state.
 {
  const draft=drafted(),rerolled=G.reduce(draft,{type:'REROLL_CARD',value:2});let sent;
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'a',1,draft));sent=p;return response(reply('a',2,rerolled,{roll:{kind:6,value:2},quota:{remaining:0,window:'morning',label:'Matin',nextAt:'2026-11-02T11:00:00.000Z'}}));}));await r.login('fixture-user','fixture-password');
  const result=await r.action({type:'REROLL_CARD',roundId:'onde-1',value:4,actor:'b',previousCardId:'forged',cardRerolled:false,hand:['spoiler'],hp:0});
  check(()=>assert.deepEqual(sent.action,{type:'REROLL_CARD',roundId:'onde-1'}));check(()=>assert.deepEqual(result.roll,{kind:6,value:2}));check(()=>assert.notEqual(result.state.round.cardId,draft.round.cardId));check(()=>assert.equal(result.state.round.cardRerolled,true));check(()=>assert.equal(result.quota.remaining,0));check(()=>assert.equal(r.snapshot.roll,undefined));
 }
 // A reroll already taken on another device integrates the new state without a connection failure.
 {
  const draft=drafted(),rerolled=G.reduce(draft,{type:'REROLL_CARD',value:3}),storage=memory();let calls=0;
  const r=create(config,env(async(url,options)=>{if(payload(options).op==='login')return response(loginReply(options,'a',1,draft));calls++;return response({...reply('a',2,rerolled),error:{code:'invalid_phase'}},409);},storage));await r.login('fixture-user','fixture-password');
  await assert.rejects(r.action({type:'REROLL_CARD',roundId:'onde-1'}),{code:'invalid_phase'});check(()=>assert.equal(calls,1));check(()=>assert.equal(r.status.phase,'connected'));check(()=>assert.equal(r.snapshot.state.round.cardRerolled,true));check(()=>assert.equal(storage.getItem('desir-connection-v1-action'),null));
 }
 // Delayed refresh cannot overwrite a more recent action response.
 {
  let release;const delayed=new Promise(resolve=>release=resolve);const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='state'){await delayed;return response(reply('a',1));}return response(reply('a',2,drawn(),{roll:{kind:6,value:1}}));}));await r.login('fixture-user','fixture-password');const old=r.refresh();await tick();await r.action({type:'ROLL_CATEGORY',roundId:'onde-1'});release();const current=await old;check(()=>assert.equal(current.revision,2));check(()=>assert.equal(r.snapshot.state.phase,'card'));
 }
 // A conflict is integrated once, rejected to the caller, and not automatically replayed.
 {
  let actions=0;const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='action'){actions++;return response({...reply('a',2,drawn()),error:{code:'conflict'}},409);}return response(reply('a',2,drawn()));}));await r.login('fixture-user','fixture-password');let error;try{await r.action({type:'ROLL_CATEGORY',roundId:'onde-1'});}catch(e){error=e;}check(()=>assert.equal(error.code,'conflict'));check(()=>assert.equal(error.snapshot.revision,2));check(()=>assert.equal(actions,1));check(()=>assert.equal(r.snapshot.state.phase,'card'));let recovered=false;r.subscribeToChanges(e=>{if(e.status.phase==='connected')recovered=true;});await r.refresh();check(()=>assert.equal(recovered,true));
 }
 // An obsolete invitation is a synchronized game update, not a lost connection.
 {
  const storage=memory();let actions=0;
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));actions++;return response({...reply('a',2,drawn()),error:{code:'stale_round'}},409);},storage));await r.login('fixture-user','fixture-password');
  await assert.rejects(r.action({type:'REFUSE_TASK',roundId:'onde-1',taskId:'onde-2',starCost:1}),{code:'stale_round'});
  check(()=>assert.equal(actions,1));check(()=>assert.equal(r.snapshot.revision,2));check(()=>assert.equal(r.status.phase,'connected'));check(()=>assert.equal(r.authenticated,true));check(()=>assert.equal(storage.getItem('desir-connection-v1-action'),null));check(()=>assert.match(r.status.message,/actualisée/));
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
  const fetcher=async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='action'){ids.push(p.requestId);if(!receipts.has(p.requestId)){commits++;receipts.set(p.requestId,reply('a',2,drawn(),{roll:{kind:4,value:1}}));}if(fail)throw Error('lost');return response(receipts.get(p.requestId));}return response(reply('a',2,drawn()));};
  const r=create(config,env(fetcher,storage));await r.login('fixture-user','fixture-password');await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{code:'offline'});check(()=>assert.ok(storage.getItem('desir-connection-v1-action')));fail=false;const next=create(config,env(fetcher,storage));await next.restore();check(()=>assert.equal(commits,1));check(()=>assert.equal(new Set(ids).size,1));check(()=>assert.equal(next.snapshot.state.phase,'card'));check(()=>assert.equal(storage.getItem('desir-connection-v1-action'),null));
 }
 // Losing a committed reroll response never requests a different replacement card after reload.
 {
  const storage=memory(),ids=[],receipts=new Map();let fail=true,commits=0,authoritative=drafted();
  const fetcher=async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options,'a',1,authoritative));if(p.op==='action'){
   ids.push(p.requestId);check(()=>assert.deepEqual(p.action,{type:'REROLL_CARD',roundId:'onde-1'}));
   if(!receipts.has(p.requestId)){commits++;authoritative=G.reduce(authoritative,{type:'REROLL_CARD',value:3});receipts.set(p.requestId,reply('a',2,authoritative,{roll:{kind:6,value:3},quota:{remaining:0,window:'morning',label:'Matin',nextAt:'2026-11-02T11:00:00.000Z'}}));}
   if(fail)throw Error('lost reroll response');return response(receipts.get(p.requestId));
  }return response(reply('a',2,authoritative));};
  const r=create(config,env(fetcher,storage));await r.login('fixture-user','fixture-password');await assert.rejects(r.action({type:'REROLL_CARD',roundId:'onde-1',value:4}),{code:'offline'});check(()=>assert.equal(commits,1));check(()=>assert.ok(storage.getItem('desir-connection-v1-action')));
  fail=false;const recovered=create(config,env(fetcher,storage));await recovered.restore();check(()=>assert.equal(commits,1));check(()=>assert.equal(new Set(ids).size,1));check(()=>assert.equal(recovered.snapshot.state.round.cardRoll,3));check(()=>assert.equal(recovered.snapshot.state.round.cardRerolled,true));check(()=>assert.equal(storage.getItem('desir-connection-v1-action'),null));
 }
 // Permission request is initiated by the click before asynchronous notification preparation.
 {
  const calls=[],key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url');let subscription=null;const Notification={permission:'default',requestPermission(){calls.push('permission');this.permission='granted';return Promise.resolve('granted');}};
  const pushManager={async getSubscription(){return subscription;},async subscribe(options){calls.push('subscribe-browser');check(()=>assert.equal(options.userVisibleOnly,true));check(()=>assert.equal(options.applicationServerKey.length,65));subscription={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'fixture',auth:'fixture'}})};return subscription;}};
  const serviceWorker={...eventTarget(),async register(url,options){calls.push('register');check(()=>assert.equal(url,'https://cgiy.github.io/desir/demo-des/sw.js'));check(()=>assert.equal(options.scope,'/desir/demo-des/'));return {active:{},pushManager};}};
  const environment=env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='push_config'){calls.push('config');return response({vapidPublicKey:key});}if(p.op==='subscribe'){calls.push('subscribe-server');check(()=>assert.equal(p.subscription.endpoint,'https://web.push.apple.com/test'));return response({ok:true});}return response(reply());},memory(),{Notification,PushManager:function(){},navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-user','fixture-password');await r.prepareNotifications();calls.length=0;const work=r.enableNotifications();check(()=>assert.equal(calls[0],'permission'));await work;check(()=>assert.equal(r.notificationStatus.subscribed,true));check(()=>assert.equal(r.notificationStatus.permission,'granted'));check(()=>assert.ok(calls.includes('subscribe-server')));
 }
 // iOS outside the Home Screen never opens a permission prompt.
 {
  let prompts=0;const Notification={permission:'default',requestPermission(){prompts++;return Promise.resolve('granted');}};const r=create(config,env(async(url,options)=>response(loginReply(options)),memory(),{Notification,PushManager:function(){},navigator:{userAgent:'iPhone',standalone:false,serviceWorker:{register(){throw Error('must not register');}}}}));await r.login('fixture-user','fixture-password');await assert.rejects(r.enableNotifications(),{code:'install_required'});check(()=>assert.equal(prompts,0));check(()=>assert.equal(r.notificationStatus.supported,false));
 }
 // A suspended retry does not hide the current state or send a second command.
 {
  const storage=memory(),sent=[];let fail=true,releaseRecovery,committed=false;
  const fetcher=async(url,options)=>{const p=payload(options);sent.push(p);if(p.op==='login')return response(loginReply(options));
   if(p.op==='action'){if(fail)return response({error:{code:'server_error'}},503);return new Promise(resolve=>{releaseRecovery=()=>{committed=true;resolve(response(reply('a',2,drawn())));};});}
   return response(reply('a',committed?2:1,committed?drawn():state()));};
  const r=create(config,env(fetcher,storage));await r.login('fixture-user','fixture-password');
  await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{status:503});fail=false;
  const saved=JSON.parse(storage.getItem('desir-connection-v1-action')),fresh=await r.refresh();
  check(()=>{assert.equal(fresh.revision,1);assert.equal(typeof releaseRecovery,'function');assert.equal(r.status.errorCode,'pending_action');});
  await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{code:'pending_action'});
  releaseRecovery();await tick();await tick();
  check(()=>{assert.equal(r.snapshot.revision,2);assert.equal(storage.getItem('desir-connection-v1-action'),null);assert.equal(new Set(sent.filter(p=>p.op==='action').map(p=>p.requestId)).size,1);assert.equal(saved.requestId,sent.find(p=>p.op==='action').requestId);});
 }
 // Each stalled attempt is bounded and retains the same recoverable request ID.
 {
  const storage=memory(),ids=[];const r=create({...config,requestTimeoutMs:20},env(async(url,options)=>{
   const p=payload(options);if(p.op==='login')return response(loginReply(options));ids.push(p.requestId);
   return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  },storage));await r.login('fixture-user','fixture-password');
  await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{code:'offline'});
  check(()=>{assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);assert.equal(JSON.parse(storage.getItem('desir-connection-v1-action')).requestId,ids[0]);});
 }
 // A lost logout response followed by unauthorized proves the current session is gone.
 {
  const storage=memory();let attempts=0;
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));
   assert.equal(p.op,'revoke_sessions');assert.equal(p.scope,'current');if(++attempts===1)throw Error('response lost');return response({error:{code:'unauthorized'}},401);
  },storage));await r.login('fixture-user','fixture-password');await r.logout();
  check(()=>{assert.equal(attempts,2);assert.equal(r.authenticated,false);assert.equal(r.connection,null);assert.equal(r.snapshot,null);assert.equal(storage.getItem('desir-connection-v1'),null);});
  const offline=memory(),disconnected=create(config,env(async(url,options)=>payload(options).op==='login'?response(loginReply(options)):Promise.reject(Error('offline')),offline));
  await disconnected.login('fixture-user','fixture-password');await assert.rejects(disconnected.logout(),{code:'offline'});
  check(()=>{assert.equal(disconnected.authenticated,true);assert.ok(offline.getItem('desir-connection-v1'));});
 }
 // A late state read cannot restore a locally revoked session; other-device revocation keeps it.
 {
  const storage=memory();let releaseRead,scope;
  const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));
   if(p.op==='state')return new Promise(resolve=>{releaseRead=()=>resolve(response(reply('a',2,drawn())));});
   if(p.op==='revoke_sessions'){scope=p.scope;return response({revoked:true});}throw Error('unexpected operation');},storage));
  await r.login('fixture-user','fixture-password');await r.revokeOtherDevices();check(()=>{assert.equal(scope,'others');assert.equal(r.authenticated,true);assert.ok(storage.getItem('desir-connection-v1'));});
  const read=r.refresh();await tick();await r.logout();check(()=>{assert.equal(scope,'current');assert.equal(r.authenticated,false);assert.equal(r.snapshot,null);});
  releaseRead();await assert.rejects(read,{code:'connection_changed'});check(()=>{assert.equal(r.snapshot,null);assert.equal(r.connection,null);assert.equal(storage.getItem('desir-connection-v1'),null);});
 }
 // Revocation cannot discard a previously unconfirmed command.
 {
  const storage=memory();let revocations=0;const r=create(config,env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='revoke_sessions'){revocations++;return response({revoked:true});}return response({error:{code:'server_error'}},503);},storage));
  await r.login('fixture-user','fixture-password');await assert.rejects(r.action({type:'ROLL_CATEGORY',roundId:'onde-1'}),{status:503});const journal=storage.getItem('desir-connection-v1-action');
  await assert.rejects(r.logout(),{code:'pending_action'});await assert.rejects(r.revokeOtherDevices(),{code:'pending_action'});
  check(()=>{assert.equal(revocations,0);assert.equal(storage.getItem('desir-connection-v1-action'),journal);assert.equal(r.authenticated,true);});
 }
 // A lost push subscription is shown immediately and a renewed subscription is re-registered.
 {
  let subscription={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'fixture',auth:'fixture'}})},sent=0,browserSubscribe=0;
  const key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),Notification={permission:'granted'};
  const serviceWorker={...eventTarget(),async register(){return {active:{},pushManager:{async getSubscription(){return subscription;},async subscribe(){browserSubscribe++;return subscription;}}};}};
  const environment=env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='push_config')return response({vapidPublicKey:key});if(p.op==='subscribe'){sent++;return response({ok:true});}return response(reply());},memory(),{Notification,PushManager:function(){},navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-user','fixture-password');await r.prepareNotifications();r.start();
  check(()=>assert.equal(r.notificationStatus.subscribed,true));subscription=null;serviceWorker.emit('message',{data:{type:'desir-subscription-changed'}});await tick();await tick();
  check(()=>{assert.equal(r.notificationStatus.subscribed,false);assert.equal(r.notificationStatus.reason,'subscription_missing');assert.match(r.notificationStatus.message,/réactivées/);assert.equal(browserSubscribe,0);});
  subscription={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'new',auth:'fixture'}})};const before=sent;serviceWorker.emit('message',{data:{type:'desir-subscription-changed'}});await tick();await tick();
  check(()=>{assert.equal(r.notificationStatus.subscribed,true);assert.equal(sent,before+1);assert.equal(browserSubscribe,0);});
  Notification.permission='denied';environment.document.emit('visibilitychange');await tick();
  check(()=>{assert.equal(r.notificationStatus.subscribed,false);assert.equal(r.notificationStatus.permission,'denied');});r.stop();
 }
 // Subscription changes during a pending registration are checked again after it settles.
 {
  let current={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'fixture',auth:'fixture'}})},releaseSubscribe,subscribeCount=0;
  const key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),Notification={permission:'granted'};
  const serviceWorker={...eventTarget(),async register(){return {active:{},pushManager:{async getSubscription(){return current;}}};}};
  const environment=env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='push_config')return response({vapidPublicKey:key});if(p.op==='subscribe'&&++subscribeCount===1)return new Promise(resolve=>{releaseSubscribe=()=>resolve(response({ok:true}));});return response(reply());},memory(),{Notification,PushManager:function(){},navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-user','fixture-password');r.start();await tick();check(()=>assert.equal(typeof releaseSubscribe,'function'));
  current=null;serviceWorker.emit('message',{data:{type:'desir-subscription-changed'}});releaseSubscribe();await tick();await tick();
  check(()=>{assert.equal(r.notificationStatus.subscribed,false);assert.equal(r.notificationStatus.reason,'subscription_missing');});r.stop();
 }
 // A delayed subscription response cannot change the next account's notification status.
 {
  let current=null,releaseOld,subscribeCount=0,loginCount=0;const seenTokens=[];
  const key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),Notification={permission:'granted'};
  const serviceWorker={...eventTarget(),async register(){return {active:{},pushManager:{async getSubscription(){return current;},async subscribe(){current={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'fixture',auth:'fixture'}})};return current;}}};}};
  const environment=env(async(url,options)=>{const p=payload(options);if(p.op==='login'){loginCount++;return response(loginReply(options,loginCount===1?'a':'b',1,state(loginCount===1?'a':'b')));}if(p.op==='push_config')return response({vapidPublicKey:key});if(p.op==='revoke_sessions')return response({revoked:true});if(p.op==='subscribe'){seenTokens.push(options.headers.Authorization);if(++subscribeCount===1)return new Promise(resolve=>{releaseOld=()=>resolve(response({ok:true}));});return response({ok:true});}return response(reply());},memory(),{Notification,PushManager:function(){},navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-a','fixture-password');await r.prepareNotifications();
  const old=r.enableNotifications();await tick();check(()=>assert.equal(typeof releaseOld,'function'));
  await r.logout();await r.login('fixture-b','fixture-password');await r.prepareNotifications();const nextStatus=r.notificationStatus;
  releaseOld();await assert.rejects(old,{code:'connection_changed'});
  check(()=>{assert.equal(r.connection.actor,'b');assert.deepEqual(r.notificationStatus,nextStatus);assert.equal(r.notificationStatus.subscribed,true);assert.notEqual(seenTokens[0],seenTokens[1]);});
 }
 // Failed registration of a renewed push endpoint is not reported as active, and is retried.
 {
  let fail='',current={toJSON:()=>({endpoint:'https://web.push.apple.com/first',keys:{p256dh:'fixture',auth:'fixture'}})};
  const key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),Notification={permission:'granted'};
  const serviceWorker={...eventTarget(),async register(){return {active:{},pushManager:{async getSubscription(){return current;}}};}};
  const environment=env(async(url,options)=>{const p=payload(options);if(p.op==='login')return response(loginReply(options));if(p.op==='push_config')return fail==='config'?response({error:{code:'server_error'}},503):response({vapidPublicKey:key});if(p.op==='subscribe')return fail==='subscribe'?response({error:{code:'server_error'}},503):response({ok:true});return response(reply());},memory(),{Notification,PushManager:function(){},navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-user','fixture-password');await r.prepareNotifications();r.start();check(()=>assert.equal(r.notificationStatus.subscribed,true));
  current={toJSON:()=>({endpoint:'https://web.push.apple.com/renewed',keys:{p256dh:'fixture',auth:'fixture'}})};fail='config';serviceWorker.emit('message',{data:{type:'desir-subscription-changed'}});await tick();await tick();
  check(()=>{assert.equal(r.notificationStatus.subscribed,false);assert.equal(r.notificationStatus.reason,'subscription_sync');assert.match(r.notificationStatus.message,/attente de synchronisation/);});
  fail='subscribe';environment.document.emit('visibilitychange');await tick();await tick();check(()=>{assert.equal(r.notificationStatus.subscribed,false);assert.equal(r.notificationStatus.reason,'subscription_sync');});
  fail='';environment.document.emit('visibilitychange');await tick();await tick();check(()=>{assert.equal(r.notificationStatus.subscribed,true);assert.equal(r.notificationStatus.reason,null);});r.stop();
 }
 // A new account rechecks notifications after an older account's preparation finishes.
 {
  let releaseOld,loginCount=0,configCount=0;const tokens=[];
  const key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),Notification={permission:'granted'},subscription={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'fixture',auth:'fixture'}})};
  const serviceWorker={...eventTarget(),async register(){return {active:{},pushManager:{async getSubscription(){return subscription;}}};}};
  const environment=env(async(url,options)=>{const p=payload(options);if(p.op==='login'){loginCount++;return response(loginReply(options,loginCount===1?'a':'b',1,state(loginCount===1?'a':'b')));}if(p.op==='push_config'){tokens.push(options.headers.Authorization);if(++configCount===1)return new Promise(resolve=>{releaseOld=()=>resolve(response({vapidPublicKey:key}));});return response({vapidPublicKey:key});}if(p.op==='revoke_sessions')return response({revoked:true});if(p.op==='subscribe')return response({ok:true});return response(reply());},memory(),{Notification,PushManager:function(){},navigator:{serviceWorker,userAgent:'Test Browser'}});
  const r=create(config,environment);await r.login('fixture-a','fixture-password');await tick();check(()=>assert.equal(typeof releaseOld,'function'));
  await r.logout();await r.login('fixture-b','fixture-password');releaseOld();await tick();await tick();await tick();
  check(()=>{assert.equal(r.connection.actor,'b');assert.equal(r.notificationStatus.subscribed,true);assert.equal(tokens.length,2);assert.notEqual(tokens[0],tokens[1]);});
 }
 // Background tabs do not poll; returning to the tab performs a refresh.
 {
  let states=0;const environment=env(async(url,options)=>{if(payload(options).op==='login')return response(loginReply(options));states++;return response(reply());});const r=create(config,environment);await r.login('fixture-user','fixture-password');r.start();environment.document.hidden=true;environment.intervals[0]();await tick();check(()=>assert.equal(states,0));environment.document.hidden=false;environment.document.emit('visibilitychange');await tick();check(()=>assert.equal(states,1));r.stop();
 }
 console.log(`Dés·ir remote transport: ${checks} targeted checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
