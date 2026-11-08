import assert from 'node:assert/strict';
import {createHandler} from '../functions/desir-game/server.mjs';

// The legacy combat must remain unreachable, including requests already queued
// in an older tab. No read, receipt replay, lease or mutation may reach its RPCs.
let checks=0,rpcCalls=0,pushCalls=0;
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const handler=createHandler({
 G:{},
 store:{async rpc(){rpcCalls++;throw new Error('Retired combat reached the database');}},
 push:{async flushPushOutbox(){pushCalls++;}},
 rateSecret:'test-only',
});
const token=Buffer.alloc(32,1).toString('base64url');
const id='10000000-0000-4000-8000-000000000001';
const actions=[null,{type:'CREATE'},{type:'OPT_IN',sessionId:id,enabled:true},
 {type:'PRESS',sessionId:id,pressId:id,sequence:1,held:true},
 {type:'ACK',sessionId:id,preparationId:id,pressId:id},
 {type:'ATTACK',sessionId:id,slot:1},{type:'CANCEL',sessionId:id}];
for(const version of [1,2,3,4,5,6])for(const action of actions){
 const response=await handler(new Request('https://example.supabase.co/functions/v1/desir-game',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:'https://cgiy.github.io'},
  body:JSON.stringify({op:'hardcore',gameVersion:version,action,...(action?{requestId:id}:{})}),
 }));
 const body=await response.json();
 eq(response.status,version===6?410:409,'retired combat status for protocol '+version);
 eq(body.error.code,version===6?'mode_removed':'upgrade_required','controlled retirement response');
 eq(Object.keys(body),['error'],'no private state or legacy session returned');
 eq(response.headers.get('Cache-Control'),'no-store','retirement is never cached as a session');
}
eq(rpcCalls,0,'no RPC, rate write or receipt lookup for the retired combat');
eq(pushCalls,0,'no notification side effect');
console.log('Dés·ir retired HARDCORE: '+checks+' protocol, command, privacy and zero-RPC assertions passed.');
