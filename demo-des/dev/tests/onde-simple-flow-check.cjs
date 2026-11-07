'use strict';
const assert=require('node:assert/strict');
const G=require(require('node:path').join(__dirname,'../src/onde-app-core.js'));
let checks=0;
const ok=(x,message)=>{checks++;assert.ok(x,message);};
const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const at='2026-11-02T12:00:00.000Z',later='2026-11-02T13:00:00.000Z';
const clone=value=>JSON.parse(JSON.stringify(value));
function apply(s,a){const n=G.reduce(s,{at,...a});ok(G.validateState(n),'invalid output '+a.type+' '+n.phase);return n;}
function complete(s){const taskId=s.round.id;s=apply(s,{type:'TOGGLE_TASK_CHECK',taskId,checked:true,at:later});s=apply(s,{type:'SWITCH_PLAYER',player:G.otherPlayer(s.activePlayer)});return apply(s,{type:'TOGGLE_TASK_CHECK',taskId,checked:true,at:later});}
function draft(from='a',cardId='det-1') {
 let s=G.createState(); if(from==='b')s=apply(s,{type:'SWITCH_PLAYER',player:'b'});
 const card=G.getCard(cardId),cat=G.getCategory(card.categoryId,1),hand=[card.id,...G.legacyCards.filter(c=>c.categoryId===cat.id&&c.id!==card.id).slice(0,3).map(c=>c.id)];
 s=apply(s,{type:'ROLL_CATEGORY',value:cat.number,hand});return apply(s,{type:'ROLL_CARD',value:1});
}
function sent(from='a'){return apply(draft(from),{type:'SEND'});}
function accepted(){let s=sent();s=apply(s,{type:'SWITCH_PLAYER',player:'b'});return apply(s,{type:'ACCEPT',at:later});}
function pendingRecipient(){return apply(sent(),{type:'SWITCH_PLAYER',player:'b'});}

// The negotiation actions of the old protocol are inert from every modern phase.
const legacyActions=[
 {type:'CHALLENGE_DRAFT'},
 {type:'ROLL_DRAFT_DEFENSE',value:20,token:'draft'},
 {type:'CHALLENGE'},
 {type:'ROLL_DEFENSE',value:20,token:'defense'},
 {type:'ADAPT',text:'Une variante',schedule:'Demain'},
 {type:'LATER',text:'Une variante',schedule:'Demain'},
];
let variantState=G.createState();
variantState=apply(variantState,{type:'ROLL_CATEGORY',value:1,catalogueVersion:2,hand:G.drawHand(variantState,1,2)});
variantState=apply(variantState,{type:'ROLL_CARD',value:1});
const modernPhases=[
 ['category',G.createState()],
 ['card',apply(G.createState(),{type:'ROLL_CATEGORY',value:1,hand:draft().round.hand})],
 ['draft',draft()],
 ['variant',variantState],
 ['pending',sent()],
 ['accepted',accepted()],
 ['resolved',complete(accepted())],
];
for(const [phase,state] of modernPhases)for(const action of legacyActions)
 eq(G.reduce(state,{...action,at}),state,'legacy '+action.type+' is inert in '+phase);

// Pass is reserved for the recipient of an invitation.
eq(apply(draft(),{type:'PASS'}),draft(),'sender cannot pass a private draft');
eq(apply(draft(),{type:'PASS',actor:'a'}),draft(),'explicit actor cannot pass either');
let senderView=sent();ok(senderView.activePlayer===senderView.round.from);
eq(apply(senderView,{type:'PASS'}),senderView,'sender cannot pass their own pending invitation');
let state=pendingRecipient();
ok(G.canRespond(state),'recipient may respond');
state=apply(state,{type:'PASS'});
eq(state.phase,'resolved');eq(state.round.status,'passed');eq(state.round.awaiting,null);
eq(state.stats.totalCompleted,0);eq(state.tasks,[]);eq(state.history[0].status,'passed');
eq(state.history[0].closedBy,'b','history records who passed');
ok(!G.canRespond(state),'a passed round is closed');
eq(apply(state,{type:'PASS'}),state,'passing twice changes nothing');
eq(apply(state,{type:'ACCEPT',at:later}),state,'accepting after a pass changes nothing');
eq(apply(state,{type:'NEW_ROUND'}).round.from,'b','the next drawer alternates after a pass');

// A direct accept creates the 24-hour task; the sender cannot accept for the recipient.
eq(apply(senderView,{type:'ACCEPT',at:later}),senderView,'sender cannot accept their own invitation');
state=apply(state=apply(senderView,{type:'SWITCH_PLAYER',player:'b'}),{type:'ACCEPT',at:later});
eq(state.phase,'accepted');eq(state.tasks.length,1);
eq(state.tasks[0].cardId,senderView.round.cardId);
eq(Date.parse(state.tasks[0].expiresAt)-Date.parse(later),24*60*60*1000,'twenty-four hours start at agreement');
eq(state.stats.totalCompleted,0,'nothing is scored before both checks');
state=complete(state);
eq(state.stats.totalCompleted,1);eq(state.stats.byCategory.detente,1);eq(state.tasks,[]);eq(state.round.status,'completed');
eq(apply(state,{type:'TOGGLE_TASK_CHECK',taskId:state.round.id,checked:true,at:later}),state,'cannot count twice');

// Old draft challenges migrate back to a clean draft the initiator can send or reroll.
for(const from of ['a','b']){
 const clean=draft(from),to=G.otherPlayer(from);
 const frozen=clone(clean);
 frozen.phase='draft_challenge';frozen.round.status='drawing';frozen.round.awaiting=from;
 frozen.round.draftChallengeUsed=true;frozen.round.draftRolls=[3];frozen.round.draftRollTokens=['legacy'];
 eq(G.validateState(frozen),false,'the frozen state itself is no longer valid');
 const migrated=G.normalizeState(clone(frozen));
 ok(migrated&&G.validateState(migrated),'draft challenge migrates to a valid draft');
 eq(migrated.phase,'draft');eq(migrated.round.status,'draft');eq(migrated.round.awaiting,null);
 eq(migrated.round.draftChallengeUsed,false);eq(migrated.round.draftRolls,[]);eq(migrated.round.draftRollTokens,[]);
 eq(migrated.round.cardId,clean.round.cardId,'the drawn card is preserved');
 ok(G.canRerollCard(migrated),'the reroll is available again');
 eq(G.normalizeState(clone(migrated)),migrated,'migration is idempotent');
 const rerolled=apply(migrated,{type:'REROLL_CARD',value:2});
 eq(rerolled.round.cardRerolled,true,'a migrated draft can spend its reroll');
 const delivered=apply(apply(migrated,{type:'SEND'}),{type:'SWITCH_PLAYER',player:to});
 eq(delivered.phase,'pending');ok(G.canRespond(delivered),'the recipient can answer a migrated draft');
}

// Frozen negotiations and confirmations migrate to a plain pending invitation.
const negotiationFreezes=[
 ['challenge',round=>{round.status='challenge';round.challengeUsed=true;round.rolls=[5,5];round.rollTokens=['t1','t2'];}],
 ['challenge_failed',round=>{round.status='challenge_failed';round.challengeUsed=true;round.rolls=[1,1];round.rollTokens=['t1','t2'];}],
 ['sender_confirmation',round=>{round.status='sender_confirmation';round.awaiting=round.from;round.toConfirmed=true;}],
];
for(const [phase,mutate] of negotiationFreezes)for(const from of ['a','b']){
 const to=G.otherPlayer(from),clean=sent(from);
 const frozen=clone(clean);frozen.phase=phase;mutate(frozen.round);
 eq(G.validateState(frozen),false,'the frozen negotiation is no longer valid');
 const migrated=G.normalizeState(clone(frozen));
 ok(migrated&&G.validateState(migrated),phase+' migrates to a valid invitation');
 eq(migrated.phase,'pending');eq(migrated.round.status,'pending');eq(migrated.round.awaiting,to);
 eq(migrated.round.challengeUsed,false);eq(migrated.round.rolls,[]);eq(migrated.round.rollTokens,[]);
 eq(migrated.round.autoProposed,false);eq(migrated.round.fromConfirmed,true);eq(migrated.round.toConfirmed,false);
 eq(migrated.round.cardId,clean.round.cardId,'the proposed card is preserved');
 const answered=apply(migrated,{type:'SWITCH_PLAYER',player:to});
 ok(G.canRespond(answered),'the recipient can answer a migrated invitation');
 const acceptedState=apply(answered,{type:'ACCEPT',at:later});
 eq(acceptedState.phase,'accepted');eq(acceptedState.tasks.length,1);
 eq(acceptedState.tasks[0].cardId,clean.round.cardId);
 eq(G.normalizeState(clone(migrated)),migrated,'migration is idempotent');
}

// Counterproposals and scheduled proposals also collapse to a pending invitation.
for(const status of ['counterproposal','scheduled_proposal'])for(const from of ['a','b']){
 const to=G.otherPlayer(from),clean=sent(from);
 const frozen=clone(clean);frozen.round.status=status;frozen.round.adapted=true;
 frozen.round.schedule='Demain';frozen.round.awaiting=from;frozen.round.autoProposed=false;
 const migrated=G.normalizeState(frozen);
 ok(migrated&&G.validateState(migrated),status+' migrates to a valid invitation');
 eq(migrated.phase,'pending');eq(migrated.round.status,'pending');eq(migrated.round.awaiting,to);
 eq(migrated.round.adapted,false);eq(migrated.round.schedule,null);
 ok(G.canRespond(apply(migrated,{type:'SWITCH_PLAYER',player:to})),'the recipient can answer');
}

// Historical defended rounds remain readable, including as the current round.
const defended=clone(complete(accepted()));
defended.round.status='defended';defended.round.challengeUsed=true;
defended.round.rolls=[20,20];defended.round.rollTokens=['win-1','win-2'];
ok(G.validateState(defended),'a defended current round is a valid resolved state');
eq(G.normalizeState(clone(defended)),defended,'a defended round needs no repair');
const defendedHistory=apply(pendingRecipient(),{type:'PASS'});
defendedHistory.history[0].status='defended';defendedHistory.history[0].rolls=[20,20];
defendedHistory.history[0].rollTokens=['win-1','win-2'];
ok(G.validateState(defendedHistory),'defended history entries remain readable');
ok(G.normalizeState(clone(defendedHistory)),'defended history survives a save and reload');

// Old saves without the modern booleans still restore their progress.
const additions=['cardRerolled','draftRolls','draftRollTokens','draftChallengeUsed','autoProposed','fromConfirmed','toConfirmed'];
function legacy(s){const old=clone(s);delete old.tasks;for(const k of additions)delete old.round[k];for(const r of old.history)for(const k of additions)delete r[k];delete old.stats;return old;}
for(const original of [G.createState(),draft(),sent(),accepted(),complete(accepted())]){
 const old=legacy(original),before=JSON.stringify(old),m=G.normalizeState(old);
 ok(m&&G.validateState(m),'old save migrates');
 eq(JSON.stringify(old),before,'migration must not mutate input');
 eq(m.round.cardId,original.round.cardId);eq(m.players,original.players);eq(m.prefs,original.prefs);
 eq(G.normalizeState(clone(m)),m,'migration is idempotent');
}
const scored=G.normalizeState(legacy(complete(accepted())));
eq(scored.stats.totalCompleted,1,'history still reconstructs the score');
eq(scored.stats.byCategory.detente,1);

// Malformed negotiation leftovers are rejected, never silently downgraded.
state=draft();state.round.fromConfirmed='yes';eq(G.normalizeState(state),null);
state=sent();state.round.rolls=[20,20];state.round.rollTokens=['win-1','win-2'];
eq(G.normalizeState(state),null,'unresolved rolls above the PV cannot be restored');
state=accepted();state.round.fromConfirmed=false;eq(G.normalizeState(state),null);
console.log(`ONDE simple flow: ${checks} targeted assertions passed.`);
