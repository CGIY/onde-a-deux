const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');

const at='2026-11-04T14:00:00.000Z';
const clone=value=>JSON.parse(JSON.stringify(value));
const blocked=(state,type,fields={})=>assert.equal(G.reduce(state,{type,at,...fields}),state,type+' must be blocked');
function act(state,type,fields={}){
  const next=G.reduce(state,{type,at,...fields});
  assert.notEqual(next,state,type+' must take effect');
  assert.ok(G.validateState(next),type+' must produce a valid state');
  return next;
}

assert.deepEqual([G.rules.categorySides,G.rules.cardSides,G.rules.variantSides,G.rules.challengeSides],[4,6,6,20]);
assert.deepEqual(G.categories.map(category=>category.id),['complicite','attention','projets','intimite']);
assert.deepEqual(G.legacyCategories.map(category=>category.id),['complicite','detente','projets','attention','bouffe','intimite']);
assert.deepEqual([G.categorySides(2),G.categorySides(1)],[4,6]);
assert.equal(G.getCategory('attention',1).label,'Attentions');
assert.equal(G.getCategory('attention',2).label,'Plaisirs');
assert.equal(G.getCategory('intimite',1).number,6);
assert.equal(G.getCategory('intimite',2).number,4);
assert.equal(G.cards.length,24);
assert.equal(new Set(G.cards.map(card=>card.id)).size,24);

// An untouched shared round belongs to whichever player actually rolls first.
for(const actor of ['a','b']){
 const idle={...G.createState(),activePlayer:actor};
 assert.equal(G.canSeeRound(idle,actor),true);
 const hand=G.drawHand(idle,1,2);
 const claimed=act(idle,'ROLL_CATEGORY',{actor,catalogueVersion:2,value:1,hand});
 assert.equal(claimed.round.from,actor);
 assert.equal(claimed.round.to,G.otherPlayer(actor));
 assert.equal(G.canSeeRound(claimed,G.otherPlayer(actor)),false);
 const partner={...claimed,activePlayer:G.otherPlayer(actor)};
 blocked(partner,'ROLL_CATEGORY',{catalogueVersion:2,value:1,hand});
}

let branches=0;
let lastDraft;
for(const category of G.categories){
  const state=G.createState();
  const hand=G.drawHand(state,category.number,2);
  const cards=G.cards.filter(card=>card.categoryId===category.id);
  assert.equal(cards.length,6);
  assert.deepEqual([...hand].sort(),cards.map(card=>card.id).sort());
  blocked(state,'ROLL_CATEGORY',{value:category.number,hand});
  blocked(state,'ROLL_CATEGORY',{value:category.number,hand:hand.slice(0,4),catalogueVersion:2});
  blocked(state,'ROLL_CATEGORY',{value:category.number,hand:[hand[0],...hand.slice(0,5)],catalogueVersion:2});
  blocked(state,'ROLL_CATEGORY',{value:category.number,hand:G.drawHand(state,category.number),catalogueVersion:2});
  blocked(state,'ROLL_CATEGORY',{value:5,hand,catalogueVersion:2});
  const dealt=act(state,'ROLL_CATEGORY',{value:category.number,hand,catalogueVersion:2});
  assert.equal(dealt.phase,'card');
  assert.equal(G.cardSides(dealt),6);
  assert.equal(dealt.round.variantRoll,null);
  blocked(dealt,'ROLL_VARIANT',{value:1});
  for(let index=0;index<hand.length;index++){
    const selected=act(dealt,'ROLL_CARD',{value:index+1});
    assert.equal(selected.phase,'variant');
    assert.equal(G.canSeeRound(selected,'b'),false);
    assert.equal(G.getVariant(selected.round),null);
    assert.deepEqual(G.normalizeState(clone(selected)),selected);
    blocked(selected,'SEND');
    blocked(selected,'CHALLENGE_DRAFT');
    blocked(selected,'PASS');
    blocked(selected,'ROLL_VARIANT',{value:1,roundId:'onde-99'});
    blocked(selected,'ROLL_VARIANT',{value:1,actor:'b'});
    for(const value of [undefined,0,7,1.5,'2']) blocked(selected,'ROLL_VARIANT',{value});
    const card=G.getCard(hand[index]);
    assert.equal(new Set(card.variants).size,6);
    assert.ok(card.variants.every(label=>typeof label==='string'&&label.trim()));
    for(let face=1;face<=6;face++){
      const draft=act(selected,'ROLL_VARIANT',{value:face});
      assert.equal(draft.phase,'draft');
      assert.equal(G.getVariant(draft.round),card.variants[face-1]);
      assert.equal(draft.round.hp,card.hp);
      assert.equal(G.canChallengeDraft(draft),true);
      blocked(draft,'ROLL_VARIANT',{value:face});
      blocked(draft,'REROLL_CARD',{value:(index+1)%6+1});
      assert.deepEqual(G.normalizeState(clone(draft)),draft);
      branches++;
      lastDraft=draft;
    }
  }
}
assert.equal(branches,144);

let challenged=act(lastDraft,'CHALLENGE_DRAFT');
challenged=act(challenged,'ROLL_DRAFT_DEFENSE',{value:1,token:'one'});
blocked(challenged,'ROLL_DRAFT_DEFENSE',{value:20,token:'one'});
challenged=act(challenged,'ROLL_DRAFT_DEFENSE',{value:1,token:'two'});
assert.equal(challenged.phase,'pending');
assert.equal(challenged.round.autoProposed,true);
assert.equal(challenged.round.variantRoll,lastDraft.round.variantRoll);
challenged=act(challenged,'SWITCH_PLAYER',{player:'b'});
challenged=act(challenged,'ACCEPT');
assert.equal(challenged.phase,'sender_confirmation');
challenged=act(challenged,'SWITCH_PLAYER',{player:'a'});
let accepted=act(challenged,'ACCEPT');
const {id,variantRoll}=accepted.round;
const variant=G.getVariant(accepted.round);
assert.equal(G.getVariant(accepted.tasks[0]),variant);
assert.equal(G.getVariant(accepted.history[0]),variant);

const corrupt=clone(accepted);
corrupt.tasks[0].variantRoll=variantRoll===1?2:1;
assert.equal(G.normalizeState(corrupt),null);
accepted=act(accepted,'NEW_ROUND');
accepted=act(accepted,'TOGGLE_TASK_CHECK',{taskId:id,checked:true});
accepted=act(accepted,'SWITCH_PLAYER',{player:'a'});
accepted=act(accepted,'TOGGLE_TASK_CHECK',{taskId:id,checked:true});
assert.equal(accepted.stats.totalCompleted,1);
assert.equal(accepted.stats.byCategory.intimite,1);
assert.equal(G.getVariant(accepted.history[0]),variant);
assert.deepEqual(G.normalizeState(clone(accepted)),accepted);

const fresh=G.createState();
const legacyHand=G.drawHand(fresh,'detente');
let legacy=act(fresh,'ROLL_CATEGORY',{value:2,hand:legacyHand});
assert.equal(G.cardSides(legacy),4);
legacy=act(legacy,'ROLL_CARD',{value:2});
assert.equal(legacy.phase,'draft');
assert.equal(legacy.round.variantRoll,undefined);
assert.equal(G.canRerollCard(legacy),true);

const experimental=clone(legacy);
const oldCard=experimental.round.cardId;
const oldComplicite=G.legacyCards.filter(card=>card.categoryId==='complicite');
experimental.round.categoryId='complicite';
experimental.round.categoryRoll=1;
experimental.round.hand=[oldComplicite[0].id,oldCard,...oldComplicite.slice(1,5).map(card=>card.id)];
experimental.stats={totalCompleted:5,byCategory:{complicite:2,attention:3,projets:0,intimite:0}};
experimental.seen={complicite:[oldComplicite[0].id,oldCard]};
const restored=G.normalizeState(experimental);
assert.ok(restored);
assert.equal(restored.round.categoryId,'detente');
assert.equal(restored.round.cardId,oldCard);
assert.equal(restored.round.cardRoll,2);
assert.equal(restored.round.hand[1],oldCard);
assert.equal(G.cardSides(restored),6);
assert.deepEqual(restored.seen,{complicite:[oldComplicite[0].id],detente:[oldCard]});
assert.deepEqual(restored.stats,{totalCompleted:5,byCategory:{complicite:2,detente:0,projets:0,attention:3,bouffe:0,intimite:0}});

const sharedScore={totalCompleted:21,byCategory:{complicite:1,detente:2,projets:3,attention:4,bouffe:5,intimite:6}};
assert.deepEqual(G.categories.map(category=>G.categoryScore(sharedScore,category.id)),[3,9,3,6]);
assert.equal(G.categories.reduce((total,category)=>total+G.categoryScore(sharedScore,category.id),0),sharedScore.totalCompleted);

console.log('Dés·ir 4×6×6 : 144 branches validées, D20, persistance et anciens tirages vérifiés.');
