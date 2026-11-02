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
 visibility(s,false,'category '+from);
 const hand=G.cards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id);
 s=apply(s,{type:'ROLL_CATEGORY',value:2,hand});
 visibility(s,false,'card '+from);
 s=apply(s,{type:'ROLL_CARD',value:1});
 visibility(s,false,'draft '+from);
 return s;
}
function legacy(state){const old=clone(state);delete old.round.sentAt;return old;}
for(const from of ['a','b']){
 const to=G.otherPlayer(from),original=draft(from);
 let s=apply(original,{type:'CHALLENGE_DRAFT'});
 visibility(s,false,'private challenge '+from);
 visibility(legacy(s),false,'legacy private challenge '+from);
 s=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'private-one'});
 visibility(s,false,'private first roll '+from);
 s=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'private-two'});
 equal(s.round.status,'defended','private defense fixture');
 visibility(s,false,'discard before send '+from);
 visibility(legacy(s),false,'legacy discard before send '+from);

 const sent=apply(original,{type:'SEND'});
 visibility(sent,true,'explicit send '+from);
 visibility(legacy(sent),true,'legacy pending '+from);
 s=apply(sent,{type:'SWITCH_PLAYER',player:to});
 s=apply(s,{type:'CHALLENGE'});
 visibility(s,true,'recipient challenge '+from);
 visibility(legacy(s),true,'legacy recipient challenge '+from);
 const challenge=s;
 s=apply(s,{type:'ROLL_DEFENSE',value:1,token:'receiver-one'});
 s=apply(s,{type:'ROLL_DEFENSE',value:1,token:'receiver-two'});
 visibility(s,true,'recipient failed '+from);
 visibility(legacy(s),true,'legacy recipient failed '+from);
 s=apply(challenge,{type:'ROLL_DEFENSE',value:20,token:'receiver-win-one'});
 s=apply(s,{type:'ROLL_DEFENSE',value:20,token:'receiver-win-two'});
 visibility(s,true,'discard after send '+from);
 visibility(legacy(s),true,'legacy discard after send '+from);

 s=apply(original,{type:'CHALLENGE_DRAFT'});
 s=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:1,token:'auto-one'});
 s=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:1,token:'auto-two'});
 visibility(s,true,'automatic send '+from);
 s=apply(s,{type:'SWITCH_PLAYER',player:to});
 s=apply(s,{type:'ACCEPT'});
 visibility(s,true,'sender confirmation '+from);
 visibility(legacy(s),true,'legacy sender confirmation '+from);
 s=apply(s,{type:'SWITCH_PLAYER',player:from});
 s=apply(s,{type:'ACCEPT'});
 visibility(s,true,'accepted '+from);
 visibility(legacy(s),true,'legacy accepted '+from);
 const accepted=s;
 s=apply(s,{type:'TOGGLE_TASK_CHECK',taskId:s.round.id,checked:true});
 s=apply(s,{type:'SWITCH_PLAYER',player:to});
 s=apply(s,{type:'TOGGLE_TASK_CHECK',taskId:s.round.id,checked:true});
 visibility(s,true,'completed '+from);
 visibility(legacy(s),true,'legacy completed '+from);
 const expired=apply(accepted,{type:'EXPIRE_TASKS',at:'2026-11-02T21:00:00.000Z'});
 visibility(expired,true,'expired accepted '+from);
 visibility(legacy(expired),true,'legacy expired accepted '+from);
 visibility(apply(accepted,{type:'NEW_ROUND'}),false,'next private round '+from);

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
