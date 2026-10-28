import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../cartes/app.js',import.meta.url),'utf8');
const complete=source.match(/const canComplete = ([^;]+);/)[1],review=source.match(/const canReview = ([^;]+);/)[1];
for(const role of ['AG','CL']){
 const partner=role==='AG'?'CL':'AG';
 for(const owner of [role,partner])for(const pending of [false,true]){
  const card={id:'ritual',owner_role:owner,ritual_claim_status:pending?'pending':null};const state={role,data:{partner_role:partner,active_cards:[card]}};
  const flags=runInNewContext(`({complete:${complete},review:${review}})`,{state,card,active:true});
  assert.equal(flags.complete,owner!==role&&!pending);assert.equal(flags.review,owner===role&&pending);
 }
}
console.log('OK: each profile can request only for a partner-posed ritual, and review only its own posed ritual.');
