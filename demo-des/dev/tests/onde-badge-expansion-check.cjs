'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const G=require('../src/onde-app-core.js');
const at='2026-11-08T12:00:00.000Z',later='2026-11-08T12:01:00.000Z';
const copy=value=>structuredClone(value);
let checks=0;
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const ok=(value,message)=>{checks++;assert.ok(value,message);};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const added=G.badgeCatalog.slice(60),oldIds=new Set(G.badgeCatalog.slice(0,60).map(badge=>badge.id));
const viewItem=(room,id,actor='a')=>G.badgeView(room,actor).items.find(item=>item.id===id);
function step(room,type,actor='a',extra={},time=at){
  const next=G.reduceRoom(room,{type,actor,roundId:room.lanes[actor].round.id,at:time,...extra});
  ok(next!==room,'valid transition '+type);ok(G.validateRoom(next),'valid room after '+type);return next;
}
function queue(room,criterion,actor='a',time=at){
  const card=G.getCard(criterion.cardId),hardcore=card.id.startsWith('hardcore-');
  const category=G.categories.find(category=>category.id===card.categoryId);
  const prepared=G.drawCategory(G.roomView(room,actor),category.id,3,n=>hardcore?n:1);
  prepared.hand=[card.id,...(hardcore?G.hardcoreCards:G.cards).filter(other=>other.categoryId===card.categoryId&&other.id!==card.id).slice(0,5).map(other=>other.id)];
  room=step(room,'ROLL_CATEGORY',actor,{value:category.number,...prepared},time);
  room=step(room,'ROLL_CARD',actor,{value:1},time);
  if(!hardcore)room=step(room,'ROLL_VARIANT',actor,{value:criterion.variantRoll||1},time);
  const taskId=room.lanes[actor].round.id;
  room=step(room,'SEND',actor,{directQueue:true},time);return {room,taskId};
}
function complete(room,criterion,actor='a',time=at){
  const queued=queue(room,criterion,actor,time);
  room=step(queued.room,'TOGGLE_TASK_CHECK',actor,{taskId:queued.taskId,checked:true},time);
  return step(room,'TOGGLE_TASK_CHECK',G.otherPlayer(actor),{taskId:queued.taskId,checked:true},time);
}
// A faithful old registry has the same counters, but only the original awards
// and contiguous per-reader sequences. No catalogue marker existed before v6.
function legacy(room){
  const saved=copy(room),progress=saved.progression;delete progress.catalogueVersion;
  for(const id of Object.keys(progress.awards.shared))if(!oldIds.has(id))delete progress.awards.shared[id];
  for(const actor of ['a','b']){
    const awards=[...Object.values(progress.awards.individual[actor]).map(award=>({award,sequence:award.sequence,shared:false})),
      ...Object.values(progress.awards.shared).map(award=>({award,sequence:award.sequenceByActor[actor],shared:true}))].sort((a,b)=>a.sequence-b.sequence);
    awards.forEach(({award,shared},index)=>{if(shared)award.sequenceByActor[actor]=index+1;else award.sequence=index+1;});
    progress.sequences[actor]=awards.length;
  }
  ok(G.validateRoom(saved));return saved;
}
function originalAwardViews(room,actor){
  return G.badgeCatalog.slice(0,60).map(badge=>{
    const stored=badge.scope==='shared'?room.progression.awards.shared[badge.id]:room.progression.awards.individual[actor][badge.id];
    return {id:badge.id,award:stored?{id:room.progression.epoch+':'+badge.scope+':'+(badge.scope==='individual'?actor+':':'')+badge.id,
      at:stored.at,sequence:badge.scope==='shared'?stored.sequenceByActor[actor]:stored.sequence,...(stored.source?{source:stored.source}:{})}:null};
  });
}

eq(G.badgeCatalog.length,90);eq(added.length,30);
eq(digest(G.badgeCatalog.slice(0,60)),'07e582394b90cb521db7cfd3c430f2a4dbbfcd54d8c96da95c7411d7a13cdae9','all sixty published definitions are immutable');
eq(digest(added),'adc3d9c757d3bdebd462ed159f91114c3b38311a140de08bd753d1a3fd3b8303','all thirty definitions match the approved contract exactly');
eq(added.map(badge=>badge.order),Array.from({length:30},(_,index)=>index+61));
eq(added.filter(badge=>badge.criterion.variantRoll!==undefined).length,15);
eq(added.filter(badge=>badge.criterion.variantRoll===undefined).length,15);
for(const badge of added){
  eq(badge.scope,'shared');eq(badge.target,3);eq(badge.criterion.metric,'completed');eq(badge.criterion.threshold,3);
  const card=G.getCard(badge.criterion.cardId);ok(card);eq(card.categoryId,'intimite');
  if(badge.criterion.variantRoll!==undefined)ok(card.variants?.[badge.criterion.variantRoll-1]);
  else{ok(G.hardcoreCards.includes(card));eq(card.variants,undefined);}
}

// Every new definition reaches 3 only after a matching task's two checks.
// Drawing, proposing, refusing, or completing a different card/face adds zero.
for(const badge of added){
  const {criterion}=badge;
  let room=G.createRoom({at}),queued=queue(room,criterion);room=queued.room;
  eq(viewItem(room,badge.id).progress.value,0);eq(viewItem(room,badge.id).award,null);
  room=step(room,'REFUSE_TASK','b',{taskId:queued.taskId,value:20});eq(viewItem(room,badge.id).progress.value,0);
  const wrong=criterion.variantRoll===undefined?{cardId:G.hardcoreCards.find(card=>card.id!==criterion.cardId).id}:
    {...criterion,variantRoll:criterion.variantRoll===1?2:1};
  room=complete(room,wrong);eq(viewItem(room,badge.id).progress.value,0);
  for(let number=1;number<=3;number++){
    queued=queue(room,criterion,number%2?'a':'b');
    room=step(queued.room,'TOGGLE_TASK_CHECK','a',{taskId:queued.taskId,checked:true});eq(viewItem(room,badge.id).progress.value,number-1);
    room=step(room,'TOGGLE_TASK_CHECK','b',{taskId:queued.taskId,checked:true},later);eq(viewItem(room,badge.id).progress.value,number);
    eq(!!viewItem(room,badge.id).award,number===3);eq(!!viewItem(room,badge.id,'b').award,number===3);
  }
  const won=viewItem(room,badge.id).award;eq(won.source,undefined);eq(won.at,later);eq(won.id,viewItem(room,badge.id,'b').award.id);
  room=complete(room,criterion,'a',later);eq(viewItem(room,badge.id).award,won,'fourth completion does not re-award');
  eq(viewItem(room,badge.id).progress.value,4);
}

// New definitions already satisfied before the release are silently imported.
// Reading is pure; persistence on the next real event has the exact same IDs,
// null dates and per-reader ordering, without touching older awards or epoch.
for(const badge of added){
  let room=G.createRoom({at});for(let n=0;n<3;n++)room=complete(room,badge.criterion,n%2?'a':'b');
  room=legacy(room);
  const saved=copy(room),epoch=room.progression.epoch,views={},original={};
  for(const actor of ['a','b']){
    original[actor]=originalAwardViews(room,actor);views[actor]=G.badgeView(room,actor);
    ok(G.validateBadgeView(views[actor],actor));eq(views[actor].epoch,epoch);
    eq(views[actor].items.slice(0,60).map(item=>({id:item.id,award:item.award})),original[actor]);
    const imported=views[actor].items.find(item=>item.id===badge.id).award;
    eq(imported.at,null);eq(imported.source,'imported');ok(imported.sequence>saved.progression.sequences[actor]);
    eq(G.badgeView(room,actor),views[actor],'repeated projection has stable import order');
  }
  eq(room,saved,'projection never mutates the old registry');eq(room.progression.catalogueVersion,undefined);
  eq(G.normalizeRoom(room),room,'normalization does not rewrite stored gameplay');
  const queued=queue(room,badge.criterion,'a',later);room=queued.room;
  eq(room.progression.catalogueVersion,2);eq(room.progression.epoch,epoch);
  eq(room.progression.shared.completed,saved.progression.shared.completed);
  for(const actor of ['a','b']){
    eq(viewItem(room,badge.id,actor).award,views[actor].items.find(item=>item.id===badge.id).award);
    for(const old of original[actor])if(old.award)eq(viewItem(room,old.id,actor).award,old.award);
  }
  room=step(room,'TOGGLE_TASK_CHECK','a',{taskId:queued.taskId,checked:true},later);
  room=step(room,'TOGGLE_TASK_CHECK','b',{taskId:queued.taskId,checked:true},later);
  eq(viewItem(room,badge.id).progress.value,4);eq(viewItem(room,badge.id).award,views.a.items.find(item=>item.id===badge.id).award);
  const next=copy(room);eq(G.normalizeRoom(next),next);eq(G.badgeView(next,'a'),G.badgeView(room,'a'),'roundtrip does not reimport an award');
}

// An old counter at 2 reaches 3 on a real post-release completion. This must
// produce a dated gain rather than being absorbed into the silent baseline.
for(const badge of added){
  let room=G.createRoom({at});for(let n=0;n<2;n++)room=complete(room,badge.criterion);
  room=legacy(room);const epoch=G.badgeView(room,'a').epoch;
  eq(viewItem(room,badge.id).progress.value,2);eq(viewItem(room,badge.id).award,null);
  const queued=queue(room,badge.criterion,'a',later);room=queued.room;
  eq(viewItem(room,badge.id).award,null);eq(room.progression.catalogueVersion,2);
  room=step(room,'TOGGLE_TASK_CHECK','a',{taskId:queued.taskId,checked:true},later);eq(viewItem(room,badge.id).award,null);
  room=step(room,'TOGGLE_TASK_CHECK','b',{taskId:queued.taskId,checked:true},later);
  const won=viewItem(room,badge.id).award;eq(won.at,later);eq(won.source,undefined);eq(G.badgeView(room,'a').epoch,epoch);
  const duplicate=G.reduceRoom(room,{type:'TOGGLE_TASK_CHECK',actor:'b',taskId:queued.taskId,checked:true,at:later});eq(duplicate,room);
  room=complete(room,badge.criterion,'b',later);eq(viewItem(room,badge.id).award,won);
}

// Persisted counters outlive the 80-history bound. The upgrade uses their
// proven details even if all history is gone; absent details are never guessed.
let collected=G.createRoom({at});
for(const badge of added)for(let n=0;n<3;n++)collected=complete(collected,badge.criterion,n%2?'a':'b');
eq(collected.stats.totalCompleted,90);eq(collected.history.length,80);
for(const badge of added){eq(viewItem(collected,badge.id).progress.value,3);ok(viewItem(collected,badge.id).award);}
collected=legacy(collected);collected.history=[];ok(G.validateRoom(collected));
for(const actor of ['a','b']){
  const view=G.badgeView(collected,actor);ok(G.validateBadgeView(view,actor));
  eq(view.items.slice(60).filter(item=>item.award?.source==='imported'&&item.award.at===null).length,30);
}
const unknown=copy(collected);delete unknown.progression;
eq(G.badgeView(unknown,'a').items.slice(60).filter(item=>item.award).length,0,'aggregate score cannot invent card or variant details');
for(const badge of [added[0],added[15]]){
  let imported=G.createRoom({at});for(let n=0;n<3;n++)imported=complete(imported,badge.criterion);
  delete imported.progression;eq(viewItem(imported,badge.id).progress.value,3);
  eq(viewItem(imported,badge.id).award.source,'imported');eq(viewItem(imported,badge.id).award.at,null);
}
for(const invalid of [0,3,'2',null]){const broken=copy(collected);broken.progression.catalogueVersion=invalid;eq(G.validateRoom(broken),false);}
const reset=G.resetRoom(collected,{at:later});eq(reset.progression,undefined);ok(G.badgeView(reset,'a').epoch>G.badgeView(collected,'a').epoch);
eq(G.badgeView(reset,'a').items.length,90);eq(G.badgeView(reset,'a').items.filter(item=>item.award).length,0);

console.log(`Dés·ir badge expansion: ${checks} exact catalogue, card/variant thresholds, silent migration, preserved awards, live gains, cumulative imports and reset assertions passed.`);
