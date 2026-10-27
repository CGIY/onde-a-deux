import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../cartes/economy.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('    async function useHelper('),source.indexOf('    function openDruidePicker('));
async function scenario(events,success){
  const content={innerHTML:''};let calls=0;
  const fn=runInNewContext(body+'\nuseHelper',{helperOffers:[{kind:'assassin',price:15}],busy:false,state:()=>({balance:30,events:[{id:'old',type:'helper_assassin'}]}),exchange:async action=>{if(action==='use_helper'){calls++;throw Error('network_error');}return {economy:{events}};},helperModal:{open:true,querySelector:()=>content},escape:String,onUpdate:()=>{},friendlyError:e=>e.message});
  await fn('assassin');assert.equal(calls,1);assert.equal(content.innerHTML.includes('Assassin exécuté.'),success);assert.equal(content.innerHTML.includes('Complice interrompu'),!success);
}
await scenario([{id:'old',type:'helper_assassin'}],false);
await scenario([{id:'new',type:'helper_druide'}],false);
await scenario([{id:'new',type:'helper_assassin',detail:{title:'Carte test'}}],true);
console.log('OK: helper network recovery requires a new event of the requested kind; old or unrelated events never announce success.');
