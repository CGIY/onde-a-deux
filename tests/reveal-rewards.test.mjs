import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../cartes/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function renderRevealedCard()'),source.indexOf('  async function advanceReveal'));
const nodes=new Map();
const $=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',classList:{toggle:()=>{}}});
  return nodes.get(key);
};
const rewards=[
  {template_id:'energy',reward_type:'card',finish:'standard'},
  {template_id:'challenge-a',reward_type:'card',finish:'standard'},
  {template_id:'challenge-b',reward_type:'card',finish:'foil'},
  {reward_type:'shards',amount:2},
  {reward_type:'shards',amount:1}
];
const state={revealedCards:rewards,revealIndex:0,revealMoving:false,newTemplates:new Set()};
const render=runInNewContext(code+'\nrenderRevealedCard',{
  state,$,boosterDialog:{setAttribute:()=>{}},cardMarkup:()=>'<article class="game-card"></article>',
  finishLabel:finish=>finish,feedback:()=>{},attachFoilMotion:()=>{},rememberRevealPosition:()=>{},empty:()=>''
});
const backs=()=>($('#revealSlot').innerHTML.match(/class="card-back"/g)||[]).length;
render();assert.equal(backs(),2,'Only the two remaining cards have card backs');
state.revealIndex=2;render();assert.equal(backs(),0,'Shard rewards do not create false card backs');
state.revealIndex=3;render();assert.equal(backs(),0);
assert.match($('#revealSlot').innerHTML,/class="shard-reveal"/);
assert.match($('#revealSlot').innerHTML,/Récompense 4 sur 5/);
console.log('OK: reveal stack contains only unrevealed cards, with shard rewards counted but never disguised as extra cards.');
