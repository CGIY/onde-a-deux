import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../cartes/app.js',import.meta.url),'utf8');
const state={role:'AG',token:'fixture',data:{my_cards:[{id:'expired',template_id:'a',status:'available',expires_at:'2026-10-26T09:00:00Z'},{id:'live',template_id:'b',status:'available',expires_at:'2026-10-27T10:00:00Z'}],partner_cards:[],boosters:[],active_cards:[{id:'ended',active_until:'2026-10-26T09:00:00Z'}],known_cards:[{template_id:'a',owned_count:1},{template_id:'b',owned_count:1}]}};
const code=source.slice(source.indexOf('  function isAvailable('),source.indexOf('  function finishLabel('));
const api=runInNewContext(code+'\n({isAvailable,expireLocalData})',{state,serverNow:()=>new Date('2026-10-26T10:00:00Z')});
assert.equal(api.isAvailable(state.data.my_cards[0]),false);assert.equal(api.isAvailable(state.data.my_cards[1]),true);
assert.equal(api.expireLocalData(),true);assert.equal(state.data.my_cards.length,1);assert.equal(state.data.active_cards.length,0);assert.equal(state.data.known_cards.length,2);assert.equal(state.data.known_cards[0].owned_count,0);assert.equal(api.expireLocalData(),false);
// Responses can arrive in the opposite order to the database transactions.
const transportWindow={},requests=[];
runInNewContext(readFileSync(new URL('../cartes/card-transport.js',import.meta.url),'utf8'),{window:transportWindow,AbortController,setTimeout,clearTimeout,fetch:()=>new Promise(resolve=>requests.push(data=>resolve({ok:true,json:async()=>data})))});
const exchange=transportWindow.CardTransport.create({state,url:'https://fixture.invalid',key:'fixture'});
const poll=exchange('sync'),give=exchange('give_card',{card_id:'live'});
requests[1]({my_cards:[],marker:'new'});await give;
requests[0]({my_cards:[{id:'live'}],marker:'old'});await poll;
assert.equal(state.data.marker,'new','A delayed poll cannot put a given card back');
const slow=exchange('sync'),mutation=exchange('activate_card');
requests[2]({marker:'before-mutation'});await slow;assert.equal(state.data.marker,'new','Poll is stale as soon as a mutation starts');
requests[3]({marker:'activated'});await mutation;assert.equal(state.data.marker,'activated');
console.log('OK: expiry removes local actions without losing discoveries; reversed network responses never restore stale inventory.');

const matches=transportWindow.CardTransport.matchesMutation;
assert(matches({card_events:[{actor_role:'AG',card_id:'copy',event_type:'give_card'}]},'give_card',{card_id:'copy'},'AG'));
assert(!matches({card_events:[{actor_role:'CL',card_id:'copy',event_type:'give_card'}]},'give_card',{card_id:'copy'},'AG'));
assert(!matches({my_cards:[]},'destroy_card',{card_id:'copy'},'AG'),'Absence alone cannot prove destruction');
assert(matches({active_cards:[{id:'copy',owner_role:'AG',selected_template_id:'choice'}]},'activate_card',{card_id:'copy',choice_template_id:'choice'},'AG'));
assert(!matches({active_cards:[{id:'copy',owner_role:'AG',selected_template_id:'other'}]},'activate_card',{card_id:'copy',choice_template_id:'choice'},'AG'));
console.log('OK: lost-response recovery requires an exact server event or final state, never absence or an automatic mutation retry.');
