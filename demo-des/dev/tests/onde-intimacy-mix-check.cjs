'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const G=require('../src/onde-app-core.js');
const titles=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/hardcore-cards.json'),'utf8'));
const at='2026-11-08T11:00:00.000Z',later='2026-11-08T11:01:00.000Z';
const copy=value=>structuredClone(value);
let checks=0;
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const ok=(value,message)=>{checks++;assert.ok(value,message);};
const rejects=fn=>{checks++;assert.throws(fn,RangeError);};
function act(room,type,actor='a',extra={}){
  const next=G.reduceRoom(room,{type,actor,roundId:room.lanes[actor].round.id,at,...extra});
  ok(next!==room,'action must change room: '+type);ok(G.validateRoom(next),'valid room after '+type);return next;
}
function category(room=G.createRoom({at}),{actor='a',category=4,mode=20,type='ROLL_CATEGORY',hand}={}){
  let first=true;
  const draw=n=>{if(category===4&&first){first=false;return mode;}return n;};
  const prepared=G.drawCategory(G.roomView(room,actor),category,3,draw);
  return act(room,type,actor,{value:category,category,...prepared,...(hand?{hand}:{})});
}
const metric=(room,id,actor='a')=>G.badgeView(room,actor).items.find(item=>item.id===id).progress.value;
const draft=(room,face=1,actor='a')=>{
  let next=act(room,'ROLL_CARD',actor,{value:face});
  if(G.needsVariant(next.lanes[actor].round))next=act(next,'ROLL_VARIANT',actor,{value:2});
  return next;
};
function completed(room,actor='a'){
  const taskId=room.lanes[actor].round.id;
  room=act(room,'SEND',actor,{directQueue:true});
  room=act(room,'TOGGLE_TASK_CHECK',actor,{taskId,checked:true,at:later});
  return act(room,'TOGGLE_TASK_CHECK',G.otherPlayer(actor),{taskId,checked:true,at:later});
}

// Catalogue identifiers and supplied wording stay immutable. The new content
// is separate from the 24 classic families, with no invented variant or HP.
eq(G.cards.length,24);eq(G.hardcoreCards.length,20);
eq(Object.fromEntries(G.hardcoreCards.map(card=>[card.id,card.title])),titles);
eq(new Set([...G.cards,...G.hardcoreCards].map(card=>card.id)).size,44);
for(const card of G.hardcoreCards){
  eq(G.getCard(card.id),card);eq(card.categoryId,'intimite');eq(card.variants,undefined);eq(card.hp,undefined);
  eq(Object.keys(card).sort(),['categoryId','id','title']);eq(G.getVariant({cardId:card.id,variantRoll:1}),null);
}
eq(G.createRoom().lanes.a.round.intimacyPool,undefined,'blank archived schema is unchanged');
eq(G.needsVariant(G.createState().round),false);
eq(G.needsVariant({catalogueVersion:2,categoryId:'intimite'}),true);
eq(G.needsVariant({catalogueVersion:3,categoryId:'intimite',intimacyPool:'classic'}),true);
eq(G.needsVariant({catalogueVersion:3,categoryId:'intimite',intimacyPool:'hardcore'}),false);

// Exhaust all exact category tickets and all sub-pool faces. The outer 60%
// remains unchanged, with half of Intimacy outcomes assigned to each pool.
for(const [time,total,expected] of [
  [at,155,{complicite:440,attention:400,projets:400,classic:930,hardcore:930}],
  ['2026-11-09T11:00:00.000Z',42,{complicite:220,attention:200,projets:200,classic:110,hardcore:110}]
]){
  const counts={complicite:0,attention:0,projets:0,classic:0,hardcore:0};
  for(let ticket=1;ticket<=total;ticket++){
    const face=G.rollCategory(3,n=>{eq(n,total);return ticket;},time);
    eq(face,G.rollCategory(2,()=>ticket,time),'v3 category distribution matches published v2');
    for(let mode=1;mode<=20;mode++){
      let first=true;const calls=[];
      const prepared=G.drawCategory(G.createState(),face,3,n=>{calls.push(n);if(face===4&&first){first=false;return mode;}return n;});
      const id=G.categories.find(c=>c.number===face).id;
      counts[id==='intimite'?prepared.intimacyPool:id]++;
      eq(prepared.catalogueVersion,3);eq(prepared.hand.length,6);eq(new Set(prepared.hand).size,6);
      eq(prepared.intimacyPool,id==='intimite'?(mode<=10?'classic':'hardcore'):null);
      eq(prepared.modeRoll,id==='intimite'?mode:null);
      eq(calls,face===4?[20,...Array.from({length:mode<=10?5:19},(_,i)=>(mode<=10?6:20)-i)]:[6,5,4,3,2]);
    }
  }
  eq(counts,expected);
}

// Exercise every rank of every shuffle stage. With all other stages left
// unchanged, the sampled six must match that single transposition. Repeated
// titles in seen must never remove or weight an entry in the Hardcore pool.
const ids=G.hardcoreCards.map(card=>card.id),seen=G.createState();seen.seen.intimite=ids.slice(0,8);
for(let stage=20;stage>=2;stage--)for(let rank=1;rank<=stage;rank++){
  const bounds=[],draw=n=>{bounds.push(n);return n===stage?rank:n;};
  const hand=G.drawHand(seen,4,3,'hardcore',draw),expected=ids.slice();
  [expected[stage-1],expected[rank-1]]=[expected[rank-1],expected[stage-1]];
  eq(hand,expected.slice(0,6));eq(bounds,Array.from({length:19},(_,i)=>20-i));
  eq(hand,G.drawHand(G.createState(),4,3,'hardcore',n=>n===stage?rank:n),'seen never changes Hardcore sampling');
}
for(const bad of [0,21,1.5,NaN])rejects(()=>G.drawCategory(G.createState(),4,3,()=>bad));
for(const bad of [0,21,1.5,NaN])rejects(()=>G.drawHand(G.createState(),4,3,'hardcore',()=>bad));
rejects(()=>G.drawHand(G.createState(),1,3,'hardcore'));
rejects(()=>G.drawCategory(G.createState(),99,3));

for(const actor of ['a','b'])for(const mode of [1,10,11,20]){
  const initial=category(undefined,{actor,mode}),round=initial.lanes[actor].round,hardcore=mode>10;
  eq(round.catalogueVersion,3);eq(round.intimacyPool,hardcore?'hardcore':'classic');eq(round.hardcoreOffer,false);
  eq(G.needsVariant(round),!hardcore);eq(G.cardsForRound(round),hardcore?G.hardcoreCards:G.cards);
  for(let face=1;face<=6;face++){
    let selected=act(initial,'ROLL_CARD',actor,{value:face});
    eq(selected.lanes[actor].phase,hardcore?'draft':'variant');eq(selected.lanes[actor].round.cardId,round.hand[face-1]);
    if(hardcore){
      eq(selected.lanes[actor].round.hp,null);eq(selected.lanes[actor].round.variantRoll,undefined);
      eq(G.reduceRoom(selected,{type:'ROLL_VARIANT',actor,value:1,at}),selected,'no fake extra variant step');
    }else selected=act(selected,'ROLL_VARIANT',actor,{value:3});
    const before=copy(selected),rerolled=act(selected,'REROLL_CARD',actor,{value:face===6?1:face+1});
    eq(rerolled.lanes[actor].round.hand,round.hand);eq(rerolled.lanes[actor].round.intimacyPool,round.intimacyPool);
    eq(rerolled.lanes[actor].phase,hardcore?'draft':'variant');eq(selected,before,'reroll is pure');
    eq(rerolled.progression,selected.progression,'reroll grants no additional badge credit');
    const taskId=selected.lanes[actor].round.id,sent=act(selected,'SEND',actor,{directQueue:true}),task=sent.tasks[0];
    eq(sent.pendingRounds,[]);eq(task.cardId,selected.lanes[actor].round.cardId);eq(task.catalogueVersion,3);eq(task.intimacyPool,round.intimacyPool);
    eq(task.variantRoll,hardcore?undefined:3);eq(task.checks,{a:false,b:false});eq(sent.stats.totalCompleted,0);
    const single=act(sent,'TOGGLE_TASK_CHECK',actor,{taskId,checked:true,at:later});eq(single.stats.totalCompleted,0);
    const done=act(single,'TOGGLE_TASK_CHECK',G.otherPlayer(actor),{taskId,checked:true,at:later});
    eq(done.tasks,[]);eq(done.stats.totalCompleted,1);eq(done.stats.byCategory.intimite,1);
    eq(done.history[0].catalogueVersion,3);eq(done.history[0].intimacyPool,round.intimacyPool);eq(done.history[0].variantRoll,task.variantRoll);
    eq(done.progression.individual[actor].draws,1);eq(done.progression.individual[actor].proposals,1);
    eq(done.progression.individual.a.participations,1);eq(done.progression.individual.b.participations,1);
    eq(done.progression.shared.completedByCard[task.cardId],1);
    eq(Object.keys(done.progression.shared.completedByVariant).length,hardcore?0:1);
    eq(metric(done,'duo-distinct-cards-6'),1);eq(metric(done,'duo-distinct-variants-12'),hardcore?0:1);
    for(const kind of ['REFUSE_TASK','TOGGLE_TASK_CHECK'])eq(G.reduceRoom(done,{type:kind,actor:G.otherPlayer(actor),taskId,value:20,checked:true,at:later}),done,'completed task cannot reward twice');
    if(hardcore){
      for(let refusal=1;refusal<=20;refusal++){
        const refused=act(sent,'REFUSE_TASK',G.otherPlayer(actor),{taskId,value:refusal,at:later});
        eq(refused.tasks,[]);eq(refused.stats.totalCompleted,0);eq(refused.history[0].refusalRoll,refusal);eq(refused.progression,sent.progression);
      }
      const noHistory=copy(sent);noHistory.history=[];ok(G.validateRoom(noHistory));
      const expired=act(noHistory,'EXPIRE_TASKS',G.otherPlayer(actor),{at:'2026-11-09T11:00:00.000Z'});
      eq(expired.tasks,[]);eq(expired.history[0].catalogueVersion,3);eq(expired.history[0].intimacyPool,'hardcore');eq(expired.history[0].variantRoll,undefined);
    }
  }
}

// Category rerolls choose a fresh pool but use the same once-per-day control.
let reroll=category(undefined,{mode:20});
reroll=category(reroll,{mode:1,type:'REROLL_CATEGORY'});eq(reroll.lanes.a.round.intimacyPool,'classic');eq(reroll.lanes.a.round.variantRoll,null);
eq(reroll.progression.individual.a.draws,1);eq(reroll.dailyReroll.used,['a']);
const again=G.drawCategory(G.roomView(reroll,'a'),4,3,n=>n);
eq(G.reduceRoom(reroll,{type:'REROLL_CATEGORY',actor:'a',value:4,...again,at}),reroll);
const joker=category(undefined,{mode:20,type:'JOKER_DRAW'});eq(joker.joker.usedBy,'a');eq(joker.progression.individual.a.draws,1);eq(joker.lanes.a.round.intimacyPool,'hardcore');

// Every existing title can travel through the ordinary task path. It contributes
// to total/category/diversity badges, while exact classic variant criteria stay 0.
let collection=G.createRoom({at});
for(const id of ids){
  const hand=[id,...ids.filter(other=>other!==id).slice(0,5)];
  collection=completed(draft(category(collection,{hand})));eq(collection.progression.shared.completedByCard[id],1);
}
eq(collection.stats.totalCompleted,20);eq(collection.progression.shared.completed,20);eq(collection.progression.shared.byCategory.intimite,20);
eq(metric(collection,'duo-distinct-cards-24'),20);eq(metric(collection,'duo-distinct-variants-72'),0);
eq(collection.progression.shared.completedByVariant,{});
for(const badge of G.badgeCatalog.filter(b=>b.criterion.cardId))eq(metric(collection,badge.id),badge.criterion.variantRoll===undefined?1:0);
for(const actor of ['a','b'])ok(G.validateBadgeView(G.badgeView(collection,actor),actor));

// An absent register imports only evidenced minima, recognizes v3 category 4,
// and keeps one completion despite duplicate representations in task/history.
const imported=copy(collection);delete imported.progression;ok(G.validateRoom(imported));
eq(metric(imported,'duo-completed-1'),20);eq(metric(imported,'duo-distinct-cards-24'),20);
eq(metric(imported,'ind-draws-1'),20);eq(metric(imported,'duo-distinct-variants-72'),0);
for(const item of G.badgeView(imported,'a').items.filter(item=>item.award)){eq(item.award.at,null);eq(item.award.source,'imported');}
let next=completed(draft(category(imported,{mode:1})));eq(next.progression.shared.completed,21);
eq(next.progression.individual.a.draws,21);eq(next.progression.shared.completedByVariant[`${next.history[0].cardId}:v2`],1);

// Reject corrupt combinations that could disguise a title as a classic variant,
// reopen the removed offer, or move an HC title into a legacy catalogue.
const hcDraft=draft(category());
for(const mutate of [
  round=>{round.catalogueVersion=2;},round=>{delete round.catalogueVersion;delete round.intimacyPool;},
  round=>{round.intimacyPool='classic';},round=>{round.modeRoll=1;},round=>{round.variantRoll=1;},
  round=>{round.hp=20;},round=>{round.hardcoreOffer=true;},round=>{round.hand[1]=G.cards[0].id;}
]){const broken=copy(hcDraft);mutate(broken.lanes.a.round);eq(G.validateRoom(broken),false);}
const hcTask=act(hcDraft,'SEND','a',{directQueue:true});
for(const mutate of [task=>{delete task.catalogueVersion;},task=>{task.intimacyPool='classic';},task=>{task.variantRoll=1;}]){
  const broken=copy(hcTask);mutate(broken.tasks[0]);eq(G.validateRoom(broken),false);
}
const fakeVariant=copy(collection);fakeVariant.progression.shared.completedByVariant['hardcore-01:v1']=1;eq(G.validateRoom(fakeVariant),false);

console.log(`Dés·ir Intimacy mix: ${checks} catalogue identity, exact probabilities, uniform shuffle, legacy shape, direct tasks, rerolls, refusal, quotas and badge assertions passed.`);
