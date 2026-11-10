import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {applyAction,projectState} from '../functions/desir-game/model.mjs';
const G=createRequire(import.meta.url)('../../dev/src/onde-app-core.js');
const at='2026-11-10T12:00:00.000Z', tomorrow='2026-11-10T23:00:00.000Z';
const request='00000000-0000-4000-8000-000000000001';
const makeRoom=()=>({...G.createRoom({at}),categoryBoost:{actor:'b',date:'2026-11-10',remaining:2}});
const roll=(room,actor,type,when=at,random=()=>1)=>applyAction(G,room,actor,{type,roundId:room.lanes[actor].round.id},request,when,random,8);

// Enumerate all 64 equiprobable tickets; no statistical inference is needed.
const counts=[0,0,0,0];
for(let ticket=1;ticket<=64;ticket++){
 let first=true;
 const result=roll(makeRoom(),'b','ROLL_CATEGORY',at,n=>{if(first){first=false;assert.equal(n,64);return ticket;}return 1;});
 counts[result.roll.value-1]++;
 assert.equal(result.state.categoryBoost.remaining,1);
}
assert.deepEqual(counts,[11,10,10,33]);
const first=roll(makeRoom(),'b','ROLL_CATEGORY');
assert.equal(first.state.categoryBoost.remaining,1);
const relaunch=roll(first.state,'b','REROLL_CATEGORY');
assert.equal(relaunch.state.categoryBoost,undefined,'second successful theme roll uses the allowance');
const partner=roll(makeRoom(),'a','ROLL_CATEGORY',at,n=>{assert.notEqual(n,64);return 1;});
assert.deepEqual(partner.state.categoryBoost,{actor:'b',date:'2026-11-10',remaining:2});
assert.equal(projectState(G,partner.state,'a',8).categoryBoost,undefined,'allowance is not projected');
const jokerRoom=makeRoom();
const joker=applyAction(G,jokerRoom,'b',{type:'JOKER_DRAW',roundId:jokerRoom.lanes.b.round.id,category:4},request,at,()=>1,8);
assert.equal(joker.state.categoryBoost.remaining,2,'choosing a category is not a random theme roll');
const late=roll(makeRoom(),'b','ROLL_CATEGORY',tomorrow,n=>{assert.notEqual(n,64);return 1;});
assert.equal(late.state.categoryBoost,undefined,'allowance ends at Paris midnight');
assert.throws(()=>roll(first.state,'b','ROLL_CATEGORY'),/disponible/, 'an invalid repeat consumes nothing');
assert.equal(first.state.categoryBoost.remaining,1);
console.log('Category boost: all 64 tickets, two rolls, actor isolation, expiry and privacy verified.');
