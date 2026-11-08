'use strict';
const assert=require('node:assert/strict');
const G=require('../src/onde-app-core.js');
const copy=value=>structuredClone(value),at='2026-11-08T10:00:00.000Z';
let checks=0;
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const ok=(value,message)=>{checks++;assert.ok(value,message);};
const item=(state,actor,id)=>G.badgeView(state,actor).items.find(item=>item.id===id);
const earned=(state,actor)=>G.badgeView(state,actor).items.filter(item=>item.award).map(item=>item.award);
function step(room,type,actor='a',extra={},time=at){
 const next=G.reduceRoom(room,{type,actor,roundId:room.lanes[actor].round.id,at:time,...extra});
 ok(next!==room,'valid fixture transition '+type);ok(G.validateRoom(next),'valid room after '+type);
 return next;
}
function draft(room=G.createRoom({at}),actor='a',cardId=G.cards[0].id,variantRoll=1,time=at){
 const card=G.getCard(cardId),category=G.categories.find(category=>category.id===card.categoryId),hand=G.cards.filter(value=>value.categoryId===card.categoryId).map(value=>value.id);
 room=step(room,'ROLL_CATEGORY',actor,{catalogueVersion:2,value:category.number,hand},time);
 room=step(room,'ROLL_CARD',actor,{value:hand.indexOf(cardId)+1},time);
 return step(room,'ROLL_VARIANT',actor,{value:variantRoll},time);
}
function queue(room,actor='a',cardId=G.cards[0].id,variantRoll=1,time=at){
 room=draft(room,actor,cardId,variantRoll,time);const taskId=room.lanes[actor].round.id;
 room=step(room,'SEND',actor,{directQueue:true},time);return {room,taskId};
}
function finish(room,taskId,first='a',time=at){
 room=step(room,'TOGGLE_TASK_CHECK',first,{taskId,checked:true},time);
 return step(room,'TOGGLE_TASK_CHECK',G.otherPlayer(first),{taskId,checked:true},time);
}
function complete(room,actor='a',cardId=G.cards[0].id,variantRoll=1,time=at){
 const queued=queue(room,actor,cardId,variantRoll,time);return finish(queued.room,queued.taskId,actor,time);
}
// Catalogue checks use real cards and fixed IDs. The one approved description
// differs intentionally from the source JSON supplied during catalogue review.
eq(G.badgeCatalog.length,60);eq(new Set(G.badgeCatalog.map(badge=>badge.id)).size,60);
eq(new Set(G.badgeCatalog.map(badge=>badge.title)).size,60);
for(const scope of ['individual','shared'])eq(G.badgeCatalog.filter(badge=>badge.scope===scope).length,30);
for(const badge of G.badgeCatalog){
 ok(Number.isSafeInteger(badge.target)&&badge.target>0);eq(badge.target,badge.criterion.threshold);
 if(badge.criterion.categoryId)ok(G.categories.some(category=>category.id===badge.criterion.categoryId));
 if(badge.criterion.cardId){const card=G.getCard(badge.criterion.cardId);ok(card);ok(card.variants[badge.criterion.variantRoll-1]);}
}
eq(G.badgeCatalog.find(badge=>badge.id==='duo-covered-face-3').description,'3 faciales, validées par vos deux coches.');

// A read never creates a registry. The first real event keeps the same epoch
// and awards the real first draw, not an imported/baseline achievement.
{
 const initial=G.createRoom({at}),saved=copy(initial),before=G.badgeView(initial,'a');
 eq(initial,saved);eq(initial.progression,undefined);ok(G.validateBadgeView(before,'a'));
 let room=draft(initial);eq(room.progression.epoch,before.epoch);eq(G.badgeView(room,'a').epoch,before.epoch);
 const award=item(room,'a','ind-draws-1').award;
 eq(award.at,at);eq(award.source,undefined);eq(award.sequence,1);eq(item(room,'b','ind-draws-1').award,null);
 eq(room.progression.individual.a.draws,1);eq(room.progression.individual.b.draws,0);
 const roundId=room.lanes.a.round.id;
 room=step(room,'SEND','a',{directQueue:true});eq(room.progression.individual.a.proposals,1);eq(room.progression.individual.b.proposals,0);
 const sent=copy(room);eq(G.reduceRoom(room,{type:'SEND',actor:'a',roundId,directQueue:true,at}),room);eq(room,sent,'late send does not alter gains');
 eq(room.progression.individual.a.participations,0);eq(room.progression.shared.completed,0,'sharing is not completion');
 room=finish(room,roundId);
 for(const actor of ['a','b']){eq(room.progression.individual[actor].participations,1);ok(item(room,actor,'ind-participations-1').award);ok(item(room,actor,'duo-completed-1').award);ok(G.validateBadgeView(G.badgeView(room,actor),actor));}
 eq(room.progression.individual.a.completedSent,1);eq(room.progression.individual.b.completedReceived,1);
 eq(room.progression.individual.a.completedReceived,0);eq(room.progression.individual.b.completedSent,0);
 const done=copy(room);eq(G.reduceRoom(room,{type:'TOGGLE_TASK_CHECK',actor:'b',roundId:room.lanes.b.round.id,taskId:roundId,checked:true,at}),room);eq(room,done);
}
// A SEND from a draft created before this feature initializes from its BEFORE
// sequence. A private partner gain does not advance this reader's award order.
{
 let oldDraft=draft();delete oldDraft.progression;
 const baseline=G.badgeView(oldDraft,'a'),first=item(oldDraft,'a','ind-draws-1').award;
 eq(first.source,'imported');eq(first.at,null);
 let room=step(oldDraft,'SEND','a',{directQueue:true});eq(G.badgeView(room,'a').epoch,baseline.epoch);eq(item(room,'a','ind-draws-1').award,first);
 eq(item(room,'a','ind-proposals-1').award.at,at);eq(item(room,'a','ind-proposals-1').award.source,undefined);
 const beforeA=G.badgeView(room,'a'),sequenceA=room.progression.sequences.a;
 room=draft(room,'b');eq(G.badgeView(room,'a'),beforeA);eq(room.progression.sequences.a,sequenceA);eq(item(room,'b','ind-draws-1').award.sequence,1);
 const publicText=JSON.stringify(G.badgeView(room,'a'));ok(!publicText.includes('sequenceByActor'));ok(!publicText.includes('individual:b:'));ok(!publicText.includes('activity'));
}
// Counting one real date does not count toggles. The second checkbox's date
// belongs only to its author, even when both receive their final participation.
{
 const friday='2026-11-06T22:59:00.000Z',saturday='2026-11-06T23:01:00.000Z';
 let {room,taskId}=queue(G.createRoom({at:friday}),'a',G.cards[0].id,1,friday);
 room=step(room,'TOGGLE_TASK_CHECK','a',{taskId,checked:true},friday);
 const same=G.reduceRoom(room,{type:'TOGGLE_TASK_CHECK',actor:'a',taskId,checked:true,at:friday});eq(same,room);
 room=step(room,'TOGGLE_TASK_CHECK','a',{taskId,checked:false},friday);
 room=step(room,'TOGGLE_TASK_CHECK','a',{taskId,checked:true},friday);
 eq(room.progression.individual.a.activity.days,1);eq(room.progression.individual.b.activity.days,0);eq(room.progression.shared.completed,0);
 room=step(room,'TOGGLE_TASK_CHECK','b',{taskId,checked:true},saturday);
 eq(room.progression.individual.a.activity.lastDay,'2026-11-06');eq(room.progression.individual.a.activity.days,1);
 eq(room.progression.individual.b.activity.lastDay,'2026-11-07');eq(room.progression.individual.b.activity.days,1);
 eq(room.progression.individual.a.participations,1);eq(room.progression.individual.b.participations,1);eq(room.progression.shared.weekendCompleted,1);
}
// Calendar streaks cross 23-hour and 25-hour days without breaking or doubling.
for(const dates of [
 ['2026-03-28T11:00:00.000Z','2026-03-29T10:00:00.000Z','2026-03-30T10:00:00.000Z'],
 ['2026-10-24T10:00:00.000Z','2026-10-25T11:00:00.000Z','2026-10-26T11:00:00.000Z']
]){
 let room=G.createRoom({at:dates[0]});for(const date of dates)room=complete(room,'a',G.cards[0].id,1,date);
 eq(room.progression.shared.completion.days,3);eq(room.progression.shared.completion.best,3);
 for(const actor of ['a','b']){eq(room.progression.individual[actor].activity.days,3);eq(room.progression.individual[actor].activity.best,3);ok(item(room,actor,'ind-active-streak-3').award);}
 const unchanged=copy(room.progression.individual.a.activity);
 room=complete(room,'a',G.cards[0].id,1,dates[1]);eq(room.progression.individual.a.activity,unchanged,'older dates do not add days or break a streak');
}
// Every exact-variant achievement needs the correct card AND face, completed
// by both players. A refusal, a draw or a different face does not count.
for(const badge of G.badgeCatalog.filter(badge=>badge.criterion.cardId)){
 const {cardId,variantRoll}=badge.criterion,wrongFace=variantRoll===1?2:1;
 let {room,taskId}=queue(G.createRoom({at}),'a',cardId,variantRoll);
 eq(item(room,'a',badge.id).progress.value,0);
 room=step(room,'REFUSE_TASK','b',{taskId,value:20});eq(item(room,'a',badge.id).progress.value,0);
 room=complete(room,'a',cardId,wrongFace);
 const otherCard=G.cards.find(card=>card.categoryId===G.getCard(cardId).categoryId&&card.id!==cardId);
 room=complete(room,'b',otherCard.id,variantRoll);eq(item(room,'a',badge.id).progress.value,0);
 for(let number=1;number<=3;number++){
  const queued=queue(room,number%2?'a':'b',cardId,variantRoll);room=queued.room;
  room=step(room,'TOGGLE_TASK_CHECK','a',{taskId:queued.taskId,checked:true});eq(item(room,'a',badge.id).progress.value,number-1);
  room=step(room,'TOGGLE_TASK_CHECK','b',{taskId:queued.taskId,checked:true});eq(item(room,'a',badge.id).progress.value,number);eq(!!item(room,'a',badge.id).award,number===3);
 }
 eq(item(room,'a',badge.id).award.id,item(room,'b',badge.id).award.id,'shared gain is the same achievement for both');
}
// An old free daily proposal is not a quota-consuming draw, with or without
// the marker added to the archived helper. Duplicate representations count once.
{
 let room=G.createRoom({at});room.daily=G.drawDaily(room,at,()=>1);
 room=step(room,'SEND_DAILY','a');eq(room.pendingRounds[0].round.dailyFree,true);
 eq(item(room,'a','ind-draws-1').progress.value,0);eq(item(room,'a','ind-proposals-1').progress.value,1);
 delete room.pendingRounds[0].round.dailyFree;
 eq(item(room,'a','ind-draws-1').progress.value,0,'unmarked old published v2 round has no proof of paid draw');
 let local=G.roomView(draft(),'a');
 local=G.reduce(local,{type:'SEND',directQueue:true,at});delete local.progression;
 delete local.round.dailyFree;for(const past of local.history)delete past.dailyFree;
 const parallel=G.createRoom({at});
 for(const key of ['history','tasks','stats','seen'])parallel[key]=copy(local[key]);
 parallel.lanes.a={phase:local.phase,round:copy(local.round)};
 ok(G.validateRoom(parallel));eq(item(parallel,'a','ind-draws-1').progress.value,1);eq(item(parallel,'a','ind-proposals-1').progress.value,1);
}
// Exercise every catalogue milestone through actual transitions. Five tasks per
// day keep each sender at no more than three initial draws on that calendar day.
let full=G.createRoom({at:'2026-01-01T11:00:00.000Z'}),after100;
for(let number=0;number<500;number++){
 const time=new Date(Date.parse('2026-01-01T11:00:00.000Z')+Math.floor(number/5)*86400000+(number%5)*3600000).toISOString();
 full=complete(full,number%2?'b':'a',G.cards[number%G.cards.length].id,Math.floor(number/G.cards.length)%6+1,time);
 if(number===99)after100=copy(full);
}
eq(full.stats.totalCompleted,500);eq(full.progression.shared.completed,500);eq(full.history.length,80);
eq(Object.keys(full.progression.shared.completedByCard).length,24);eq(Object.keys(full.progression.shared.completedByVariant).length,144);
for(const actor of ['a','b']){
 const view=G.badgeView(full,actor),awards=earned(full,actor);
 ok(G.validateBadgeView(view,actor));eq(awards.length,60,'all 60 definitions are reachable');eq(new Set(awards.map(award=>award.id)).size,60);
 eq(awards.map(award=>award.sequence).sort((a,b)=>a-b),Array.from({length:60},(_,i)=>i+1),'private and shared sequences are contiguous per reader');
 eq(full.progression.individual[actor].draws,250);eq(full.progression.individual[actor].proposals,250);eq(full.progression.individual[actor].participations,500);
 eq(full.progression.individual[actor].completedSent,250);eq(full.progression.individual[actor].completedReceived,250);
}
ok(Buffer.byteLength(JSON.stringify(full.progression))<100000,'registry is bounded without an event journal');
eq(G.normalizeRoom(copy(full)),full,'roundtrip preserves all cumulative achievements');
// Expiry and refusal remove tasks without decreasing or re-awarding achievements.
{
 const queued=queue(full,'a',G.cards[0].id,1,'2026-06-01T12:00:00.000Z');
 const before=copy(queued.room.progression),awards=earned(queued.room,'a');
 const expired=G.reduceRoom(queued.room,{type:'EXPIRE_TASKS',at:'2026-06-03T12:00:00.000Z'});
 eq(expired.progression,before);eq(earned(expired,'a'),awards);
}
// Import only proven detail, preserve exact aggregate completions, then apply
// the first new completion once. Imported awards never receive invented dates.
{
 const queued=queue(after100,'a',G.cards[0].id,1,'2026-02-01T12:00:00.000Z');
 let room=step(queued.room,'TOGGLE_TASK_CHECK','a',{taskId:queued.taskId,checked:true},'2026-02-01T12:00:00.000Z');
 delete room.progression;room.history=room.history.slice(0,8);
 const before=copy(room),view=G.badgeView(room,'b'),awards=view.items.filter(item=>item.award).map(item=>item.award);
 eq(room,before);eq(item(room,'b','duo-completed-100').progress.value,100);
 ok(awards.length>0);ok(awards.every(award=>award.at===null&&award.source==='imported'));
 room=step(room,'TOGGLE_TASK_CHECK','b',{taskId:queued.taskId,checked:true},'2026-02-01T12:00:00.000Z');
 eq(room.progression.shared.completed,101,'baseline 100 + first completion = 101');eq(room.progression.individual.a.participations,101);eq(room.progression.individual.b.participations,101);
 eq(G.badgeView(room,'b').epoch,view.epoch);ok(Object.values(room.progression.shared.completedByCard).reduce((sum,value)=>sum+value,0)<=8,'evicted details are not invented');
 for(const old of awards)eq(earned(room,'b').find(award=>award.id===old.id),old,'imported attribution is stable on first event');
}
// Old category aliases are four canonical themes, not six. No legacy aggregate
// can fabricate card/variant detail or dated activity that was never retained.
{
 const room=G.createRoom({at});room.stats={totalCompleted:12,byCategory:{complicite:1,detente:2,attention:1,bouffe:2,projets:3,intimite:3}};
 const view=G.badgeView(room,'a');
 eq(view.items.find(row=>row.id==='duo-distinct-categories-4').progress.value,4);
 eq(view.items.find(row=>row.id==='duo-every-category-5').progress.value,3);
 eq(view.items.find(row=>row.id==='duo-distinct-cards-6').progress.value,0);eq(view.items.find(row=>row.id==='duo-distinct-variants-12').progress.value,0);
 eq(view.items.find(row=>row.id==='duo-completion-days-3').progress.value,0);eq(view.items.find(row=>row.id==='ind-active-days-3').progress.value,0);
}
// Authoritative resets remove the optional registry and use fresh monotonic
// round IDs, so their next first award cannot collide with the old collection.
{
 const before=G.badgeView(full,'a'),reset=G.resetRoom(full,{at:'2026-06-01T12:00:00.000Z'});
 eq(reset.progression,undefined);ok(G.badgeView(reset,'a').epoch>before.epoch);eq(earned(reset,'a'),[]);
 const after=draft(reset,'a',G.cards[0].id,1,'2026-06-01T12:00:00.000Z');
 ok(!earned(full,'a').some(old=>old.id===item(after,'a','ind-draws-1').award.id));
 eq(G.reduceRoom(reset,{type:'SEND',actor:'a',roundId:full.lanes.a.round.id,directQueue:true,at}),reset);
}
// A malformed transport projection or private registry is never silently
// replaced by an empty, apparently valid achievement collection.
{
 const view=G.badgeView(full,'a');
 for(const mutate of [x=>{x.items.pop();},x=>{x.epoch=0;},x=>{x.items[0].progress.value=-1;},x=>{x.items[0].award.at='invalid';},x=>{x.items[0].award.sequence=2;},x=>{x.items[0].award.sequenceByActor={a:1,b:2};},x=>{x.items[0].award.id=x.items[0].award.id.replace(':a:',':b:');}]){
  const broken=copy(view);mutate(broken);eq(G.validateBadgeView(broken,'a'),false);
 }
 const broken=copy(full);broken.progression.individual.a.draws=-1;eq(G.validateRoom(broken),false);eq(G.badgeView(broken,'a'),null);eq(G.normalizeRoom(broken),null);
}
console.log('Dés·ir badges: '+checks+' catalogue, actor attribution, exact variants, Paris dates, privacy, import, 500 completions beyond 80 history rows, reset and persistence assertions passed.');
