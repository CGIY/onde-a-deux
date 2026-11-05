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
 room=act(room,owner,'SEND');
 return act(room,G.otherPlayer(owner),'ACCEPT',{roundId:room.lanes[owner].round.id,at:acceptedAt});
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

// Starting either private draw leaves the partner's lane and reserved ID intact.
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
 blocked(current,order[1],'SEND',{roundId});
 current=act(current,order[0],'SEND');
 const ownDraft=clone(current.lanes[order[1]]);
 current=act(current,order[1],'ACCEPT',{roundId});
 check(()=>assert.deepEqual(current.lanes[order[1]],ownDraft));
 check(()=>assert.equal(current.lanes[order[0]].phase,'accepted'));
 check(()=>assert.equal(current.tasks.length,1));
 current=act(current,order[0],'NEW_ROUND');
 check(()=>assert.equal(current.sequence,3));
 check(()=>assert.equal(current.lanes[order[0]].round.id,'onde-3'));
 check(()=>assert.equal(current.lanes[order[0]].round.from,order[0]));
 check(()=>assert.equal(current.tasks[0].id,roundId));
 blocked(current,order[1],'NEW_ROUND',{roundId:current.lanes[order[0]].round.id});
 blocked(current,order[0],'ROLL_VARIANT',{roundId,value:1});
}

// Each initiator has a private D20; automatic proposals retain both confirmations.
room=draw(G.createRoom({at}),'a');
room=draw(room,'b',2);
const bDraft=clone(room.lanes.b),aId=room.lanes.a.round.id;
room=act(room,'a','CHALLENGE_DRAFT');
room=act(room,'a','ROLL_DRAFT_DEFENSE',{value:1,token:'a-draft-1'});
room=act(room,'a','ROLL_DRAFT_DEFENSE',{value:1,token:'a-draft-2'});
check(()=>assert.equal(room.lanes.a.round.autoProposed,true));
room=act(room,'b','ACCEPT',{roundId:aId});
check(()=>assert.equal(room.lanes.a.phase,'sender_confirmation'));
check(()=>assert.deepEqual(room.lanes.b,bDraft));
room=act(room,'a','ACCEPT');
check(()=>assert.equal(room.lanes.a.phase,'accepted'));
check(()=>assert.deepEqual(room.lanes.b,bDraft));
check(()=>assert.equal(room.tasks.length,1));

// Shared tasks score once even after both players start newer personal rounds.
room=accept(G.createRoom({at}),'a');
room=accept(room,'b');
const taskA=room.lanes.a.round.id,taskB=room.lanes.b.round.id;
room=act(room,'a','NEW_ROUND');
room=act(room,'b','NEW_ROUND');
check(()=>assert.equal(room.sequence,4));
check(()=>assert.equal(room.lanes.a.round.id,'onde-3'));
check(()=>assert.equal(room.lanes.b.round.id,'onde-4'));
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

// Completing another lane's task preserves its complete round after history eviction.
room=draw(G.createRoom({at}),'a');
room=act(room,'a','SEND');
room=act(room,'b','CHALLENGE',{roundId:room.lanes.a.round.id});
room=act(room,'b','ROLL_DEFENSE',{roundId:room.lanes.a.round.id,value:1,token:'b-defense-1'});
room=act(room,'b','ROLL_DEFENSE',{roundId:room.lanes.a.round.id,value:1,token:'b-defense-2'});
room=act(room,'b','ACCEPT',{roundId:room.lanes.a.round.id});
room=draw(room,'b',2);
room.history=[];
check(()=>assert.equal(G.validateRoom(room),true));
const archivedSource=clone(room),fullA=clone(room.lanes.a.round),fullB=clone(room.lanes.b);
room=act(room,'a','TOGGLE_TASK_CHECK',{taskId:fullA.id,checked:true});
room=act(room,'b','TOGGLE_TASK_CHECK',{taskId:fullA.id,checked:true});
check(()=>assert.equal(room.lanes.a.phase,'resolved'));
check(()=>assert.equal(room.lanes.a.round.status,'completed'));
for(const key of ['hand','rolls','rollTokens','draftRolls','draftRollTokens','hp','variantRoll']){
 check(()=>assert.deepEqual(room.lanes.a.round[key],fullA[key]));
}
check(()=>assert.deepEqual(room.lanes.b,fullB));
check(()=>assert.deepEqual(room.history.find(r=>r.id===fullA.id).rolls,[1,1]));
const expired=act(archivedSource,'b','EXPIRE_TASKS',{at:'2026-11-05T18:00:00.000Z'});
check(()=>assert.equal(expired.lanes.a.phase,'resolved'));
check(()=>assert.equal(expired.lanes.a.round.status,'expired'));
check(()=>assert.deepEqual(expired.lanes.a.round.rollTokens,fullA.rollTokens));
check(()=>assert.deepEqual(expired.lanes.b,fullB));
check(()=>assert.equal(expired.stats.totalCompleted,0));

// Expiry updates only the due task, even with two accepted lanes.
room=accept(G.createRoom({at}),'a',at);
room=accept(room,'b',later);
room=act(room,'b','EXPIRE_TASKS',{at:'2026-11-05T18:10:00.000Z'});
check(()=>assert.equal(room.lanes.a.phase,'resolved'));
check(()=>assert.equal(room.lanes.a.round.status,'expired'));
check(()=>assert.equal(room.lanes.b.phase,'accepted'));
check(()=>assert.equal(room.tasks.length,1));
check(()=>assert.equal(room.tasks[0].from,'b'));
check(()=>assert.equal(room.stats.totalCompleted,0));
const allExpired=G.reduceRoom(room,{type:'EXPIRE_TASKS',at:'2026-11-05T18:20:00.000Z'});
check(()=>assert.equal(G.validateRoom(allExpired),true));
check(()=>assert.equal(allExpired.lanes.b.phase,'resolved'));
check(()=>assert.equal(allExpired.tasks.length,0));

// Legacy single-round saves retain their exact active lane and all shared data.
function singleAct(state,type,fields={}){
 const next=G.reduce(state,{type,at,...fields});
 assert.notEqual(next,state);
 assert.equal(G.validateState(next),true);
 return next;
}
for(const owner of ['a','b']){
 const snapshots=[];
 let state={...G.createState(),activePlayer:owner};
 snapshots.push(state);
 state=singleAct(state,'ROLL_CATEGORY',{catalogueVersion:2,value:1,hand:G.drawHand(state,1,2)});snapshots.push(state);
 state=singleAct(state,'ROLL_CARD',{value:1});snapshots.push(state);
 state=singleAct(state,'ROLL_VARIANT',{value:1});snapshots.push(state);
 const draft=state;
 state=singleAct(state,'CHALLENGE_DRAFT');snapshots.push(state);
 state=singleAct(state,'ROLL_DRAFT_DEFENSE',{value:1,token:'legacy-one'});snapshots.push(state);
 state=singleAct(state,'ROLL_DRAFT_DEFENSE',{value:1,token:'legacy-two'});snapshots.push(state);
 state={...state,activePlayer:G.otherPlayer(owner)};
 state=singleAct(state,'ACCEPT');snapshots.push(state);
 state={...state,activePlayer:owner};state=singleAct(state,'ACCEPT');snapshots.push(state);
 let defended=singleAct(draft,'CHALLENGE_DRAFT');
 defended=singleAct(defended,'ROLL_DRAFT_DEFENSE',{value:20,token:'legacy-high-one'});
 defended=singleAct(defended,'ROLL_DRAFT_DEFENSE',{value:20,token:'legacy-high-two'});snapshots.push(defended);
 for(const snapshot of snapshots){
  const old=clone(snapshot);old.players=[{id:'a',name:'Alpha'},{id:'b',name:'Bravo'}];old.prefs.sound=true;
  const before=JSON.stringify(old),migrated=G.normalizeRoom(old,{at});
  check(()=>assert.equal(G.validateRoom(migrated),true));
  check(()=>assert.equal(JSON.stringify(old),before));
  check(()=>assert.equal(migrated.sequence,old.sequence+1));
  check(()=>assert.deepEqual(migrated.lanes[old.round.from],{phase:old.phase,round:old.round}));
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
let maxRoom=accept(G.createRoom({at}),'a');maxRoom.sequence=Number.MAX_SAFE_INTEGER;
check(()=>assert.equal(G.validateRoom(maxRoom),true));
blocked(maxRoom,'a','NEW_ROUND');

console.log('Dés·ir parallel room: '+checks+' state, migration, permissions, D20, shared-task and expiry assertions passed.');
