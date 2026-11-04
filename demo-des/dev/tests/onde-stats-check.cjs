const assert=require('node:assert/strict');
const G=require(require('node:path').join(__dirname,'../src/onde-app-core.js'));
let checks=0;
const check=(fn)=>{fn();checks++;};
function action(state,type,rest={}) {
  const next=G.reduce(state,{at:'2026-11-02T12:00:00.000Z',type,...rest});
  assert(G.validateState(next),`${type} must produce valid state`);
  return next;
}
function complete(state) {const taskId=state.round.id;state=action(state,'TOGGLE_TASK_CHECK',{taskId,checked:true});state=action(state,'SWITCH_PLAYER',{player:G.otherPlayer(state.activePlayer)});return action(state,'TOGGLE_TASK_CHECK',{taskId,checked:true});}
function draft(state,category=0) {
  const cat=G.legacyCategories[category];
  const hand=G.legacyCards.filter(card=>card.categoryId===cat.id).slice(0,4).map(card=>card.id);
  state=action(state,'ROLL_CATEGORY',{value:cat.number,hand});
  return action(state,'ROLL_CARD',{value:1});
}
function accept(state,category=0) {
  state=draft(state,category);
  state=action(state,'SEND');
  state=action(state,'SWITCH_PLAYER',{player:state.round.to});
  return action(state,'ACCEPT');
}
let state=G.createState();
check(()=>assert.deepEqual(state.stats,{totalCompleted:0,byCategory:Object.fromEntries(G.legacyCategories.map(c=>[c.id,0]))}));
state=accept(state);
check(()=>assert.equal(state.stats.totalCompleted,0));
state=complete(state);
check(()=>assert.equal(state.stats.totalCompleted,1));
check(()=>assert.equal(state.stats.byCategory[G.legacyCategories[0].id],1));
check(()=>assert.equal(action(state,'COMPLETE'),state));
for(let i=1;i<95;i++) {
  state=action(state,'NEW_ROUND');
  state=accept(state,i%2);
  state=complete(state);
}
check(()=>assert.equal(state.history.length,80));
check(()=>assert.equal(state.stats.totalCompleted,95));
check(()=>assert.equal(state.stats.byCategory[G.legacyCategories[0].id],48));
check(()=>assert.equal(state.stats.byCategory[G.legacyCategories[1].id],47));
const restored=G.normalizeState(JSON.parse(JSON.stringify(state)));
check(()=>assert.deepEqual(restored,state));
check(()=>assert.equal(restored.stats.totalCompleted,95));
let passed=accept(action(state,'NEW_ROUND'),2);
passed=action(passed,'PASS');
check(()=>assert.deepEqual(passed.stats,state.stats));
let defended=draft(action(passed,'NEW_ROUND'));
defended=action(defended,'SEND');
defended=action(defended,'SWITCH_PLAYER',{player:defended.round.to});
defended=action(defended,'CHALLENGE');
defended=action(defended,'ROLL_DEFENSE',{value:20,token:'score-1'});
if(defended.phase==='challenge')defended=action(defended,'ROLL_DEFENSE',{value:20,token:'score-2'});
check(()=>assert.equal(defended.round.status,'defended'));
check(()=>assert.deepEqual(defended.stats,state.stats));
const legacy=JSON.parse(JSON.stringify(defended));
delete legacy.stats;
legacy.players[0].name='Prénom de test';
legacy.favorites=[G.legacyCards[0].id];
legacy.prefs.sound=true;
const legacyBefore=JSON.stringify(legacy);
const migrated=G.normalizeState(legacy);
const recovered=new Map(legacy.history.filter(r=>r.status==='completed').map(r=>[r.id,r]));
check(()=>assert.equal(migrated.stats.totalCompleted,recovered.size));
check(()=>assert.equal(migrated.stats.totalCompleted,78));
check(()=>assert.equal(JSON.stringify(legacy),legacyBefore));
check(()=>assert.deepEqual(migrated.round,legacy.round));
check(()=>assert.deepEqual(migrated.players,legacy.players));
check(()=>assert.deepEqual(migrated.favorites,legacy.favorites));
check(()=>assert.deepEqual(migrated.prefs,legacy.prefs));
check(()=>assert.equal(G.normalizeState(migrated),migrated));
const duplicateLegacy=JSON.parse(JSON.stringify(legacy));
duplicateLegacy.history=[...recovered.values()].slice(0,2);
duplicateLegacy.history.push({...duplicateLegacy.history[0]});
check(()=>assert.equal(G.normalizeState(duplicateLegacy).stats.totalCompleted,2));
const blankLegacy=G.createState();delete blankLegacy.stats;
check(()=>assert.equal(G.normalizeState(blankLegacy).stats.totalCompleted,0));
for(const mutate of [
 s=>s.stats.totalCompleted=-1,
 s=>s.stats.totalCompleted=1.5,
 s=>s.stats.byCategory[G.legacyCategories[0].id]=-1,
 s=>s.stats.byCategory[G.legacyCategories[0].id]=.5,
 s=>s.stats.byCategory[G.legacyCategories[0].id]++,
 s=>s.stats.byCategory.extra=0,
 s=>delete s.stats.byCategory[G.legacyCategories[0].id],
 s=>s.stats.totalCompleted=Number.MAX_SAFE_INTEGER+1
]) {
 const broken=JSON.parse(JSON.stringify(state));mutate(broken);
 check(()=>assert.equal(G.validateState(broken),false));
 check(()=>assert.equal(G.normalizeState(broken),null));
}
let replay=accept(G.createState());
const alreadyCompleted=complete(replay);
replay=alreadyCompleted;
check(()=>assert.equal(action(replay,'COMPLETE').stats.totalCompleted,1));
check(()=>assert.equal(action(state,'RESET').stats.totalCompleted,0));
check(()=>assert(G.legacyCategories.every(c=>action(state,'RESET').stats.byCategory[c.id]===0)));
console.log(`ONDE cumulative scoring: ${checks} targeted assertions passed; 95 completions persist beyond 80 history entries.`);
