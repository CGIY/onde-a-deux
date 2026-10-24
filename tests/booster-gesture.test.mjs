import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('../cartes/booster-gesture.js',import.meta.url),'utf8');
const window={}; runInNewContext(code,{window});
class Target {
  events=new Map(); dataset={}; captured=new Set(); classes=new Set();
  classList={add:(...values)=>values.forEach(v=>this.classes.add(v)),remove:(...values)=>values.forEach(v=>this.classes.delete(v))};
  addEventListener(type,listener){this.events.set(type,listener);}
  getBoundingClientRect(){return {left:0,width:250};}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  send(type,values={}){const e={pointerId:1,button:0,isPrimary:true,clientX:0,clientY:0,cancelable:true,preventDefault(){this.prevented=true;},...values};this.events.get(type)?.(e);return e;}
}
const pack=new Target(); let commits=0,progress=0,locked=false;
const gesture=window.CardBoosterGesture.attach(pack,{isLocked:()=>locked,onProgress:p=>progress=p,onCommit:()=>{commits++;locked=true;}});
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:100}); assert(progress>.4&&progress<.5); pack.send('pointerup'); assert.equal(progress,0); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:25,clientY:50}); assert.equal(progress,0); pack.send('pointermove',{clientX:240}); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:220,pointerId:2}); assert.equal(progress,0); pack.send('pointercancel'); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15,isPrimary:false}); pack.send('pointermove',{clientX:220}); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:200}); pack.send('pointermove',{clientX:240}); pack.send('pointerup'); assert.equal(commits,1); assert.equal(progress,1); assert.equal(pack.captured.size,0);
pack.send('pointerdown'); pack.send('pointermove',{clientX:240}); assert.equal(commits,1);
locked=false; gesture.reset(); pack.send('pointerdown',{clientX:240}); pack.send('pointermove',{clientX:50}); assert.equal(commits,2); assert.equal(pack.dataset.tearDirection,'left');
locked=false; gesture.reset(); pack.send('pointerdown',{clientX:15}); pack.send('lostpointercapture'); pack.send('pointermove',{clientX:240}); assert.equal(commits,2);
const root=new Target(); window.CardBoosterGesture.preventDoubleTapZoom(root);
const touch=(at,x=20,target={closest:()=>null})=>root.send('touchend',{timeStamp:at,touches:[],changedTouches:[{clientX:x,clientY:20}],target});
assert(!touch(1000).prevented); assert(touch(1200).prevented); assert(!touch(1300,200).prevented);
assert(!touch(1400,20,{closest:()=>true}).prevented); assert(!touch(1450,20,{closest:()=>true}).prevented);
assert(!root.send('touchend',{timeStamp:1500,touches:[{}],changedTouches:[{}]}).prevented);
assert(root.send('dblclick',{target:{closest:()=>null}}).prevented);
assert(!root.send('dblclick',{target:{closest:()=>true}}).prevented);
const app=readFileSync(new URL('../cartes/app.js',import.meta.url),'utf8');
const handler=app.slice(app.indexOf('    const finishButton ='),app.indexOf('    const useJoker ='));
let finished=0;
runInNewContext(`(function(event){${handler}})({target:{closest:()=>true}})`,{finishReveal:()=>finished++});
assert.equal(finished,1,'The finish button must call the function, not shadow it');
assert.doesNotMatch(code,/\bfetch\s*\(|localStorage|sessionStorage/,'Gesture module must never access saved data');
console.log('OK: short/vertical/cancel/multiple pointers, both tear directions, single commit, capture release, double-tap blocked, pinch/form fields preserved.');
