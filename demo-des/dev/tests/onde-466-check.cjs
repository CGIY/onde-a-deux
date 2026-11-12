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

assert.deepEqual([G.rules.categorySides,G.rules.cardSides,G.rules.variantSides],[4,6,6]);
assert.deepEqual(G.categories.map(category=>category.id),['complicite','attention','projets','intimite']);
assert.deepEqual(G.legacyCategories.map(category=>category.id),['complicite','detente','projets','attention','bouffe','intimite']);
assert.deepEqual([G.categorySides(2),G.categorySides(1)],[4,6]);
assert.equal(G.getCategory('attention',1).label,'Attentions');
assert.equal(G.getCategory('attention',2).label,'Offrandes');
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
      blocked(draft,'ROLL_VARIANT',{value:face});
      assert.equal(G.canRerollCard(draft),true);
      assert.deepEqual(G.normalizeState(clone(draft)),draft);
      branches++;
      lastDraft=draft;
    }
  }
}
assert.equal(branches,144);

let accepted=act(lastDraft,'SEND');
assert.equal(accepted.phase,'pending');
accepted=act(accepted,'SWITCH_PLAYER',{player:'b'});
accepted=act(accepted,'ACCEPT');
assert.equal(accepted.phase,'accepted');
assert.equal(accepted.round.autoProposed,false);
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

// Older D8 saves keep the wording that was selected before the edit.
for(const [cardId,face,oldText,newText] of [
 ['eight-complicite-baiser',2,'Sur la joue, par surprise','Sur la joue'],
 ['eight-complicite-baiser',3,'Sur le bout du nez','Sur la bouche'],
 ['eight-complicite-baiser',4,'Sur le dos de la main','Avec la langue'],
 ['eight-complicite-baiser',5,'En guise de bonjour','Sur une partie intime'],
 ['eight-complicite-aide',2,'Une décision où un deuxième avis ferait du bien','Un deuxième avis sur ce que tu veux'],
 ['eight-complicite-aide',4,'Quelque chose de cassé à réparer ensemble','Quelque chose à terminer ensemble']
]){
 const initial=G.createState();
 const cocon=act(initial,'ROLL_CATEGORY',{value:1,...G.drawCategory(initial,1,4,sides=>sides)});
 const picked=act(cocon,'ROLL_CARD',{value:cocon.round.hand.indexOf(cardId)+1});
 const draft=act(picked,'ROLL_VARIANT',{value:face});
 const oldDraft=clone(draft);
 oldDraft.round.proposal=null;
 for(const [saved,text] of [[oldDraft,oldText],[draft,newText]]){
  assert.equal(G.getVariant(G.normalizeState(clone(saved)).round),text);
  const sent=act(saved,'SEND',{directQueue:true});
  assert.equal(G.getVariant(sent.tasks[0]),text);
  assert.equal(G.getVariant(sent.history[0]),text);
  const received=act(sent,'SWITCH_PLAYER',{player:'b'});
  const refused=act(received,'REFUSE_TASK',{taskId:sent.round.id,value:11});
  assert.equal(G.getVariant(refused.history[0]),text);
 }
 assert.equal(act(draft,'REROLL_CARD',{value:1}).round.proposal,null);
}

console.log('Dés·ir 4×6×6 : 144 branches validées, relance, persistance et anciens tirages vérifiés.');
