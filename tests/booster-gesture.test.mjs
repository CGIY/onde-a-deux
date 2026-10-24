import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('../cartes/booster-gesture.js',import.meta.url),'utf8');
const window={}; runInNewContext(code,{window});
class Target {
  events=new Map(); dataset={}; captured=new Set(); classes=new Set();
  classList={add:(...values)=>values.forEach(v=>this.classes.add(v)),remove:(...values)=>values.forEach(v=>this.classes.delete(v)),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};
  addEventListener(type,listener){this.events.set(type,listener);}
  removeEventListener(type,listener){if(this.events.get(type)===listener)this.events.delete(type);}
  getBoundingClientRect(){return {left:0,top:0,width:250,height:370};}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  send(type,values={}){const e={pointerId:1,button:0,isPrimary:true,clientX:0,clientY:0,timeStamp:0,target:{closest:()=>null},cancelable:true,preventDefault(){this.prevented=true;},...values};this.events.get(type)?.(e);return e;}
}
const pack=new Target(); let commits=0,progress=0,locked=false;
const gesture=window.CardBoosterGesture.attach(pack,{isLocked:()=>locked,onProgress:p=>progress=p,onCommit:()=>{commits++;locked=true;}});
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:100}); assert(progress>.5&&progress<.6); pack.send('pointerup'); assert.equal(progress,0); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:25,clientY:50}); assert.equal(progress,0); pack.send('pointermove',{clientX:240}); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:220,pointerId:2}); assert.equal(progress,0); pack.send('pointercancel'); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15,isPrimary:false}); pack.send('pointermove',{clientX:220}); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:200}); pack.send('pointermove',{clientX:240}); pack.send('pointerup'); assert.equal(commits,1); assert.equal(progress,1); assert.equal(pack.captured.size,0);
pack.send('pointerdown'); pack.send('pointermove',{clientX:240}); assert.equal(commits,1);
locked=false; gesture.reset(); pack.send('pointerdown',{clientX:240}); pack.send('pointermove',{clientX:50}); assert.equal(commits,2); assert.equal(pack.dataset.tearDirection,'left');
locked=false; gesture.reset(); pack.send('pointerdown',{clientX:15}); pack.send('lostpointercapture'); pack.send('pointermove',{clientX:240}); assert.equal(commits,2);
let pose;const inspection=new Target();window.CardBoosterGesture.attach(inspection,{isLocked:()=>false,onProgress:()=>{},onPose:p=>pose=p,onCommit:()=>assert.fail('Body inspection must not open anything')});inspection.send('pointerdown',{clientX:120,clientY:200});inspection.send('pointermove',{clientX:240,clientY:250});inspection.send('pointerup',{clientX:240,clientY:250});assert(pose.y>0&&pose.y<=42);assert(pose.x<3);
const diagonal=new Target();let diagonalCommit=0,cutAngle=0;window.CardBoosterGesture.attach(diagonal,{isLocked:()=>false,onProgress:(_,a)=>cutAngle=a,onCommit:()=>diagonalCommit++});diagonal.send('pointerdown',{clientX:15,clientY:50});diagonal.send('pointermove',{clientX:180,clientY:110});assert.equal(diagonalCommit,1);assert(cutAngle>10&&cutAngle<=32);
const slider=new Target();let slides=0;const dispose=window.CardBoosterGesture.swipe(slider,{onMove:()=>{},onEnd:()=>{},onSwipe:dir=>slides+=dir});slider.send('pointerdown',{clientX:200,timeStamp:0});slider.send('pointerup',{clientX:160,timeStamp:300});assert.equal(slides,1);slider.send('pointerdown',{clientX:200,timeStamp:400});slider.send('pointerup',{clientX:175,timeStamp:430});assert.equal(slides,2);slider.send('pointerdown',{clientX:100,timeStamp:500});slider.send('pointerup',{clientX:145,clientY:150,timeStamp:550});assert.equal(slides,2);dispose();assert.equal(slider.events.size,0);
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
