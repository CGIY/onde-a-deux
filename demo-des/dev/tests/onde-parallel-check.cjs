'use strict';
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
const at='2026-11-05T12:00:00.000Z';
const later='2026-11-05T12:20:00.000Z';
const clone=value=>JSON.parse(JSON.stringify(value));
let checks=0;
function check(fn){fn();checks++;}
function act(room,actor,type,fields={}){
 const action={type,actor,at,roundId:room.lanes[actor].round.id,...fields};
 const before=JSON.stringify(room),next=G.reduceRoom(room,action);
 check(()=>assert.notEqual(next,room,type+' must take effect'));
 check(()=>assert.equal(G.validateRoom(next),true,type+' produces a valid room'));
 check(()=>assert.equal(JSON.stringify(room),before,type+' does not mutate its input'));
 return next;
}
function blocked(room,actor,type,fields={}){
 check(()=>assert.equal(G.reduceRoom(room,{type,actor,at,roundId:room.lanes[actor].round.id,...fields}),room,type+' is blocked'));
}
function draw(room,actor,category=1){
 const view=G.roomView(room,actor),hand=G.drawHand(view,category,2);
 room=act(room,actor,'ROLL_CATEGORY',{catalogueVersion:2,value:category,hand});
 room=act(room,actor,'ROLL_CARD',{value:1});
 return act(room,actor,'ROLL_VARIANT',{value:1});
}
function accept(room,owner,acceptedAt=at){
 room=draw(room,owner);
 const invitationId=room.lanes[owner].round.id;
 room=act(room,owner,'SEND');
 return act(room,G.otherPlayer(owner),'ACCEPT',{roundId:invitationId,at:acceptedAt});
}

let room=G.createRoom({at});
check(()=>assert.equal(G.validateRoom(room),true));
check(()=>assert.equal(room.sequence,2));
check(()=>assert.equal(room.lanes.a.round.id,'onde-1'));
check(()=>assert.equal(room.lanes.b.round.id,'onde-2'));
check(()=>assert.equal(G.normalizeRoom(room),room));
check(()=>assert.equal(G.normalizeRoom(clone(room)).sequence,2));
for(const actor of ['a','b']){
 const view=G.roomView(room,actor);
 check(()=>assert.equal(view.round.from,actor));
 check(()=>assert.equal(view.activePlayer,actor));
 check(()=>assert.equal(G.validateState(view),true));
 view.players[0].name='Changed copy';
 check(()=>assert.notEqual(room.players[0].name,'Changed copy'));
 blocked(room,actor,'ROLL_CATEGORY',{roundId:room.lanes[G.otherPlayer(actor)].round.id,catalogueVersion:2,value:1,hand:G.drawHand(view,1,2)});
}
check(()=>assert.equal(G.roomView(room,'a','onde-99'),null));
check(()=>assert.equal(G.roomView(room,'x'),null));
const withPreferences=act(room,'a','SET_PREFS',{roundId:room.lanes.b.round.id,patch:{sound:true}});
check(()=>assert.equal(withPreferences.prefs.sound,true));
check(()=>assert.deepEqual(withPreferences.lanes,room.lanes));
for(const corrupt of [
 r=>{r.lanes.b.round.id=r.lanes.a.round.id;},
 r=>{r.lanes.b.round.from='a';},
 r=>{r.sequence=1;},
 r=>{r.lanes.c=clone(r.lanes.a);},
 r=>{r.lanes.b.round.id='onde-0';},
 r=>{r.lanes.b.round.id='onde-0002';},
 r=>{r.lanes.b.round.id='onde-9007199254740992';}
]){
 const bad=clone(room);corrupt(bad);
 check(()=>assert.equal(G.validateRoom(bad),false));
 check(()=>assert.equal(G.normalizeRoom(bad),null));
}

// Sending an invitation frees the sender's active lane immediately; the recipient can answer it later.
for(const order of [['a','b'],['b','a']]){
 let current=G.createRoom({at});
 const reserved=clone(current.lanes[order[1]]);
 current=draw(current,order[0],1);
 check(()=>assert.deepEqual(current.lanes[order[1]],reserved));
 const first=clone(current.lanes[order[0]]);
 current=draw(current,order[1],2);
 check(()=>assert.deepEqual(current.lanes[order[0]],first));
 check(()=>assert.equal(current.lanes.a.phase,'draft'));
 check(()=>assert.equal(current.lanes.b.phase,'draft'));
 check(()=>assert.notEqual(current.lanes.a.round.id,current.lanes.b.round.id));
 blocked(current,order[0],'NEW_ROUND');
 const roundId=current.lanes[order[0]].round.id;
 const otherDraft=clone(current.lanes[order[1]]);
 blocked(current,order[1],'SEND',{roundId});
 current=act(current,order[0],'SEND');
 check(()=>assert.equal(current.pendingRounds.length,1));
 check(()=>assert.equal(current.pendingRounds[0].round.id,roundId));
 check(()=>assert.equal(current.lanes[order[0]].phase,'category'));
 check(()=>assert.equal(current.lanes[order[0]].round.id,'onde-3'));
 check(()=>assert.deepEqual(current.lanes[order[1]],otherDraft));
 const ownView=G.roomView(current,order[0]),hand=G.drawHand(ownView,2,2);
 current=act(current,order[0],'ROLL_CATEGORY',{catalogueVersion:2,value:2,hand});
 const nextDraw=clone(current.lanes[order[0]]);
 current=act(current,order[1],'ACCEPT',{roundId});
 check(()=>assert.equal(current.pendingRounds.length,0));
 check(()=>assert.deepEqual(current.lanes[order[0]],nextDraw));
 check(()=>assert.deepEqual(current.lanes[order[1]],otherDraft));
 check(()=>assert.equal(current.tasks.length,1));
 check(()=>assert.equal(current.tasks[0].id,roundId));
 blocked(current,order[1],'NEW_ROUND');
 blocked(current,order[0],'ROLL_VARIANT',{roundId:current.lanes[order[0]].round.id,value:1});
}

// Multiple invitations remain addressable while their owner keeps drawing.
let queued=G.createRoom({at});
queued=draw(queued,'a');
const inviteOne=queued.lanes.a.round.id;
queued=act(queued,'a','SEND');
queued=draw(queued,'a',2);
const inviteTwo=queued.lanes.a.round.id;
queued=act(queued,'a','SEND');
check(()=>assert.deepEqual(queued.pendingRounds.map(item=>item.round.id),[inviteOne,inviteTwo]));
queued=act(queued,'b','ACCEPT',{roundId:inviteOne});
check(()=>assert.deepEqual(queued.pendingRounds.map(item=>item.round.id),[inviteTwo]));
check(()=>assert.equal(queued.tasks[0].id,inviteOne));
check(()=>assert.equal(queued.lanes.a.phase,'category'));

// Accepting an invitation leaves the recipient's private draft untouched; either response closes only that invitation.
room=draw(G.createRoom({at}),'a');
room=draw(room,'b',2);
const bDraft=clone(room.lanes.b),aId=room.lanes.a.round.id;
room=act(room,'a','SEND');
check(()=>assert.deepEqual(room.lanes.b,bDraft));
check(()=>assert.equal(room.lanes.a.phase,'category'));
room=act(room,'b','ACCEPT',{roundId:aId});
check(()=>assert.equal(room.lanes.a.phase,'category'));
check(()=>assert.deepEqual(room.lanes.b,bDraft));
check(()=>assert.equal(room.tasks.length,1));
blocked(room,'a','PASS',{roundId:aId});
let stopRoom=draw(G.createRoom({at}),'a');
const stopId=stopRoom.lanes.a.round.id;
stopRoom=act(stopRoom,'a','SEND');
blocked(stopRoom,'a','PASS',{roundId:stopId});
stopRoom=act(stopRoom,'b','PASS',{roundId:stopId});
check(()=>assert.equal(stopRoom.lanes.a.phase,'category'));
check(()=>assert.equal(stopRoom.pendingRounds.length,0));
check(()=>assert.equal(stopRoom.history.find(round=>round.id===stopId).status,'passed'));
check(()=>assert.equal(stopRoom.stats.totalCompleted,0));
check(()=>assert.equal(stopRoom.tasks.length,0));

// Shared tasks score once while both players keep their own active lanes.
room=accept(G.createRoom({at}),'a');
room=accept(room,'b');
const taskA=room.tasks[0].id,taskB=room.tasks[1].id;
check(()=>assert.equal(room.sequence,4));
check(()=>assert.equal(room.lanes.a.phase,'category'));
check(()=>assert.equal(room.lanes.b.phase,'category'));
room=act(room,'a','TOGGLE_TASK_CHECK',{taskId:taskA,checked:true});
check(()=>assert.equal(room.stats.totalCompleted,0));
room=act(room,'b','TOGGLE_TASK_CHECK',{taskId:taskA,checked:true});
check(()=>assert.equal(room.stats.totalCompleted,1));
check(()=>assert.equal(room.tasks.length,1));
check(()=>assert.equal(room.tasks[0].id,taskB));
check(()=>assert.equal(room.lanes.a.phase,'category'));
check(()=>assert.equal(room.lanes.b.phase,'category'));
blocked(room,'b','TOGGLE_TASK_CHECK',{taskId:taskA,checked:true});
room=act(room,'b','TOGGLE_TASK_CHECK',{taskId:taskB,checked:true});
room=act(room,'a','TOGGLE_TASK_CHECK',{taskId:taskB,checked:true});
check(()=>assert.equal(room.stats.totalCompleted,2));
check(()=>assert.equal(room.tasks.length,0));
check(()=>assert.equal(room.history.filter(r=>r.status==='completed').length,2));

// Active task details remain available as newer rounds age out the history.
room=accept(G.createRoom({at}),'a');
const taskId=room.tasks[0].id;
const fullA=clone(room.history.find(round=>round.id===taskId));
for(let i=0;i<82;i++){
 room=draw(room,'b',2);
 const passedId=room.lanes.b.round.id;
 room=act(room,'b','SEND');
 room=act(room,'a','PASS',{roundId:passedId});
}
check(()=>assert.equal(room.history.length,80));
check(()=>assert.ok(room.history.some(round=>round.id===taskId)));
const archivedSource=clone(room);
const fullB=clone(room.lanes.b);
room=act(room,'a','TOGGLE_TASK_CHECK',{taskId,checked:true});
room=act(room,'b','TOGGLE_TASK_CHECK',{taskId,checked:true});
check(()=>assert.equal(room.tasks.length,0));
check(()=>assert.equal(room.history.find(round=>round.id===taskId).status,'completed'));
for(const key of ['hand','rolls','rollTokens','draftRolls','draftRollTokens','hp','variantRoll']){
 check(()=>assert.deepEqual(room.history.find(r=>r.id===taskId)[key],fullA[key]));
}
check(()=>assert.deepEqual(room.lanes.b,fullB));
const expired=act(archivedSource,'b','EXPIRE_TASKS',{at:'2026-11-06T12:00:00.000Z'});
check(()=>assert.equal(expired.tasks.length,0));
check(()=>assert.equal(expired.history.find(round=>round.id===taskId).status,'expired'));
check(()=>assert.deepEqual(expired.lanes.b,fullB));
check(()=>assert.equal(expired.stats.totalCompleted,0));

// Expiry updates the due task while both players keep drawing.
room=accept(G.createRoom({at}),'a',at);
room=accept(room,'b',later);
const taskFromA=room.tasks.find(task=>task.from==='a').id,taskFromB=room.tasks.find(task=>task.from==='b').id;
room=act(room,'b','EXPIRE_TASKS',{at:'2026-11-06T12:10:00.000Z'});
check(()=>assert.equal(room.history.find(round=>round.id===taskFromA).status,'expired'));
check(()=>assert.equal(room.history.find(round=>round.id===taskFromB).status,'queued'));
check(()=>assert.equal(room.tasks.length,1));
check(()=>assert.equal(room.tasks[0].id,taskFromB));
check(()=>assert.equal(room.stats.totalCompleted,0));
const allExpired=G.reduceRoom(room,{type:'EXPIRE_TASKS',at:'2026-11-06T12:20:00.000Z'});
check(()=>assert.equal(G.validateRoom(allExpired),true));
check(()=>assert.equal(allExpired.tasks.length,0));
check(()=>assert.equal(allExpired.history.filter(round=>round.status==='expired').length,2));

// Legacy single-round saves and room invitations migrate into the independent active lane.
function singleAct(state,type,fields={}){
 const next=G.reduce(state,{type,at,...fields});
 assert.notEqual(next,state);
 assert.equal(G.validateState(next),true);
 return next;
}
for(const owner of ['a','b']){
 let pendingRoom=draw(G.createRoom({at}),owner);
 const legacyInviteId=pendingRoom.lanes[owner].round.id;
 pendingRoom=G.reduceRoom(pendingRoom,{type:'SEND',actor:owner,at,roundId:legacyInviteId});
 const legacyPending=clone(pendingRoom);
 legacyPending.pendingRounds=[];
 legacyPending.lanes[owner]=clone({phase:'pending',round:pendingRoom.pendingRounds[0].round});
 const snapshots=[];
 let state={...G.createState(),activePlayer:owner};
 snapshots.push(state);
 state=singleAct(state,'ROLL_CATEGORY',{catalogueVersion:2,value:1,hand:G.drawHand(state,1,2)});snapshots.push(state);
 state=singleAct(state,'ROLL_CARD',{value:1});snapshots.push(state);
 state=singleAct(state,'ROLL_VARIANT',{value:1});snapshots.push(state);
 state=singleAct(state,'SEND');snapshots.push(state);
 state={...state,activePlayer:G.otherPlayer(owner)};
 state=singleAct(state,'ACCEPT');snapshots.push(state);
 const draftRoom=draw(G.createRoom({at}),owner);
 for(const [phase,baseRoom,mutate] of [
  ['draft_challenge',draftRoom,round=>{round.status='drawing';round.awaiting=owner;round.draftChallengeUsed=true;round.draftRolls=[3];round.draftRollTokens=['t'];}],
  ['challenge',legacyPending,round=>{round.status='challenge';round.challengeUsed=true;round.rolls=[1,1];round.rollTokens=['t1','t2'];}],
  ['challenge_failed',legacyPending,round=>{round.status='challenge_failed';round.challengeUsed=true;round.rolls=[1,1];round.rollTokens=['t1','t2'];}],
  ['sender_confirmation',legacyPending,round=>{round.status='sender_confirmation';round.awaiting=owner;round.toConfirmed=true;}]
 ]){
  const frozen=clone(baseRoom);
  frozen.lanes[owner].phase=phase;
  mutate(frozen.lanes[owner].round);
  const migrated=G.normalizeRoom(frozen,{at});
  check(()=>assert.equal(G.validateRoom(migrated),true,'migrated '+phase));
  if(phase==='draft_challenge'){
   check(()=>assert.deepEqual(migrated.lanes[owner],baseRoom.lanes[owner],phase+' becomes the clean equivalent lane'));
  }else{
   check(()=>assert.equal(migrated.pendingRounds.length,1,phase+' remains an invitation'));
   check(()=>assert.equal(migrated.pendingRounds[0].round.id,legacyInviteId));
   check(()=>assert.equal(migrated.pendingRounds[0].round.status,'pending'));
   check(()=>assert.equal(migrated.lanes[owner].phase,'category'));
  }
  check(()=>assert.equal(G.normalizeRoom(migrated,{at}),migrated,'migration is idempotent'));
 }
 for(const snapshot of snapshots){
  const old=clone(snapshot);old.players=[{id:'a',name:'Alpha'},{id:'b',name:'Bravo'}];old.prefs.sound=true;
  const before=JSON.stringify(old),migrated=G.normalizeRoom(old,{at});
  check(()=>assert.equal(G.validateRoom(migrated),true));
  check(()=>assert.equal(JSON.stringify(old),before));
  check(()=>assert.equal(migrated.sequence,old.sequence+(old.phase==='pending'?2:1)));
  if(old.phase==='pending'){
   check(()=>assert.equal(migrated.lanes[old.round.from].phase,'category'));
   check(()=>assert.equal(migrated.pendingRounds[0].round.id,old.round.id));
  }else{
   check(()=>assert.deepEqual(migrated.lanes[old.round.from],{phase:old.phase,round:old.round}));
  }
  for(const key of ['players','prefs','history','stats','tasks','seen','favorites'])check(()=>assert.deepEqual(migrated[key],old[key]));
  check(()=>assert.equal(migrated.lanes[G.otherPlayer(old.round.from)].phase,'category'));
  check(()=>assert.equal(G.normalizeRoom(migrated),migrated));
 }
}

// A legacy exhausted counter remains readable, with no possible new-round allocation.
const exhausted=G.createState();exhausted.sequence=Number.MAX_SAFE_INTEGER;exhausted.round.id='onde-'+exhausted.sequence;
check(()=>assert.equal(G.validateState(exhausted),true));
const migrated=G.normalizeRoom(exhausted,{at});
check(()=>assert.equal(G.validateRoom(migrated),true));
check(()=>assert.equal(migrated.sequence,Number.MAX_SAFE_INTEGER));
check(()=>assert.equal(migrated.lanes.a.round.id,exhausted.round.id));
check(()=>assert.notEqual(migrated.lanes.a.round.id,migrated.lanes.b.round.id));
let maxRoom=draw(G.createRoom({at}),'a');maxRoom.sequence=Number.MAX_SAFE_INTEGER;
check(()=>assert.equal(G.validateRoom(maxRoom),true));
blocked(maxRoom,'a','SEND');

console.log('Dés·ir parallel room: '+checks+' state, migration, permissions, D20, shared-task and expiry assertions passed.');
