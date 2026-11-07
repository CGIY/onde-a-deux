'use strict';
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
const at='2026-11-02T15:00:00.000Z';
const clone=s=>JSON.parse(JSON.stringify(s));
let checks=0;
function equal(actual,expected,message){checks++;assert.equal(actual,expected,message);}
function apply(s,action){const next=G.reduce(s,{at,...action});assert.ok(G.validateState(next),'invalid fixture after '+action.type);return next;}
function visibility(state,recipientVisible,label){
 const before=JSON.stringify(state),from=state.round.from,to=state.round.to;
 equal(G.canSeeRound(state,from),true,label+' owner');
 equal(G.canSeeRound(state,to),recipientVisible,label+' recipient');
 equal(G.canSeeRound({...state,activePlayer:from}),true,label+' default owner');
 equal(G.canSeeRound({...state,activePlayer:to}),recipientVisible,label+' default recipient');
 equal(JSON.stringify(state),before,label+' remains pure');
}
function draft(from){
 let s=G.createState();
 if(from==='b')s=apply(s,{type:'SWITCH_PLAYER',player:from});
 visibility(s,true,'category '+from);
 const hand=G.legacyCards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id);
 s=apply(s,{type:'ROLL_CATEGORY',value:2,hand});
 visibility(s,false,'card '+from);
 s=apply(s,{type:'ROLL_CARD',value:1});
 visibility(s,false,'draft '+from);
 return s;
}
function legacy(state){const old=clone(state);delete old.round.sentAt;return old;}
for(const from of ['a','b']){
 const to=G.otherPlayer(from),original=draft(from);
 const sent=apply(original,{type:'SEND'});
 visibility(sent,true,'explicit send '+from);
 visibility(legacy(sent),true,'legacy pending '+from);

 // The recipient alone decides; there is no negotiation phase in between.
 let s=apply(sent,{type:'SWITCH_PLAYER',player:to});
 visibility(s,true,'recipient pending '+from);
 visibility(legacy(s),true,'legacy recipient pending '+from);
 const accepted=apply(s,{type:'ACCEPT'});
 visibility(accepted,true,'accepted '+from);
 visibility(legacy(accepted),true,'legacy accepted '+from);

 // Passing closes the round for both, without points or extra confirmation.
 let stopped=apply(sent,{type:'SWITCH_PLAYER',player:to});
 stopped=apply(stopped,{type:'PASS'});
 equal(stopped.round.status,'passed','pass fixture');
 visibility(stopped,true,'passed round '+from);
 equal(G.canSeeRound(legacy(stopped),to),false,'a passed round needs its publication timestamp');

 s=apply(accepted,{type:'TOGGLE_TASK_CHECK',taskId:accepted.round.id,checked:true});
 s=apply(s,{type:'SWITCH_PLAYER',player:to});
 s=apply(s,{type:'TOGGLE_TASK_CHECK',taskId:accepted.round.id,checked:true});
 visibility(s,true,'completed '+from);
 visibility(legacy(s),true,'legacy completed '+from);
 const expired=apply(accepted,{type:'EXPIRE_TASKS',at:'2026-11-02T21:00:00.000Z'});
 visibility(expired,true,'expired accepted '+from);
 visibility(legacy(expired),true,'legacy expired accepted '+from);
 visibility(apply(accepted,{type:'NEW_ROUND'}),true,'next unclaimed round '+from);

 // A timestamp is sufficient publication evidence, without inspecting content.
 const timestampOnly=clone(original);timestampOnly.round.sentAt=at;
 visibility(timestampOnly,true,'timestamp publication evidence '+from);
 // A legacy recipient roll proves publication even with no sentAt or phase hint.
 const rolled=legacy(original);rolled.phase='resolved';rolled.round.status='defended';rolled.round.rolls=[20];
 visibility(rolled,true,'legacy recipient roll evidence '+from);
}
equal(G.canSeeRound(null),false,'missing state');
equal(G.canSeeRound({}),false,'missing round');
equal(G.canSeeRound(G.createState(),'other'),false,'unknown profile');
const invalid=G.createState();invalid.round.from='other';
equal(G.canSeeRound(invalid,'a'),false,'invalid owner');
console.log(`ONDE private round visibility: ${checks} targeted assertions passed.`);
