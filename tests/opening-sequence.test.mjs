import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../cartes/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  async function revealBooster()'),source.indexOf('  function setupBoosterGesture()'));
async function scenario(fail=false) {
  const nodes=new Map();const $=key=>{if(!nodes.has(key)){const classes=new Set();nodes.set(key,{hidden:true,disabled:false,textContent:'',style:{setProperty:()=>{}},classes,classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x))}});}return nodes.get(key);};
  const state={opening:false,selectedBooster:'pack-test',data:{known_cards:[],my_cards:[]},newTemplates:new Set()};
  let resolve,reject,calls=0,reveals=0,now=0,resets=0;const timers=[];
  const pending=new Promise((ok,no)=>{resolve=ok;reject=no;});
  const fn=runInNewContext(code+'\nrevealBooster',{$,state,performance:{now:()=>now},reducedMotion:{matches:false},boosterDialog:{open:true},exchange:async()=>{calls++;await pending;state.data.my_cards=['energy','challenge','challenge'].map((card_type,i)=>({id:'card-'+i,template_id:'template-'+i,booster_id:'pack-test',card_type}));},feedback:()=>{},setTimeout:(callback,delay)=>{timers.push({callback,delay});return 1;},render:()=>{},renderRevealedCard:()=>reveals++,packGesture:{reset:()=>resets++},friendlyError:error=>error.message,sync:async()=>{}});
  const running=fn();await fn();
  assert.equal(calls,1,'The animation must not trigger a second draw');
  assert($('#boosterStage').classes.has('unsealing'),'Tearing must start while the request is pending');
  assert($('#sealedPack').classes.has('opened'));
  assert.equal(reveals,0,'No faces may be shown before server confirmation');
  now=1200;
  if(fail)reject(Error('network_error'));else resolve();
  await running;
  if(fail){assert.equal(state.opening,false);assert(!$('#sealedPack').classes.has('opened'));assert.equal(resets,1);assert.equal($('#openPackButton').disabled,false);assert.equal(reveals,0);}
  else {assert.equal(timers[0].delay,0,'Network latency must overlap the animation, not add 760ms');assert.equal(reveals,0);timers[0].callback();assert.equal(reveals,1);assert.equal(state.newTemplates.size,3);}
}
await scenario();await scenario(true);
console.log('OK: immediate motion, hidden faces before acknowledgment, one draw, latency overlap, new discoveries, error rollback of visual state only.');
