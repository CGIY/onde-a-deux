'use strict';
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
let checks=0;
const check=(fn)=>{fn();checks++;};
const clone=value=>JSON.parse(JSON.stringify(value));
const cat=G.legacyCategories[0];
const hand=G.legacyCards.filter(card=>card.categoryId===cat.id).slice(0,4).map(card=>card.id);
function draft(){let s=G.createState();s=G.reduce(s,{type:'ROLL_CATEGORY',value:cat.number,hand});return G.reduce(s,{type:'ROLL_CARD',value:1});}
check(()=>assert.deepEqual(G.legacyCategories.map(c=>c.number),[1,2,3,4,5,6]));
check(()=>assert.equal(G.legacyCategories.find(c=>c.number===3).id,'projets'));
check(()=>assert.equal(G.rules.dailyRoundLimit,null));
check(()=>assert.equal(G.rules.activeRoundLimit,1));
for(const [hp,chance] of [[10,.91],[15,.7725],[20,.5725],[25,.34],[30,.165],[35,.0525],[40,.0025]])check(()=>assert.equal(G.probability(hp),chance));
for(const legacyCounts of [
 {complicite:1,detente:2,tendresse:3,attention:4,decouverte:5,intimite:6},
 {complicite:4,detente:2,attention:4,bouffe:5,intimite:6}
]){
 const old=G.createState();old.stats={totalCompleted:21,byCategory:legacyCounts};
 const before=JSON.stringify(old),migrated=G.normalizeState(old);
 check(()=>assert(migrated&&G.validateState(migrated)));
 check(()=>assert.equal(migrated.stats.totalCompleted,21));
 check(()=>assert.equal(migrated.stats.byCategory.complicite,4));
 check(()=>assert.equal(JSON.stringify(old),before));
 check(()=>assert.equal(G.normalizeState(migrated),migrated));
}
let old=draft();old.round.hp=10;
old=G.reduce(old,{type:'CHALLENGE_DRAFT'});
old=G.reduce(old,{type:'ROLL_DRAFT_DEFENSE',value:10,token:'old-pv'});
check(()=>assert.equal(old.phase,'resolved'));
check(()=>assert.equal(old.round.hp,10));
check(()=>assert.equal(G.normalizeState(old),old));
check(()=>assert.equal(G.normalizeState(clone(old)).round.hp,10));
const historical=clone(old);historical.stats.byCategory={complicite:0,detente:0,attention:0,bouffe:0,intimite:0};
check(()=>assert.equal(G.normalizeState(historical).round.status,'defended'));
check(()=>assert.equal(G.normalizeState(historical).round.hp,10));
const noPv=draft();noPv.round.hp=null;
check(()=>assert.equal(G.normalizeState(noPv).round.hp,G.getCard(noPv.round.cardId).hp));
const paused=draft();paused.round.hp=40;paused.stats.byCategory={complicite:0,detente:0,attention:0,bouffe:0,intimite:0};
check(()=>assert.equal(G.normalizeState(paused).round.hp,40));
const finalSequence=G.createState();finalSequence.sequence=Number.MAX_SAFE_INTEGER;finalSequence.round.id='onde-'+finalSequence.sequence;
check(()=>assert.equal(G.reduce(finalSequence,{type:'NEW_ROUND'}),finalSequence));
const invalidSequence=G.createState();invalidSequence.sequence=Number.MAX_SAFE_INTEGER+1;invalidSequence.round.id='onde-'+invalidSequence.sequence;
check(()=>assert.equal(G.validateState(invalidSequence),false));
// The next drawer alternates after a stop, regardless of who stopped it.
for(const from of ['a','b'])for(const closedBy of ['a','b']){
 let s=G.createState();if(from==='b')s=G.reduce(s,{type:'SWITCH_PLAYER',player:from});
 s=G.reduce(s,{type:'ROLL_CATEGORY',value:cat.number,hand});s=G.reduce(s,{type:'ROLL_CARD',value:1});s=G.reduce(s,{type:'SEND'});
 if(s.activePlayer!==closedBy)s=G.reduce(s,{type:'SWITCH_PLAYER',player:closedBy});
 s=G.reduce(s,{type:'PASS'});s=G.reduce(s,{type:'NEW_ROUND'});
 check(()=>assert(G.validateState(s)));
 check(()=>assert.equal(s.round.from,G.otherPlayer(from)));
 check(()=>assert.equal(s.activePlayer,s.round.from));
}
for(const category of G.legacyCategories){
 const s=G.createState();
 const available=G.legacyCards.filter(c=>c.categoryId===category.id).map(c=>c.id);
 s.seen[category.id]=available.slice(0,8);
 const recent=s.seen[category.id].slice(0,Math.min(8,available.length-4));
 const drawn=G.drawHand(s,category.id);
 check(()=>assert.equal(drawn.length,4));
 check(()=>assert.equal(new Set(drawn).size,4));
 check(()=>assert(drawn.every(id=>G.getCard(id).categoryId===category.id&&!recent.includes(id))));
}
console.log(`ONDE rules audit: ${checks} targeted assertions passed.`);
