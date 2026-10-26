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
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:110}); assert(progress>.5&&progress<.6); pack.send('pointerup'); assert.equal(progress,0); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:25,clientY:150}); assert.equal(progress,0); pack.send('pointermove',{clientX:240}); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:220,pointerId:2}); assert.equal(progress,0); pack.send('pointercancel'); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15,isPrimary:false}); pack.send('pointermove',{clientX:220}); assert.equal(commits,0);
pack.send('pointerdown',{clientX:15}); pack.send('pointermove',{clientX:200}); pack.send('pointermove',{clientX:240}); pack.send('pointerup'); assert.equal(commits,1); assert.equal(progress,1); assert.equal(pack.captured.size,0);
pack.send('pointerdown'); pack.send('pointermove',{clientX:240}); assert.equal(commits,1);
locked=false; gesture.reset(); pack.send('pointerdown',{clientX:240}); pack.send('pointermove',{clientX:50}); assert.equal(commits,2); assert.equal(pack.dataset.tearDirection,'left');
locked=false; gesture.reset(); pack.send('pointerdown',{clientX:15}); pack.send('lostpointercapture',{target:pack}); pack.send('pointermove',{clientX:240}); assert.equal(commits,2);
let pose;const inspection=new Target();window.CardBoosterGesture.attach(inspection,{isLocked:()=>false,onProgress:()=>{},onPose:p=>pose=p,onCommit:()=>assert.fail('Body inspection must not open anything')});inspection.send('pointerdown',{clientX:120,clientY:200});inspection.send('pointermove',{clientX:240,clientY:250});inspection.send('pointerup',{clientX:240,clientY:250});assert(pose.y>0&&pose.y<=42);assert(pose.x<3);
const diagonal=new Target();let diagonalCommit=0,cutAngle=0;window.CardBoosterGesture.attach(diagonal,{isLocked:()=>false,onProgress:(_,a)=>cutAngle=a,onCommit:()=>diagonalCommit++});diagonal.send('pointerdown',{clientX:15,clientY:50});diagonal.send('pointermove',{clientX:190,clientY:110});assert.equal(diagonalCommit,1);assert(cutAngle>10&&cutAngle<=48);
const slider=new Target();let slides=0;const dispose=window.CardBoosterGesture.swipe(slider,{onMove:()=>{},onEnd:()=>{},onSwipe:dir=>slides+=dir});slider.send('pointerdown',{clientX:200,timeStamp:0});slider.send('pointerup',{clientX:160,timeStamp:300});assert.equal(slides,1);slider.send('pointerdown',{clientX:200,timeStamp:400});slider.send('pointerup',{clientX:175,timeStamp:430});assert.equal(slides,2);slider.send('pointerdown',{clientX:100,timeStamp:500});slider.send('pointerup',{clientX:145,clientY:150,timeStamp:550});assert.equal(slides,2);dispose();assert.equal(slider.events.size,0);
// Starting outside is deliberately generous, but moving in empty space is not a cut.
const outsidePack=new Target(),surface=new Target();let outsideProgress=0,outsideCommits=0;
const outside=window.CardBoosterGesture.attach(outsidePack,{surface,isLocked:()=>false,onProgress:p=>outsideProgress=p,onCommit:()=>outsideCommits++});
surface.send('pointerdown',{clientX:-90,clientY:-60});surface.send('pointermove',{clientX:-10,clientY:-35});assert.equal(outsideProgress,0);assert.equal(outsideCommits,0);
surface.send('pointermove',{clientX:200,clientY:80});assert.equal(outsideCommits,1);assert.equal(surface.captured.size,0);
outside.reset();surface.send('pointerdown',{clientX:340,clientY:50});surface.send('pointermove',{clientX:40,clientY:95});assert.equal(outsideCommits,2);
outside.reset();surface.send('pointerdown',{clientX:-60,clientY:330});surface.send('pointermove',{clientX:220,clientY:340});assert.equal(outsideCommits,2,'Distant gestures below the seam are ignored');
// All four short gestures work across the modal, including empty margins and buttons.
const screen=new Target();let screenEnabled=true;const directions=[];
const stop=window.CardBoosterGesture.swipe(screen,{axis:'both',includeButtons:true,enabled:()=>screenEnabled,onMove:()=>{},onEnd:()=>{},onSwipe:d=>directions.push(d)});
for(const [dx,dy] of [[-20,0],[20,0],[0,-20],[0,20]]){screen.send('pointerdown',{clientX:100,clientY:100,timeStamp:1000});screen.send('pointerup',{clientX:100+dx,clientY:100+dy,timeStamp:1300});}
assert.deepEqual(directions,[1,-1,1,-1]);
// Browser touch transfers implicit capture from the artwork to the modal. The
// child's bubbling lostpointercapture must not cancel the parent's gesture.
screen.send('pointerdown',{clientX:100,clientY:100,timeStamp:1400});
screen.send('pointermove',{clientX:92,clientY:100,timeStamp:1420});
screen.send('lostpointercapture',{target:{closest:()=>null},timeStamp:1421});
screen.send('pointerup',{clientX:78,clientY:100,timeStamp:1500});
assert.equal(directions.length,5,'Touch capture transfer must preserve the slide');
screen.send('pointerdown',{clientX:100,clientY:100,timeStamp:1600});
screen.send('lostpointercapture',{target:screen,timeStamp:1620});
screen.send('pointerup',{clientX:60,clientY:100,timeStamp:1700});
assert.equal(directions.length,5,'A real loss on the modal still cancels');
screen.send('pointerdown',{clientX:100,clientY:100,timeStamp:2000});screen.send('pointerup',{clientX:98,clientY:102,timeStamp:2300});assert.equal(directions.length,5,'A tap or small tremor is not a slide');
screenEnabled=false;screen.send('pointerdown');screen.send('pointerup',{clientX:40});assert.equal(directions.length,5);stop();assert.equal(screen.events.size,0);
const root=new Target(); window.CardBoosterGesture.preventDoubleTapZoom(root);
const touch=(at,x=20,target={closest:()=>null})=>root.send('touchend',{timeStamp:at,touches:[],changedTouches:[{clientX:x,clientY:20}],target});
assert(!touch(1000).prevented); assert(touch(1200).prevented); assert(!touch(1300,200).prevented);
assert(!touch(1400,20,{closest:()=>true}).prevented); assert(!touch(1450,20,{closest:()=>true}).prevented);
assert(!root.send('touchend',{timeStamp:1500,touches:[{}],changedTouches:[{}]}).prevented);
assert(root.send('dblclick',{target:{closest:()=>null}}).prevented);
assert(!root.send('dblclick',{target:{closest:()=>true}}).prevented);
const app=readFileSync(new URL('../cartes/app.js',import.meta.url),'utf8');
const handler=app.slice(app.indexOf('    const finishButton ='),app.indexOf('    const exchangeCard ='));
let finished=0;
runInNewContext(`(function(event){${handler}})({target:{closest:()=>true}})`,{finishReveal:()=>finished++});
assert.equal(finished,1,'The finish button must call the function, not shadow it');
assert.doesNotMatch(code,/\bfetch\s*\(|localStorage|sessionStorage/,'Gesture module must never access saved data');
console.log('OK: short/vertical/cancel/multiple pointers, both tear directions, single commit, capture release, double-tap blocked, pinch/form fields preserved.');
