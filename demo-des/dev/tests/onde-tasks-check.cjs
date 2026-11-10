'use strict';
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
let checks=0;
const at='2026-11-02T12:00:00.000Z';
const after=ms=>new Date(Date.parse(at)+ms).toISOString();
const clone=value=>JSON.parse(JSON.stringify(value));
const check=fn=>{fn();checks++;};
function act(state,type,rest={}){const next=G.reduce(state,{at,type,...rest});assert(G.validateState(next),type+' output must be valid');return next;}
function accept(state=G.createState(),category=0){const cat=G.legacyCategories[category],hand=G.legacyCards.filter(c=>c.categoryId===cat.id).slice(0,4).map(c=>c.id);state=act(state,'ROLL_CATEGORY',{value:cat.number,hand});state=act(state,'ROLL_CARD',{value:1});state=act(state,'SEND');state=act(state,'SWITCH_PLAYER',{player:state.round.to});return act(state,'ACCEPT');}
function tick(state,ms=G.rules.taskLifetimeMs){return act(state,'EXPIRE_TASKS',{at:after(ms)});}
function toggle(state,id,checked=true,time=at){return act(state,'TOGGLE_TASK_CHECK',{taskId:id,checked,at:time});}
let state=accept();const id=state.round.id,task=state.tasks[0];
check(()=>assert.equal(G.rules.taskLifetimeMs,86400000));
check(()=>assert.equal(state.tasks.length,1));
check(()=>assert.deepEqual(task,{id,cardId:state.round.cardId,categoryId:state.round.categoryId,from:state.round.from,to:state.round.to,createdAt:at,expiresAt:after(86400000),checks:{a:false,b:false},proposal:null}));
const legacySixHour=clone(state);legacySixHour.tasks[0]={...legacySixHour.tasks[0],expiresAt:after(21600000)};check(()=>assert.equal(G.validateState(legacySixHour),true));
const oddSpan=clone(state);oddSpan.tasks[0]={...oddSpan.tasks[0],expiresAt:after(43200000)};check(()=>assert.equal(G.validateState(oddSpan),true));
const outOfBounds=clone(state);outOfBounds.tasks[0]={...outOfBounds.tasks[0],expiresAt:after(172800000+1)};check(()=>assert.equal(G.validateState(outOfBounds),false));
check(()=>assert.equal(state.history[0].status,'queued'));
check(()=>assert.equal(state.stats.totalCompleted,0));
check(()=>assert.equal(act(state,'ACCEPT'),state));
check(()=>assert.equal(act(state,'COMPLETE'),state));
check(()=>assert.equal(act(state,'EXPIRE_TASKS'),state));
check(()=>assert.equal(act(state,'TOGGLE_TASK_CHECK',{taskId:'missing',checked:true}),state));
check(()=>assert.equal(act(state,'TOGGLE_TASK_CHECK',{taskId:id,checked:'true'}),state));
check(()=>assert.equal(act(state,'TOGGLE_TASK_CHECK',{taskId:id,checked:true,actor:'a'}),state));
check(()=>assert.equal(act(state,'TOGGLE_TASK_CHECK',{taskId:id,checked:true,player:'a'}),state));
check(()=>assert.equal(act(state,'TOGGLE_TASK_CHECK',{taskId:id,checked:true,at:'2026-11-02T11:59:59.000Z'}),state));
let checked=toggle(state,id);
check(()=>assert.deepEqual(checked.tasks[0].checks,{a:false,b:true}));
check(()=>assert.deepEqual(state.tasks[0].checks,{a:false,b:false}));
check(()=>assert.equal(checked.stats.totalCompleted,0));
check(()=>assert.equal(toggle(checked,id),checked));
checked=toggle(checked,id,false);
check(()=>assert.deepEqual(checked.tasks[0].checks,{a:false,b:false}));
checked=toggle(checked,id);checked=act(checked,'SWITCH_PLAYER',{player:'a'});checked=toggle(checked,id);
check(()=>assert.equal(checked.tasks.length,0));
check(()=>assert.equal(checked.stats.totalCompleted,1));
check(()=>assert.equal(checked.stats.byCategory.complicite,1));
check(()=>assert.equal(checked.round.status,'completed'));
check(()=>assert.equal(checked.phase,'resolved'));
check(()=>assert.equal(checked.history.filter(r=>r.id===id).length,1));
check(()=>assert.equal(checked.history[0].status,'completed'));
check(()=>assert.deepEqual(checked.history[0].checks,{a:true,b:true}));
check(()=>assert.equal(toggle(checked,id),checked));
check(()=>assert.equal(act(checked,'COMPLETE'),checked));
// Starting a new round keeps the task and fixes the next drawer, even while profiles change for checkboxes.
let queued=accept();const oldId=queued.round.id;
queued=act(queued,'NEW_ROUND');const nextFrom=queued.round.from;
check(()=>assert.equal(queued.tasks.length,1));
check(()=>assert.equal(queued.sequence,2));
check(()=>assert.equal(nextFrom,'b'));
queued=act(queued,'SWITCH_PLAYER',{player:'a'});
check(()=>assert.equal(queued.round.from,nextFrom));
queued=toggle(queued,oldId);
queued=act(queued,'SWITCH_PLAYER',{player:'b'});
const beforeRound=clone(queued.round),beforePhase=queued.phase;
queued=toggle(queued,oldId);
check(()=>assert.deepEqual(queued.round,beforeRound));
check(()=>assert.equal(queued.phase,beforePhase));
check(()=>assert.equal(queued.stats.totalCompleted,1));
// Distinct task checkboxes cannot complete another card; old queued tasks coexist with new ones.
let multiple=accept();multiple=act(multiple,'NEW_ROUND');multiple=accept(multiple,1);
check(()=>assert.equal(multiple.tasks.length,2));
const firstId=multiple.tasks[0].id,secondId=multiple.tasks[1].id;
multiple=toggle(multiple,firstId);multiple=toggle(multiple,secondId);multiple=act(multiple,'SWITCH_PLAYER',{player:G.otherPlayer(multiple.activePlayer)});multiple=toggle(multiple,firstId);
check(()=>assert.equal(multiple.tasks.length,1));
check(()=>assert.equal(multiple.tasks[0].id,secondId));
check(()=>assert.equal(multiple.stats.totalCompleted,1));
multiple=toggle(multiple,secondId);
check(()=>assert.equal(multiple.tasks.length,0));
check(()=>assert.equal(multiple.stats.totalCompleted,2));
check(()=>assert.equal(multiple.stats.byCategory.detente,1));
// At exactly twenty-four hours the task expires before a second checkbox can award a point.
let expiring=accept();expiring=toggle(expiring,expiring.round.id);expiring=act(expiring,'SWITCH_PLAYER',{player:'a'});
const expiringId=expiring.round.id;
check(()=>assert.equal(tick(expiring,86400000-1),expiring));
expiring=toggle(expiring,expiringId,true,after(86400000));
check(()=>assert.equal(expiring.tasks.length,0));
check(()=>assert.equal(expiring.stats.totalCompleted,0));
check(()=>assert.equal(expiring.history[0].status,'expired'));
check(()=>assert.equal(expiring.round.status,'expired'));
check(()=>assert.equal(toggle(expiring,expiringId),expiring));
check(()=>assert.equal(tick(expiring),expiring));
let early=accept();early=toggle(early,early.round.id);early=act(early,'SWITCH_PLAYER',{player:'a'});early=toggle(early,early.round.id,true,after(86400000-1));
check(()=>assert.equal(early.stats.totalCompleted,1));
check(()=>assert.equal(tick(early),early));
// The same star wallet serves extensions and rerolls. A saved six-hour task
// gains exactly 24 hours from its original deadline and can only do so once.
const extension={type:'EXTEND_TASK',taskId:id,at:after(3600000)};
const prolonged=act(legacySixHour,extension.type,extension);
check(()=>assert.equal(prolonged.tasks[0].expiresAt,after(30*3600000)));
check(()=>assert.deepEqual(prolonged.tasks[0].checks,task.checks));
check(()=>assert.equal(G.cardRerollStars(prolonged,'b',extension.at).balance,0));
check(()=>assert.equal(G.cardRerollStars(prolonged,'a',extension.at).balance,1));
const otherProfile=act(prolonged,'SWITCH_PLAYER',{player:'a'});
check(()=>assert.equal(act(otherProfile,extension.type,extension),otherProfile));
check(()=>assert.equal(act(state,extension.type,{...extension,at:task.expiresAt}),state));
check(()=>assert.equal(tick(prolonged,30*3600000-1),prolonged));
check(()=>assert.equal(tick(prolonged,30*3600000).tasks.length,0));
// Expiration does not disturb an unrelated in-progress drawing round.
let later=accept();later=act(later,'NEW_ROUND');const laterRound=clone(later.round);later=tick(later);
check(()=>assert.deepEqual(later.round,laterRound));
check(()=>assert.equal(later.phase,'category'));
check(()=>assert.equal(later.stats.totalCompleted,0));
// Old accepted saves are queued deterministically from their original acceptedAt.
const legacy=clone(state);delete legacy.tasks;
const legacyBefore=JSON.stringify(legacy),migrated=G.normalizeState(legacy,{at:after(1000)});
check(()=>assert(migrated&&G.validateState(migrated)));
check(()=>assert.equal(migrated.tasks[0].createdAt,at));
check(()=>assert.equal(migrated.history.filter(r=>r.id===id).length,1));
check(()=>assert.equal(JSON.stringify(legacy),legacyBefore));
check(()=>assert.equal(G.normalizeState(migrated,{at:after(2000)}),migrated));
const undated=clone(legacy);undated.round.acceptedAt=null;
check(()=>assert.equal(G.normalizeState(undated,{at:after(1000)}).tasks[0].createdAt,after(1000)));
const scoredLegacy=clone(checked);delete scoredLegacy.tasks;
check(()=>assert.equal(G.normalizeState(scoredLegacy).stats.totalCompleted,1));
check(()=>assert.equal(G.normalizeState(scoredLegacy).tasks.length,0));
// Even if a queued snapshot is evicted by the 80-entry history, task completion still records it once.
let evicted=accept();const evictedId=evicted.round.id;evicted=act(evicted,'NEW_ROUND');evicted.history=[];evicted=toggle(evicted,evictedId);evicted=act(evicted,'SWITCH_PLAYER',{player:'a'});evicted=toggle(evicted,evictedId);
check(()=>assert.equal(evicted.stats.totalCompleted,1));
check(()=>assert.equal(evicted.history[0].id,evictedId));
check(()=>assert.equal(evicted.history[0].status,'completed'));
// Malformed tasks are rejected, never silently reset into an empty queue.
for(const mutate of [
 s=>s.tasks=null,s=>s.tasks.push(clone(s.tasks[0])),s=>s.tasks[0].checks.a='yes',s=>{s.tasks[0].checks.a=true;s.tasks[0].checks.b=true;},
 s=>s.tasks[0].checks.other=false,s=>s.tasks[0].expiresAt=after(3599999),s=>s.tasks[0].expiresAt=after(172800001),s=>s.tasks[0].createdAt='bad',s=>s.tasks[0].to='a',
 s=>s.tasks[0].id='onde-2',s=>s.tasks[0].categoryId='detente',s=>s.tasks[0].unexpected=true,s=>s.tasks[0].proposal=123
]){
 const broken=clone(state);mutate(broken);
 check(()=>assert.equal(G.validateState(broken),false));
 check(()=>assert.equal(G.normalizeState(broken),null));
}
console.log(`ONDE twenty-four-hour tasks: ${checks} targeted assertions passed.`);
