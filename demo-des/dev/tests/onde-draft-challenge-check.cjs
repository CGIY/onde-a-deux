'use strict';
const assert=require('node:assert/strict');
const G=require(require('node:path').join(__dirname,'../src/onde-app-core.js'));
let checks=0;
const ok=(x,message)=>{checks++;assert.ok(x,message);};
const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const at='2026-11-02T12:00:00.000Z';
function apply(s,a){const n=G.reduce(s,{at,...a});ok(G.validateState(n),'invalid output '+a.type+' '+n.phase);return n;}
function complete(s){const taskId=s.round.id;s=apply(s,{type:'TOGGLE_TASK_CHECK',taskId,checked:true});s=apply(s,{type:'SWITCH_PLAYER',player:G.otherPlayer(s.activePlayer)});return apply(s,{type:'TOGGLE_TASK_CHECK',taskId,checked:true});}
function draft(from='a',cardId='det-1') {
 let s=G.createState(); if(from==='b')s=apply(s,{type:'SWITCH_PLAYER',player:'b'});
 const card=G.getCard(cardId),cat=G.getCategory(card.categoryId,1),hand=[card.id,...G.legacyCards.filter(c=>c.categoryId===cat.id&&c.id!==card.id).slice(0,3).map(c=>c.id)];
 s=apply(s,{type:'ROLL_CATEGORY',value:cat.number,hand});return apply(s,{type:'ROLL_CARD',value:1});
}
function failedDraft(from='a'){
 let s=apply(draft(from),{type:'CHALLENGE_DRAFT'});
 s=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:1,token:'draft-1'});
 return apply(s,{type:'ROLL_DRAFT_DEFENSE',value:1,token:'draft-2'});
}
function acceptedExplicit(){let s=apply(draft(),{type:'SEND'});s=apply(s,{type:'SWITCH_PLAYER',player:'b'});return apply(s,{type:'ACCEPT'});}
const fresh=G.createState();ok(G.validateState(fresh));ok(!G.canChallengeDraft(fresh));
for(const from of ['a','b']){
 let s=draft(from),to=G.otherPlayer(from);ok(G.canChallengeDraft(s));
 let wrong=apply(s,{type:'SWITCH_PLAYER',player:to});eq(G.reduce(wrong,{type:'CHALLENGE_DRAFT'}),wrong,'noninitiator cannot challenge draft');
 s=apply(s,{type:'CHALLENGE_DRAFT'});ok(G.canRollDraftDefense(s));eq(s.round.awaiting,from);
 let first=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'first'});eq(first.round.draftRolls,[20]);eq(first.round.rolls,[]);
 eq(G.reduce(first,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'first'}),first,'duplicate draft roll ignored');
 eq(G.reduce(first,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'different',actor:to}),first,'stale/wrong actor ignored');
 eq(G.reduce(first,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'different',roundId:'onde-stale'}),first,'old round ignored');
 const restored=G.normalizeState(JSON.parse(JSON.stringify(first)));ok(restored);eq(restored.round.draftRolls,[20]);
 s=apply(restored,{type:'ROLL_DRAFT_DEFENSE',value:10,token:'second'});eq(s.phase,'resolved');eq(s.round.status,'defended');eq(s.round.sentAt,null);eq(s.round.fromConfirmed,false);eq(s.round.toConfirmed,false);eq(s.stats.totalCompleted,0);
 eq(G.reduce(s,{type:'ROLL_DRAFT_DEFENSE',value:20,token:'third'}),s,'third draft roll ignored');
 s=failedDraft(from);eq(s.phase,'pending');eq(s.round.status,'pending');eq(s.round.awaiting,to);eq(s.round.autoProposed,true);eq(s.round.draftRolls,[1,1]);eq(s.round.rolls,[]);eq(s.round.fromConfirmed,false);eq(s.round.toConfirmed,false);
 eq(G.reduce(s,{type:'ACCEPT'}),s,'initiator cannot accept on behalf of recipient');
 s=apply(s,{type:'SWITCH_PLAYER',player:to});ok(G.canRespond(s));s=apply(s,{type:'ACCEPT'});eq(s.phase,'sender_confirmation');eq(s.round.awaiting,from);eq(s.round.toConfirmed,true);eq(s.round.fromConfirmed,false);eq(s.stats.totalCompleted,0);
 eq(G.reduce(s,{type:'COMPLETE'}),s,'cannot complete without both agreements');
 s=apply(s,{type:'SWITCH_PLAYER',player:from});ok(G.canRespond(s));s=apply(s,{type:'ACCEPT'});eq(s.phase,'accepted');ok(s.round.fromConfirmed&&s.round.toConfirmed);
 s=complete(s);eq(s.stats.totalCompleted,1);eq(s.stats.byCategory.detente,1);eq(G.reduce(s,{type:'COMPLETE'}),s,'double scoring impossible');
 eq(G.normalizeState(JSON.parse(JSON.stringify(s))).stats.totalCompleted,1);
}
// Recipient keeps a full independent challenge after automatic proposal.
let s=failedDraft();s=apply(s,{type:'SWITCH_PLAYER',player:'b'});s=apply(s,{type:'CHALLENGE'});s=apply(s,{type:'ROLL_DEFENSE',value:20,token:'recipient-1'});eq(s.phase,'challenge');eq(s.round.draftRolls,[1,1]);eq(s.round.rolls,[20]);s=apply(s,{type:'ROLL_DEFENSE',value:10,token:'recipient-2'});eq(s.phase,'resolved');eq(s.round.status,'defended');eq(s.stats.totalCompleted,0);
// Recipient failing a separate challenge still needs initiator confirmation.
s=failedDraft();s=apply(s,{type:'SWITCH_PLAYER',player:'b'});s=apply(s,{type:'CHALLENGE'});s=apply(s,{type:'ROLL_DEFENSE',value:1,token:'r1'});s=apply(s,{type:'ROLL_DEFENSE',value:1,token:'r2'});eq(s.phase,'challenge_failed');s=apply(s,{type:'ACCEPT'});eq(s.phase,'sender_confirmation');
// Counterproposals explicitly confirm only their author, including a sender in confirmation.
for(const type of ['ADAPT','LATER']){
 s=failedDraft();s=apply(s,{type:'SWITCH_PLAYER',player:'b'});s=apply(s,{type,text:'Trois minutes de massage',schedule:'Demain'});eq(s.phase,'pending');eq(s.round.awaiting,'a');ok(!s.round.fromConfirmed&&s.round.toConfirmed);
 s=apply(s,{type:'SWITCH_PLAYER',player:'a'});s=apply(s,{type:'ACCEPT'});eq(s.phase,'accepted');
 s=failedDraft();s=apply(s,{type:'SWITCH_PLAYER',player:'b'});s=apply(s,{type:'ACCEPT'});s=apply(s,{type:'SWITCH_PLAYER',player:'a'});s=apply(s,{type,text:'Trois minutes',schedule:'Demain'});eq(s.phase,'pending');eq(s.round.awaiting,'b');ok(s.round.fromConfirmed&&!s.round.toConfirmed);
 s=apply(s,{type:'SWITCH_PLAYER',player:'b'});s=apply(s,{type:'ACCEPT'});eq(s.phase,'accepted');
}
// Explicit SEND can assume the card before/during draft challenge.
s=acceptedExplicit();eq(s.phase,'accepted');ok(s.round.fromConfirmed&&s.round.toConfirmed);
s=apply(draft(),{type:'CHALLENGE_DRAFT'});s=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:1,token:'partial'});s=apply(s,{type:'SEND'});eq(s.phase,'pending');ok(s.round.fromConfirmed&&!s.round.toConfirmed&&!s.round.autoProposed);
// The drawer cannot bypass their own challenge; recipients can pass without penalty.
for(const state of [draft(),apply(draft(),{type:'CHALLENGE_DRAFT'})])eq(apply(state,{type:'PASS'}),state,'initiator cannot pass before proposal');
s=apply(draft(),{type:'CHALLENGE_DRAFT'});s=apply(s,{type:'ROLL_DRAFT_DEFENSE',value:1,token:'must-finish'});eq(apply(s,{type:'PASS'}),s,'initiator must finish both D20 rolls');
const states=[failedDraft(),acceptedExplicit()];
s=failedDraft();s=apply(s,{type:'SWITCH_PLAYER',player:'b'});states.push(s);
s=failedDraft();s=apply(s,{type:'SWITCH_PLAYER',player:'b'});s=apply(s,{type:'ACCEPT'});states.push(s);
for(const state of states){const stopped=apply(state,{type:'PASS'});eq(stopped.phase,'resolved');eq(stopped.round.status,'passed');eq(stopped.stats.totalCompleted,0);}
// Legacy v1 migration: preserve current round, score, names, prefs, favorites.
const additions=['draftRolls','draftRollTokens','draftChallengeUsed','autoProposed','fromConfirmed','toConfirmed'];
function legacy(s,stats=true){const old=JSON.parse(JSON.stringify(s));delete old.tasks;for(const k of additions)delete old.round[k];for(const r of old.history)for(const k of additions)delete r[k];if(!stats)delete old.stats;return old;}
for(let state of [G.createState(),draft(),apply(draft(),{type:'SEND'}),acceptedExplicit(),complete(acceptedExplicit())]){
 const old=legacy(state),before=JSON.stringify(old),m=G.normalizeState(old);ok(m);ok(G.validateState(m));eq(JSON.stringify(old),before,'migration must not mutate input');eq(m.round.cardId,state.round.cardId);eq(m.stats,state.stats);eq(m.players,state.players);eq(m.prefs,state.prefs);
}
s=complete(acceptedExplicit());const old=legacy(s,false),m=G.normalizeState(old);ok(m);eq(m.stats.totalCompleted,1);eq(m.stats.byCategory.detente,1);
for(const type of ['ADAPT','LATER']){s=apply(draft(),{type:'SEND'});s=apply(s,{type:'SWITCH_PLAYER',player:'b'});s=apply(s,{type,text:'Une variante',schedule:'Demain'});const m=G.normalizeState(legacy(s));ok(m);eq(m.round.fromConfirmed,false);eq(m.round.toConfirmed,true);s=apply(m,{type:'SWITCH_PLAYER',player:'a'});s=apply(s,{type:'ACCEPT'});eq(s.phase,'accepted');}
// New malformed flags and rolls are rejected, never silently downgraded.
s=draft();s.round.fromConfirmed='yes';eq(G.normalizeState(s),null);
s=failedDraft();s.round.draftRolls=[20,20];eq(G.normalizeState(s),null);
s=acceptedExplicit();s.round.fromConfirmed=false;eq(G.normalizeState(s),null);
console.log(`ONDE initiator challenge: ${checks} targeted assertions passed.`);
