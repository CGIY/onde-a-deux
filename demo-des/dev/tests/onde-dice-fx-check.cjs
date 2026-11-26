const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const listeners=new Map(),motionListeners=new Set();let particles=0,cancelled=0,removed=0;
const motion={matches:false,addEventListener(_e,fn){motionListeners.add(fn);},removeEventListener(_e,fn){motionListeners.delete(fn);}};
const document={hidden:false,addEventListener(e,fn){listeners.set(e,fn);},removeEventListener(e){listeners.delete(e);},createElement(){return {style:{},setAttribute(){},append(){particles++;},remove(){removed++;},animate(){return {cancel(){cancelled++;}};}};}};
const window={document,matchMedia:()=>motion,addEventListener(e,fn){listeners.set(e,fn);},removeEventListener(e){listeners.delete(e);}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/onde-app-dice-fx.js'),'utf8'),{window,Promise,Math,Object});
const canvas={parentElement:{append(){}},animate(){}},fx=window.OndeDiceFX;
(async()=>{
 let finish;const pending=fx.roll(canvas,()=>new Promise(resolve=>finish=resolve));
 assert.equal(particles,12);finish(6);assert.equal(await pending,6);assert.equal(cancelled,12);assert.equal(removed,1);assert.equal(listeners.size,0);assert.equal(motionListeners.size,0);
 const count=particles;assert.equal(await fx.roll(canvas,()=>4,{reducedMotion:true}),4);assert.equal(particles,count);
 motion.matches=true;assert.equal(await fx.roll(canvas,()=>2),2);assert.equal(particles,count);motion.matches=false;
 const hidden=fx.roll(canvas,()=>new Promise(resolve=>finish=resolve));document.hidden=true;listeners.get('visibilitychange')();assert.equal(listeners.size,0);finish(3);assert.equal(await hidden,3);document.hidden=false;
 const error=new Error('network');await assert.rejects(fx.roll(canvas,()=>Promise.reject(error)),error);assert.equal(listeners.size,0);assert.equal(motionListeners.size,0);
 assert.throws(()=>fx.roll(canvas,()=>{throw error;}),error);assert.equal(listeners.size,0);
 console.log('Cosmic dice filaments preserve results/errors, reduced motion and visibility cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
