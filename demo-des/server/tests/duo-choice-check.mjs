import assert from 'node:assert/strict';
import G from '../../dev/src/onde-app-core.js';
import {applyAction,parseAction,snapshot} from '../functions/desir-game/model.mjs';
import {pushEventRelevant} from '../functions/desir-game/push-helpers.mjs';
const at='2026-11-26T09:00:00.000Z';
let serial=0,checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
function step(room,actor,type,extra={},roundId=room.lanes[actor].round.id,random=()=>1,time=at){
 const result=applyAction(G,room,actor,{type,roundId,...extra},'00000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),time,random,9);
 check(G.validateRoom(result.state),true);return result;
}
function propose(room=G.createRoom({at}),actor='a',category=1,cardFace=1){
 room=step(room,actor,'ROLL_CATEGORY',{},room.lanes[actor].round.id,n=>n===42?[1,12,22,32][category-1]:1).state;
 room=step(room,actor,'ROLL_CARD',{},room.lanes[actor].round.id,()=>cardFace).state;
 const roundId=room.lanes[actor].round.id;
 check(room.lanes[actor].phase,'draft');
 const result=step(room,actor,'SEND');
 check(result.consumeTicket,false);check(result.state.tasks.length,room.tasks.length);
 return {room:result.state,roundId};
}
function finish(room,roundId){
 room=step(room,'a','TOGGLE_TASK_CHECK',{taskId:roundId,checked:true}).state;
 return step(room,'b','TOGGLE_TASK_CHECK',{taskId:roundId,checked:true}).state;
}
for(let face=1;face<=6;face++){
 let {room,roundId}=propose();
 let calls=0;
 const rolled=step(room,'b','ROLL_CHOICES',{},roundId,n=>++calls===1?face:n);room=rolled.state;
 const choice=room.pendingRounds[0].round.duoChoice;
 check(choice.roll,face);check(choice.options.length,face);check(new Set(choice.options).size,face);
 check(G.normalizeRoom(JSON.parse(JSON.stringify(room))),room);
 const before=structuredClone(room);
 assert.throws(()=>step(room,'b','ROLL_CHOICES',{},roundId));
 assert.throws(()=>step(room,'a','PICK_CHOICE',{choice:choice.options[0]},roundId));
 check(room,before);
 if(face<6)assert.throws(()=>step(room,'b','PICK_CHOICE',{choice:[1,2,3,4,5,6].find(n=>!choice.options.includes(n))},roundId));
 const later='2026-11-27T10:00:00.000Z';
 room=step(room,'b','PICK_CHOICE',{choice:choice.options[0]},roundId,()=>1,later).state;
 check(room.tasks[0].createdAt,later);check(room.tasks[0].expiresAt,'2026-11-28T10:00:00.000Z');
 // Completion happens inside the newly started 24-hour window.
 room=step(room,'a','TOGGLE_TASK_CHECK',{taskId:roundId,checked:true},room.lanes.a.round.id,()=>1,later).state;
 check(room.stats.totalCompleted,0);
 room=step(room,'b','TOGGLE_TASK_CHECK',{taskId:roundId,checked:true},room.lanes.b.round.id,()=>1,later).state;
 check(room.stats.totalCompleted,1);check(room.progression.shared.duo.faces[face],1);
 check(room.progression.shared.duo.chosenBy,{a:0,b:1});
 check(G.validateBadgeView(G.badgeView(room,'a'),'a'),true);
}
{
 let {room,roundId}=propose();const firstCard=room.pendingRounds[0].round.cardId;
 const wallets=structuredClone(room.cardRerollWallets);
 const passed=step(room,'b','PASS_CHOICE',{},roundId);room=passed.state;
 check(room.cardRerollWallets,wallets);check(room.tasks.length,0);check(room.stats.totalCompleted,0);
 check(pushEventRelevant(room,{kind:'confirmation',round_id:roundId,target_actor:'a'},Date.parse(at)),true);
 check(pushEventRelevant(room,{kind:'invitation',round_id:roundId,target_actor:'b'},Date.parse(at)),false);
 const bonus=step(room,'a','BONUS_CARD',{},roundId);room=bonus.state;
 assert.notEqual(room.pendingRounds[0].round.cardId,firstCard);check(bonus.consumeTicket,false);
 assert.throws(()=>step(room,'a','BONUS_CARD',{},roundId));
 assert.throws(()=>step(room,'b','ROLL_CHOICES',{},roundId));
 room=step(room,'a','SEND_BONUS',{},roundId).state;
 room=step(room,'b','ROLL_CHOICES',{},roundId).state;
 room=step(room,'b','PICK_CHOICE',{choice:1},roundId).state;
 room=finish(room,roundId);
 check(room.progression.shared.duo.bonus,1);
 check(!!G.badgeView(room,'a').items.find(item=>item.id==='duo-choice-bonus-1').award,true);
}
{
 let {room,roundId}=propose();
 room=step(room,'b','PASS_CHOICE',{},roundId).state;
 room=step(room,'a','BONUS_CARD',{},roundId).state;
 room=step(room,'a','SEND_BONUS',{},roundId).state;
 room=step(room,'b','PASS_CHOICE',{},roundId).state;
 check(room.pendingRounds.length,0);check(room.history[0].status,'passed');
 check(room.stats.totalCompleted,0);
 assert.throws(()=>step(room,'a','BONUS_CARD',{},roundId));
}
{
 // Both people can prepare a card and receive the other's proposal concurrently.
 let a=propose(),b=propose(a.room,'b'),room=b.room;
 check(room.pendingRounds.length,2);
 const context=actor=>({room:{id:'00000000-0000-4000-8000-000000000001',state:room,revision:1},member:{actor},paired:true,quota:{remaining:1}});
 const original=structuredClone(room);
 for(const actor of ['a','b']){
  const view=snapshot(G,context(actor),{},9);
  check(view.incoming.length,2);check(view.badges.items.length,144);
  check(view.incoming.every(state=>G.validateState(state)),true);
 }
 check(room,original);
 assert.throws(()=>snapshot(G,context('a'),{},8),/nouvelle façon/);
}
for(const type of ['ROLL_CHOICES','PICK_CHOICE','PASS_CHOICE','BONUS_CARD','SEND_BONUS']){
 for(const key of ['value','options','actor','at','duoChoice','companionChoice'])assert.throws(()=>parseAction({type,roundId:'onde-1',...(type==='PICK_CHOICE'?{choice:1}:{}),[key]:1}));
}
// Long-lived counters survive truncation of history and unlock every new title.
{
 let room=G.createRoom({at});
 for(let index=0;index<120;index++){
  const actor=index%2?'a':'b',receiver=G.otherPlayer(actor);let roundId;
  ({room,roundId}=propose(room,actor,index%4+1,Math.floor(index/4)%8+1));
  if(index<10){room=step(room,receiver,'PASS_CHOICE',{},roundId).state;room=step(room,actor,'BONUS_CARD',{},roundId).state;room=step(room,actor,'SEND_BONUS',{},roundId).state;}
  let calls=0;const face=index%6+1;
  room=step(room,receiver,'ROLL_CHOICES',{},roundId,n=>++calls===1?face:1).state;
  room=step(room,receiver,'PICK_CHOICE',{choice:room.pendingRounds[0].round.duoChoice.options[0]},roundId).state;
  room=finish(room,roundId);
 }
 check(room.history.length,80);check(room.progression.shared.duo.completed,120);
 check(G.badgeView(room,'a').items.filter(item=>item.id.startsWith('duo-choice-')&&item.award).length,24);
 check(G.badgeView(room,'b').items.filter(item=>item.id.startsWith('duo-choice-')&&item.award).length,24);
 check(G.validateRoom(JSON.parse(JSON.stringify(room))),true);
 check(G.badgeView(G.resetRoom(room,{at}),'a').items.filter(item=>item.id.startsWith('duo-choice-')&&item.award).length,0);
}
console.log(`Duo choice — ${checks} assertions passed across dice, selection, bonus, privacy, old clients, progression and reset.`);
