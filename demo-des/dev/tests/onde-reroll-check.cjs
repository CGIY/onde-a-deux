'use strict';
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
const at='2026-11-02T12:00:00.000Z',later='2026-11-02T13:00:00.000Z';
const clone=value=>JSON.parse(JSON.stringify(value));
let checks=0;
function eq(a,b,message){checks++;assert.deepEqual(a,b,message);}
function ok(value,message){checks++;assert.ok(value,message);}
function act(state,type,rest={}){const next=G.reduce(state,{type,at,...rest});ok(G.validateState(next),'valid output for '+type);return next;}
function draft(from='a',value=1){
 let state=G.createState();
 if(from==='b')state=act(state,'SWITCH_PLAYER',{player:from});
 const hand=G.legacyCards.filter(card=>card.categoryId==='complicite').slice(0,4).map(card=>card.id);
 state=act(state,'ROLL_CATEGORY',{value:1,hand});return act(state,'ROLL_CARD',{value});
}
function sent(state){return act(state,'SEND');}
function recipient(state){return act(state,'SWITCH_PLAYER',{player:state.round.to});}
function accepted(state){return act(recipient(sent(state)),'ACCEPT',{at:later});}
function complete(state){
 const taskId=state.round.id;
 state=act(state,'TOGGLE_TASK_CHECK',{taskId,checked:true,at:later});
 state=act(state,'SWITCH_PLAYER',{player:G.otherPlayer(state.activePlayer)});
 return act(state,'TOGGLE_TASK_CHECK',{taskId,checked:true,at:later});
}

eq(G.legacyCards.length,88,'catalogue remains intact');
eq(G.createState().round.cardRerolled,false,'fresh rounds start without a reroll');
// Every original D4 face has exactly three possible replacement cards, for either role.
for(const from of ['a','b'])for(let first=1;first<=4;first++){
 const initial=draft(from,first),to=G.otherPlayer(from),before=JSON.stringify(initial),alternatives=[];
 ok(G.canRerollCard(initial),'initiator may reroll their private draft');
 ok(G.canChallengeDraft(initial),'D20 remains an alternative before the choice');
 for(const value of [1,2,3,4]){
  if(value===first){eq(G.reduce(initial,{type:'REROLL_CARD',value}),initial,'same face cannot spend the reroll');continue;}
  const next=act(initial,'REROLL_CARD',{value});alternatives.push(next.round.cardId);
  eq(next.round.cardRoll,value);eq(next.round.cardId,initial.round.hand[value-1]);
  ok(next.round.cardId!==initial.round.cardId,'replacement card is guaranteed different');
  eq(next.round.hp,G.getCard(next.round.cardId).hp,'new card uses its own PV');
  eq(next.round.hand,initial.round.hand,'no extra hand is drawn');
  eq(next.round.categoryRoll,initial.round.categoryRoll,'D6 is untouched');
  eq(next.sequence,initial.sequence,'reroll stays in the same round');
  eq(next.stats,initial.stats,'reroll awards no points');eq(next.tasks,initial.tasks);
  eq(next.history,initial.history,'no spoiler history entry is added');
  eq(Object.keys(next.round).sort(),Object.keys(initial.round).sort(),'no previous-card field is retained');
  eq(next.round.cardRerolled,true);eq(next.round.draftChallengeUsed,false,'reroll is not a fake D20 attempt');
  eq(next.round.draftRolls,[]);eq(next.round.draftRollTokens,[]);
  eq(G.canRerollCard(next),false);eq(G.canChallengeDraft(next),false);
  eq(G.reduce(next,{type:'CHALLENGE_DRAFT'}),next,'initiator gives up D20 after reroll');
  eq(G.reduce(next,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'bypass'}),next);
  eq(G.reduce(next,{type:'REROLL_CARD',value:first}),next,'second reroll cannot return to original card');
  eq(G.canSeeRound(next,to),false,'replacement stays private until sent');
  eq(G.normalizeState(clone(next)),next,'reroll survives save and reload');
 }
 eq(new Set(alternatives).size,3,'three distinct eligible cards');
 eq(JSON.stringify(initial),before,'reroll does not mutate its input');
 const wrong=act(initial,'SWITCH_PLAYER',{player:to});
 eq(G.canRerollCard(wrong),false);eq(G.reduce(wrong,{type:'REROLL_CARD',value:first%4+1}),wrong,'other role cannot reroll');
 eq(G.reduce(initial,{type:'REROLL_CARD',value:first%4+1,actor:to}),initial,'wrong actor rejected');
 eq(G.reduce(initial,{type:'REROLL_CARD',value:first%4+1,roundId:'onde-stale'}),initial,'stale callback rejected');
 for(const value of [undefined,null,'2',0,5,1.5,NaN,Infinity])eq(G.reduce(initial,{type:'REROLL_CARD',value}),initial,'invalid D4 value rejected');
}

for(const from of ['a','b']){
 const original=draft(from),rerolled=act(original,'REROLL_CARD',{value:2}),finalCard=rerolled.round.cardId;
 let state=recipient(sent(rerolled));
 ok(G.canSeeRound(state),'recipient sees final card after send');eq(state.round.cardId,finalCard);
 state=act(state,'CHALLENGE');eq(state.phase,'challenge','recipient retains D20');
 eq(state.round.draftChallengeUsed,false);eq(state.round.challengeUsed,true);
 state=act(state,'ROLL_DEFENSE',{value:1,token:'receiver-1'});
 state=act(state,'ROLL_DEFENSE',{value:1,token:'receiver-2'});eq(state.phase,'challenge_failed');
 state=act(state,'ACCEPT',{at:later});eq(state.phase,'accepted');eq(state.tasks.length,1);
 eq(state.tasks[0].cardId,finalCard,'task uses replacement card');eq(state.tasks[0].createdAt,later);
 eq(Date.parse(state.tasks[0].expiresAt)-Date.parse(later),24*60*60*1000,'twenty-four hours start at agreement');
 state=complete(state);eq(state.stats.totalCompleted,1);eq(state.tasks,[]);eq(state.round.status,'completed');
 eq(state.history[0].cardId,finalCard);eq(state.history[0].cardRerolled,true);
 eq(act(state,'TOGGLE_TASK_CHECK',{taskId:state.round.id,checked:true,at:later}),state,'cannot count twice');
 const next=act(state,'NEW_ROUND');eq(next.round.from,G.otherPlayer(from));eq(next.round.cardRerolled,false,'next round has a fresh choice');

 state=act(recipient(sent(rerolled)),'CHALLENGE');
 state=act(state,'ROLL_DEFENSE',{value:20,token:'win-1'});
 state=act(state,'ROLL_DEFENSE',{value:20,token:'win-2'});
 eq(state.round.status,'defended','recipient can still discard final card');eq(state.stats.totalCompleted,0);
 eq(state.history[0].cardRerolled,true);

 const queued=accepted(rerolled);
 state=act(queued,'EXPIRE_TASKS',{at:new Date(Date.parse(later)+24*60*60*1000).toISOString()});
 eq(state.round.status,'expired');eq(state.stats.totalCompleted,0);eq(state.round.cardRerolled,true);

 // A D20 started before reroll irreversibly chooses the D20 route.
 state=act(original,'CHALLENGE_DRAFT');eq(G.canRerollCard(state),false);
 eq(act(state,'REROLL_CARD',{value:2}),state);
 state=act(state,'ROLL_DRAFT_DEFENSE',{value:1,token:'draft-1'});
 eq(act(state,'REROLL_CARD',{value:2}),state);
 state=act(state,'ROLL_DRAFT_DEFENSE',{value:1,token:'draft-2'});eq(state.phase,'pending');
 state=act(recipient(state),'ACCEPT');eq(state.phase,'sender_confirmation');
 const phases=[G.createState(),act(G.createState(),'ROLL_CATEGORY',{value:1,hand:original.round.hand}),
  sent(original),act(recipient(sent(original)),'CHALLENGE'),queued,complete(queued),state];
 for(const candidate of phases){eq(G.canRerollCard(candidate),false,'reroll unavailable in '+candidate.phase);eq(act(candidate,'REROLL_CARD',{value:2}),candidate);}
}

// Existing accepted tasks, their checks, and scores cannot be changed by a reroll.
let existing=accepted(draft());existing=act(existing,'NEW_ROUND');
const hand=G.legacyCards.filter(c=>c.categoryId==='detente').slice(0,4).map(c=>c.id);
existing=act(existing,'ROLL_CATEGORY',{value:2,hand});existing=act(existing,'ROLL_CARD',{value:1});
const changed=act(existing,'REROLL_CARD',{value:2});eq(changed.tasks,existing.tasks);eq(changed.stats,existing.stats);eq(changed.history,existing.history);

// Published saves gain only the missing boolean, including all history snapshots.
const oldStates=[G.createState(),draft(),sent(draft()),accepted(draft()),complete(accepted(draft()))];
oldStates.push(act(oldStates[3],'NEW_ROUND'));
let legacyDefense=act(draft(),'CHALLENGE_DRAFT');legacyDefense.round.hp=10;
legacyDefense=act(legacyDefense,'ROLL_DRAFT_DEFENSE',{value:10,token:'legacy-pv'});oldStates.push(legacyDefense);
for(const original of oldStates){
 const old=clone(original);delete old.round.cardRerolled;for(const round of old.history)delete round.cardRerolled;
 const before=JSON.stringify(old),migrated=G.normalizeState(old);
 ok(migrated&&G.validateState(migrated),'old save migrates');eq(migrated,original,'rounds, PV, tasks, scores and history remain intact');
 eq(JSON.stringify(old),before,'migration does not mutate original');eq(G.normalizeState(migrated),migrated,'migration is idempotent');
}
const legacy=clone(accepted(draft()));
for(const round of [legacy.round,...legacy.history])for(const key of ['cardRerolled','draftRolls','draftRollTokens','draftChallengeUsed','autoProposed','fromConfirmed','toConfirmed'])delete round[key];
delete legacy.tasks;delete legacy.stats;
ok(G.normalizeState(legacy),'older saves still restore their accepted task');

// Invalid combinations must fail validation and cannot be silently repaired.
const invalid=[];
for(const value of [true,'true',0,null]){const state=G.createState();state.round.cardRerolled=value;invalid.push(state);}
const noCard=act(G.createState(),'ROLL_CATEGORY',{value:1,hand:draft().round.hand});noCard.round.cardRerolled=true;invalid.push(noCard);
let malformed=act(draft(),'REROLL_CARD',{value:2});malformed.round.draftChallengeUsed=true;invalid.push(malformed);
malformed=act(draft(),'REROLL_CARD',{value:2});malformed.round.draftRolls=[1];malformed.round.draftRollTokens=['impossible'];invalid.push(malformed);
malformed=accepted(draft());malformed.history[0].cardRerolled=true;malformed.history[0].draftChallengeUsed=true;invalid.push(malformed);
malformed=accepted(draft());malformed.history[0].cardRerolled='yes';invalid.push(malformed);
for(const state of invalid){eq(G.validateState(state),false,'invalid reroll state rejected');eq(G.normalizeState(state),null,'invalid present flag never reset');}
console.log(`ONDE one-use D4 reroll: ${checks} targeted assertions passed.`);
