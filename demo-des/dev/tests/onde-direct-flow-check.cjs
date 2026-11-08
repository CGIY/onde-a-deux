'use strict';
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
const at='2026-11-08T10:00:00.000Z',later='2026-11-08T10:01:00.000Z';
let checks=0;
const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const ok=(value,message)=>{checks++;assert.ok(value,message);};
const copy=value=>structuredClone(value);
function apply(room,type,actor='a',extra={}){
 const next=G.reduceRoom(room,{type,actor,roundId:room.lanes[actor].round.id,at,...extra});
 ok(G.validateRoom(next),'valid room after '+type);return next;
}
function draft(room=G.createRoom({at}),actor='a'){
 const cat=G.categories[0];
 room=apply(room,'ROLL_CATEGORY',actor,{catalogueVersion:2,value:cat.number,hand:G.cards.filter(card=>card.categoryId===cat.id).map(card=>card.id)});
 room=apply(room,'ROLL_CARD',actor,{value:1});
 return apply(room,'ROLL_VARIANT',actor,{value:1});
}
function queue(room,actor='a'){return apply(room,'SEND',actor,{directQueue:true});}
for(const from of ['a','b']){
 const to=G.otherPlayer(from),prepared=draft(undefined,from),oldId=prepared.lanes[from].round.id,peer=copy(prepared.lanes[to]);
 const sent=queue(prepared,from);
 eq(sent.pendingRounds,[],'direct sharing never creates an invitation');
 eq(sent.tasks.length,1);eq(sent.tasks[0].id,oldId);eq(sent.tasks[0].from,from);eq(sent.tasks[0].to,to);
 eq(sent.tasks[0].createdAt,at);eq(Date.parse(sent.tasks[0].expiresAt)-Date.parse(at),G.rules.taskLifetimeMs);
 eq(sent.tasks[0].checks,{a:false,b:false});eq(sent.stats.totalCompleted,0);
 eq(sent.history[0].directQueued,true);eq(sent.history[0].toConfirmed,false,'sharing does not pretend the recipient accepted');
 eq(sent.lanes[from].phase,'category');ok(sent.lanes[from].round.id!==oldId);eq(sent.lanes[to],peer,'sharing keeps partner draw intact');
 eq(apply(sent,'SEND',from,{roundId:oldId,directQueue:true}),sent,'old send callback cannot duplicate a task');
 eq(apply(sent,'REFUSE_TASK',from,{taskId:oldId,value:12}),sent,'only the recipient uses the refusal control');
 for(const face of [0,21,1.5,null])eq(apply(sent,'REFUSE_TASK',to,{taskId:oldId,value:face}),sent,'invalid die face rejected');
 for(let value=1;value<=20;value++){
  const refused=apply(sent,'REFUSE_TASK',to,{taskId:oldId,value,at:later});
  eq(refused.tasks,[],'each D20 face honours the refusal');
  eq(refused.history[0].status,'passed');eq(refused.history[0].refusalRoll,value);eq(refused.history[0].closedBy,to);
  eq(refused.stats,sent.stats);eq(refused.lanes,sent.lanes,'refusal leaves both active draws alone');
  eq(apply(refused,'REFUSE_TASK',to,{taskId:oldId,value:20}),refused,'repeating refusal has no effect');
 }
 let checked=apply(sent,'TOGGLE_TASK_CHECK',from,{taskId:oldId,checked:true,at:later});
 eq(checked.stats.totalCompleted,0);eq(checked.tasks.length,1);
 checked=apply(checked,'TOGGLE_TASK_CHECK',to,{taskId:oldId,checked:true,at:later});
 eq(checked.stats.totalCompleted,1);eq(checked.tasks,[]);eq(checked.history[0].status,'completed');
 eq(checked.history[0].fromConfirmed,true);eq(checked.history[0].toConfirmed,true);
 const expired=apply(sent,'EXPIRE_TASKS',to,{at:'2026-11-09T10:00:00.000Z'});
 eq(expired.tasks,[]);eq(expired.stats.totalCompleted,0);eq(expired.history[0].status,'expired');
 const oldState=G.roomView(prepared,from),direct=G.reduce(oldState,{type:'SEND',directQueue:true,at});
 ok(G.validateState(direct));eq(direct.phase,'accepted');eq(direct.round.toConfirmed,false);

 // A valid task can outlive its bounded history entry. Missing history must
 // never manufacture recipient agreement when the task is refused or expires.
 const withoutHistory=copy(sent);withoutHistory.history=[];
 ok(G.validateRoom(withoutHistory));
 const refusedWithoutHistory=apply(withoutHistory,'REFUSE_TASK',to,{taskId:oldId,value:8,at:later});
 eq(refusedWithoutHistory.tasks,[]);eq(refusedWithoutHistory.history[0].toConfirmed,false);
 const expiredWithoutHistory=apply(withoutHistory,'EXPIRE_TASKS',to,{at:'2026-11-09T10:00:00.000Z'});
 eq(expiredWithoutHistory.tasks,[]);eq(expiredWithoutHistory.history[0].toConfirmed,false);

 // Historical accepted lanes can also lack history. Preserve the known
 // confirmations on that lane when the other actor expires its shared task.
 const legacy=copy(sent);legacy.history=[];legacy.lanes[from]={phase:'accepted',round:{...direct.round,directQueued:false,toConfirmed:true}};
 ok(G.validateRoom(legacy));
 const legacyExpired=apply(legacy,'EXPIRE_TASKS',to,{at:'2026-11-09T10:00:00.000Z'});
 eq(legacyExpired.tasks,[]);eq(legacyExpired.lanes[from].phase,'resolved');eq(legacyExpired.lanes[from].round.toConfirmed,true);
 const incomplete=copy(legacy);incomplete.history=copy(sent.history);
 delete incomplete.history[0].fromConfirmed;delete incomplete.history[0].toConfirmed;
 ok(G.validateRoom(incomplete));
 for(const action of [{type:'EXPIRE_TASKS',at:'2026-11-09T10:00:00.000Z'},{type:'REFUSE_TASK',taskId:oldId,value:9,at:later}]){
  const ended=apply(incomplete,action.type,to,action);
  eq(ended.tasks,[]);eq(ended.lanes[from].phase,'resolved');eq(ended.lanes[from].round.toConfirmed,true);
 }
}
// A reset changes every gameplay counter but keeps access-independent preferences
// and creates fresh IDs above all prior draws, tasks and history.
let before=queue(draft());before=queue(draft(before,'b'),'b');
before.players=[{id:'a',name:'Fixture A'},{id:'b',name:'Fixture B'}];before.prefs.sound=true;
before.joker={weekKey:'2026-W45',usedBy:'a'};before.dailyReroll={dateKey:'2026-11-08',used:['a','b']};
before.stats.totalCompleted=4;before.stats.byCategory[G.legacyCategories[0].id]=4;
const saved=copy(before),reset=G.resetRoom(before,{at:later});
ok(G.validateRoom(reset));eq(before,saved,'reset is pure');eq(reset.players,before.players);eq(reset.prefs,before.prefs);
eq(reset.stats.totalCompleted,0);ok(Object.values(reset.stats.byCategory).every(n=>n===0));
eq(reset.tasks,[]);eq(reset.history,[]);eq(reset.pendingRounds,[]);eq(reset.seen,{});eq(reset.daily,null);eq(reset.joker,null);eq(reset.dailyReroll.used,[]);
eq(reset.sequence,before.sequence+2);ok(Number(reset.lanes.a.round.id.slice(5))>before.sequence);ok(Number(reset.lanes.b.round.id.slice(5))>before.sequence);
for(const task of before.tasks){
 eq(apply(reset,'TOGGLE_TASK_CHECK',task.to,{taskId:task.id,checked:true}),reset);
 eq(apply(reset,'REFUSE_TASK',task.to,{taskId:task.id,value:20}),reset);
}
const oldRound=before.lanes.a.round.id;
eq(apply(reset,'ROLL_CATEGORY','a',{roundId:oldRound,value:1,catalogueVersion:2,hand:G.cards.filter(card=>card.categoryId===G.categories[0].id).map(card=>card.id)}),reset,'pre-reset draw cannot act on the new room');
console.log(`Dés·ir direct sharing/refusal/reset: ${checks} checks passed; no invitation, every D20 refusal honoured, independent draws, two checks for points, monotonic reset IDs.`);
