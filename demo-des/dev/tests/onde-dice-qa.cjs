const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const filename=require('node:path').join(__dirname,'../src/onde-app-dice.js');
const src=fs.readFileSync(filename,'utf8').replace('global.OndeDice=Object.freeze({create});','global.OndeDice=Object.freeze({create});global.__qa={CUBE_FACES,POLYS,targetRotation,initialRotation,matrix,transform,support,clampPower,rollDuration,FRAGMENT,VERTEX};');
let now=0,nextRaf=0,queue=new Map(),uniforms={},labels=[],atlas=[],numerals=[],documentHandlers=new Map();
const gradient=()=>({stops:[],addColorStop(at,color){this.stops.push([at,color]);}});
const ctx2d=new Proxy({createRadialGradient:gradient,createLinearGradient:gradient,fillText(text){atlas.push(String(text));numerals.push({text:String(text),ink:this.fillStyle});}}, {get(o,p){return p in o?o[p]:()=>{}},set(o,p,v){o[p]=v;return true;}});
const gl=new Proxy({VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_p,n)=>n,getAttribLocation:()=>0,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),uniformMatrix3fv(n,_transpose,a){uniforms[n]=Array.from(a);},uniform3fv(n,a){uniforms[n]=Array.from(a);},uniform3f(n,...a){uniforms[n]=a;},uniform2f(n,...a){uniforms[n]=a;},uniform1f(n,a){uniforms[n]=a;},uniform1i(n,a){uniforms[n]=a;}},{get(o,p){return p in o?o[p]:()=>{}}});
const makeCanvas=(useWebgl=true)=>({width:0,height:0,clientWidth:452,clientHeight:238,style:{},listeners:new Map(),getContext:type=>type==='webgl'?(useWebgl?gl:null):ctx2d,setAttribute(n,v){labels.push([n,v]);},addEventListener(n,fn){this.listeners.set(n,fn);},removeEventListener(n){this.listeners.delete(n);},dispatch(n,event={}){this.listeners.get(n)?.(event);},setPointerCapture(){},toDataURL:()=>''});
const window={devicePixelRatio:3,addEventListener(){},removeEventListener(){}};
const sandbox={window,document:{createElement:()=>makeCanvas(false),addEventListener(name,fn){if(!documentHandlers.has(name))documentHandlers.set(name,new Set());documentHandlers.get(name).add(fn);},removeEventListener(name,fn){documentHandlers.get(name)?.delete(fn);}},performance:{now:()=>now},requestAnimationFrame(fn){queue.set(++nextRaf,fn);return nextRaf;},cancelAnimationFrame(id){queue.delete(id);},console};
vm.createContext(sandbox);vm.runInContext(src,sandbox);const q=window.__qa;
vm.runInContext('Math.random=()=>.5',sandbox);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>a.map(x=>x/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],maxdiff=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
const view=norm([4.3,5.25,6.4]);let poses=0,minVisible=1;
for(const kind of [4,6,20])for(let value=1;value<=kind;value++){
 const faces=kind===6?q.CUBE_FACES:q.POLYS[kind].faces,m=q.matrix(q.targetRotation(kind,value)),f=faces[value-1],n=q.transform(m,f.n);
 assert(maxdiff(cross(f.t,f.b),f.n)<1e-12,'right-handed label face');
 assert(Math.abs(dot(f.t,f.b))<1e-12,'orthogonal label axes');
 if(kind!==4){assert(maxdiff(n,[0,1,0])<1e-12,`top result ${kind}/${value}`);const b=q.transform(m,f.b);assert(dot(b,norm([-4.3,0,-6.4]))>.999,'upright numeral');}
 else {assert(dot(n,view)>.7,'D4 result visible');}
 minVisible=Math.min(minVisible,dot(n,view));poses++;
}
function advance(t){now=t;const callbacks=[...queue.values()];queue.clear();for(const callback of callbacks)callback(t);return {m:uniforms.uRotation.slice(),p:uniforms.uPosition.slice(),s:uniforms.uScale.slice(),ink:uniforms.uResultLight};}
let worstJoin=0,joins=0,inkJoins=0;
(async()=>{
 for(const kind of [4,6,20]){
  now=0;queue.clear();const canvas=makeCanvas(),die=window.OndeDice.create(canvas,{kind,value:1,duration:2250,maxPixelRatio:2});
  assert.equal(die.mode,'webgl');assert.equal(uniforms.uCount,kind);assert.equal(canvas.width,904);assert.equal(canvas.height,476);
  assert.equal(uniforms.uValue,1);assert.equal(uniforms.uResultLight,1,'rest result starts bright');
  const done=die.roll(kind);
  for(const boundary of [160,1160,1160+440*.36,1600,1925,2250]){
   const a=advance(boundary-.001),b=advance(boundary+.001);
   const delta=Math.max(maxdiff(a.m,b.m),maxdiff(a.p,b.p),maxdiff(a.s,b.s));worstJoin=Math.max(worstJoin,delta);assert(delta<.0001,`continuous phase ${kind}/${boundary}: ${delta}`);joins++;
   assert.equal(uniforms.uValue,kind,'bright face follows the actual result');
   assert(Math.abs(b.ink-a.ink)<.0001,'continuous result ink');inkJoins++;
   if(boundary<=1600)assert(b.ink<1e-8,'no white flash while turning');
   if(boundary===1925)assert(Math.abs(b.ink-.5)<.00001,'ivory fades in during the last settling movement');
  }
  assert.equal(await done,kind);assert.equal(die.busy,false);assert.equal(uniforms.uResultLight,1,'settled result is fully bright');
  const rest=uniforms.uRotation.slice();die.setKind(kind,kind);assert(maxdiff(rest,uniforms.uRotation)===0,'no same-result pose reset');
  const next=die.roll(1);advance(now+100);die.setKind(kind,1);assert.equal(die.busy,false);assert.equal(await next,1);assert.equal(uniforms.uResultLight,1,'interrupted result returns to bright rest');assert.equal(queue.size,0,'roll cancellation');
  die.setReducedMotion(true);assert.equal(await die.roll(kind),kind);assert.equal(die.busy,false);assert.equal(uniforms.uResultLight,1,'reduced motion brightens immediately');assert.equal(uniforms.uValue,kind);die.destroy();assert.equal(queue.size,0);
 }
 // Visual force cannot alter the chosen result or the final physical pose.
 const rotationDistance=(a,b)=>Math.acos(Math.max(-1,Math.min(1,(a.reduce((sum,v,i)=>sum+v*b[i],0)-1)/2)));
 const trajectories=[];
 for(const power of [0,1]){
  now=0;queue.clear();const die=window.OndeDice.create(makeCanvas(),{kind:6,value:1,duration:1650});
  const duration=1650+850*power,done=die.roll(6,{power,duration:1650});let distance=0,previous=null;
  for(let i=0;i<=320;i++){const frame=advance(duration*(160+1000*i/320)/2250);if(previous)distance+=rotationDistance(previous,frame.m);previous=frame.m;}
  advance(duration-.001);assert.equal(die.busy,true,'force-dependent duration retains final settling');
  const frame=advance(duration+.001);assert.equal(await done,6,'force never changes supplied result');assert.equal(die.busy,false);
  assert.equal(frame.ink,1,'bright final numeral survives force');
  trajectories.push({distance,final:frame.m});die.destroy();
 }
 assert(trajectories[1].distance>trajectories[0].distance+Math.PI*4,'strong throw makes genuinely more turns');
 assert(maxdiff(trajectories[0].final,trajectories[1].final)<1e-12,'same result ends in the same pose regardless of force');
 // Every motion/ink transition stays continuous with the extra revolutions.
 for(const kind of [4,6,20])for(const power of [0,.5,1]){
  now=0;queue.clear();const die=window.OndeDice.create(makeCanvas(),{kind,value:1}),duration=1650+850*power,done=die.roll(kind,{power});
  for(const boundary of [160,1160,1160+440*.36,1600,2250]){
   const before=advance((boundary-.001)*duration/2250),after=advance((boundary+.001)*duration/2250);
   assert(Math.max(maxdiff(before.m,after.m),maxdiff(before.p,after.p),maxdiff(before.s,after.s),Math.abs(before.ink-after.ink))<.0001,'force trajectory has no jump');
  }
  assert.equal(await done,kind);die.destroy();
 }
 for(const [value,expected] of [[-1,0],[0,0],[.5,.5],[1,1],[5,1],[Infinity,1],[-Infinity,0],[NaN,0],[undefined,0]])assert.equal(q.clampPower(value),expected,'force clamps safely');
 assert.equal(q.rollDuration(0,0),1650);assert.equal(q.rollDuration(-100,0),1650);assert.equal(q.rollDuration(5000,1),2500);
 // Only the initial D6 is oblique; rereading a settled result never snaps it.
 now=0;queue.clear();let canvas=makeCanvas(),die=window.OndeDice.create(canvas,{kind:6,value:3});
 const initial=uniforms.uRotation.slice(),visible=q.CUBE_FACES.filter(face=>dot(q.transform(initial,face.n),view)>.1);
 assert.equal(visible.length,3,'unthrown cube presents three faces');
 assert(maxdiff(initial,q.matrix(q.targetRotation(6,3)))>.1,'initial pose is visibly oblique');
 die.setKind(6,3);assert(maxdiff(initial,uniforms.uRotation)===0,'same initial pose is retained');
 die.setKind(4,1);die.setKind(6,3);assert(maxdiff(initial,uniforms.uRotation)<1e-12,'new die kind restores its presentation pose');die.destroy();
 // Native and button presses share the same bounded force, with safe cancellation.
 now=0;queue.clear();const releases=[];canvas=makeCanvas();die=window.OndeDice.create(canvas,{kind:6,value:3,onRelease:(power,event)=>releases.push({power,event})});
 const restScale=uniforms.uScale.slice();die.setCharge(2);assert(Math.abs(uniforms.uScale[1]-.82)<1e-12,'button charge caps compression');
 die.setCharge(0);advance(270);assert(maxdiff(restScale,uniforms.uScale)<1e-12,'button cancellation gently releases');assert.equal(releases.length,0);
 now=500;canvas.dispatch('pointerdown',{button:0,pointerId:1});advance(1100);assert(Math.abs(uniforms.uScale[1]-.91)<1e-12,'half charge compresses organically');
 canvas.dispatch('pointerup',{pointerId:2});assert.equal(releases.length,0,'unrelated pointer cannot release a throw');
 canvas.dispatch('pointerup',{pointerId:1});assert.equal(releases.length,1);assert.equal(releases[0].power,.5);assert.equal(releases[0].event.pointerId,1);
 advance(1370);
 now=1400;canvas.dispatch('pointerdown',{button:0,pointerId:1,clientX:100,clientY:100});
 canvas.dispatch('pointermove',{pointerId:1,clientX:101,clientY:116});canvas.dispatch('pointerup',{pointerId:1,clientX:101,clientY:116});assert.equal(releases.length,1,'scroll movement cancels without launching');
 for(const cancellation of ['pointercancel','lostpointercapture','webglcontextlost']){
  now+=10;canvas.dispatch('pointerdown',{button:0,pointerId:1});advance(now+1600);
  canvas.dispatch(cancellation,{pointerId:1,preventDefault(){}});canvas.dispatch('pointerup',{pointerId:1});
  assert.equal(releases.length,1,'cancelled or lost-context press cannot launch');assert.equal(die.busy,false);
 }
 die.destroy();assert.equal(queue.size,0);
 now=0;queue.clear();canvas=makeCanvas();die=window.OndeDice.create(canvas,{kind:6,value:1});
 const lostRoll=die.roll(4,{power:1});advance(500);const inFlight=uniforms.uRotation.slice();
 die.setCharge(1);assert(maxdiff(inFlight,uniforms.uRotation)===0,'charge cannot interrupt a roll');
 numerals=[];canvas.dispatch('webglcontextlost',{preventDefault(){}});assert.equal(await lostRoll,4);assert.equal(die.busy,false);assert.equal(queue.size,0);
 const recoveredInk=numerals.filter(n=>typeof n.ink==='object');assert.equal(recoveredInk.length,1);assert.equal(recoveredInk[0].text,'4','lost context preserves selected bright result in fallback');die.destroy();
 now=0;queue.clear();canvas=makeCanvas();die=window.OndeDice.create(canvas,{kind:6,value:1,reducedMotion:true,onRelease:power=>releases.push({power})});
 const reducedPose=uniforms.uRotation.slice();die.setCharge(1);assert(maxdiff(reducedPose,uniforms.uRotation)===0);assert.deepEqual(uniforms.uScale,[1,1,1],'reduced motion keeps charged die static');
 canvas.dispatch('pointerdown',{button:0,pointerId:1});now=2400;canvas.dispatch('pointerup',{pointerId:1});assert.equal(releases.at(-1).power,1,'native charge clamps at full');
 assert.equal(await die.roll(6,{power:1,duration:0}),6);assert.equal(die.busy,false);assert.equal(uniforms.uResultLight,1);assert.equal(queue.size,0,'reduced motion resolves without animation frames');die.destroy();
 // The real 2D drawing path highlights only the chosen, visible numeral.
 let fallbackValues=[];
 for(const kind of [4,6,20])for(let value=1;value<=kind;value++){
  atlas=[];numerals=[];const die=window.OndeDice.create(makeCanvas(false),{kind,value,reducedMotion:true});assert.equal(die.mode,'fallback');assert(atlas.includes(String(value)),`numeric fallback face ${kind}/${value}`);
  const bright=numerals.filter(n=>typeof n.ink==='object');assert.equal(bright.length,1,`exactly one bright fallback face ${kind}/${value}`);assert.equal(bright[0].text,String(value));
  assert.deepEqual(bright[0].ink.stops.map(s=>s[1]),['rgb(247,246,237)','rgb(250,249,241)','rgb(255,254,248)','rgb(250,249,241)','rgb(247,246,237)'],'restrained ivory specular band');
  fallbackValues.push(`${kind}/${value}`);die.destroy();
 }
 // A category pigment changes the material, never the physical result or its motion.
 now=0;queue.clear();canvas=makeCanvas();die=window.OndeDice.create(canvas,{kind:4,value:2,color:'#92bdc7'});
 assert.deepEqual(uniforms.uColor,[146/255,189/255,199/255],'initial category pigment reaches WebGL');
 die.setKind(20,17);assert.deepEqual(uniforms.uColor,[146/255,189/255,199/255],'category pigment follows the next die');
 const coloredRoll=die.roll(8);advance(300);const coloredPose=uniforms.uRotation.slice(),coloredFrames=queue.size,coloredInk=uniforms.uResultLight;
 die.setColor('#C49BC9');assert.deepEqual(uniforms.uColor,[196/255,155/255,201/255]);
 assert.deepEqual(uniforms.uRotation,coloredPose,'recoloring preserves in-flight pose');assert.equal(queue.size,coloredFrames);assert.equal(die.busy,true);assert.equal(uniforms.uResultLight,coloredInk);assert.equal(die.value,8);
 advance(3000);assert.equal(await coloredRoll,8);die.setColor('url(bogus)');assert.deepEqual(uniforms.uColor,[.7608,.6471,.4706],'invalid pigment safely restores the material default');
 die.setColor('#92bdc7');die.setColor(null);assert.deepEqual(uniforms.uColor,[.7608,.6471,.4706],'new category draw can restore its neutral die');die.destroy();
 const painted=[],previousFill=ctx2d.fill;ctx2d.fill=function(){painted.push(this.fillStyle);};
 const coloredFallback=window.OndeDice.create(makeCanvas(false),{kind:4,value:2,color:'#ff0000',reducedMotion:true});
 assert(painted.some(color=>typeof color==='string'&&/^rgb\(\d+,0,0\)$/.test(color)),'fallback paints the category material');
 painted.length=0;coloredFallback.setColor('#00ff00');assert(painted.some(color=>typeof color==='string'&&/^rgb\(0,\d+,0\)$/.test(color)),'fallback recolors without WebGL');assert.equal(coloredFallback.value,2);coloredFallback.destroy();ctx2d.fill=previousFill;
 // Both MediaQueryList APIs must settle a running die when the preference changes.
 for(const legacy of [false,true]){
  const listeners=new Set(),query={matches:false};
  if(legacy){query.addListener=fn=>listeners.add(fn);query.removeListener=fn=>listeners.delete(fn);}
  else{query.addEventListener=(_event,fn)=>listeners.add(fn);query.removeEventListener=(_event,fn)=>listeners.delete(fn);}
  window.matchMedia=()=>query;now=0;queue.clear();const changing=window.OndeDice.create(makeCanvas(),{kind:4,value:1}),motionRoll=changing.roll(3);advance(300);
  assert.equal(changing.busy,true);for(const listener of listeners)listener({matches:true});assert.equal(await motionRoll,3);assert.equal(changing.busy,false);assert.equal(queue.size,0);
  for(const listener of listeners)listener({matches:false});const resumedRoll=changing.roll(2);assert.equal(changing.busy,true,'motion resumes only after the preference permits it');changing.destroy();assert.equal(await resumedRoll,2);assert.equal(listeners.size,0,'destroy removes the modern or legacy listener');assert.equal(queue.size,0);
 }
 delete window.matchMedia;
 // Idle movement is one bounded breath, with the same volume/contact as a resting die.
 let intersectionChanged,intersectionDisconnected=false;
 sandbox.IntersectionObserver=class{constructor(fn){intersectionChanged=fn;}observe(){}disconnect(){intersectionDisconnected=true;}};
 now=0;queue.clear();canvas=makeCanvas();die=window.OndeDice.create(canvas,{kind:6,value:3,idleMotion:true});
 const idlePose=uniforms.uRotation.slice(),idleScale=uniforms.uScale.slice();assert.equal(queue.size,0,'mounting does not secretly start ambient work');
 assert.equal(die.breathe(),true);advance(550);assert(maxdiff(uniforms.uRotation,idlePose)>1e-5,'the seated object breathes gently');assert(Math.abs(uniforms.uScale.reduce((volume,value)=>volume*value,1)-1)<1e-12,'soft deformation preserves volume');
 assert(Math.abs(uniforms.uPosition[1]-uniforms.uScale[1]*q.support(6,uniforms.uRotation)-.002)<1e-6,'breathing keeps contact with the floor');
 assert.equal(die.breathe(),false,'a second request cannot extend a running breath');advance(2200);assert.equal(queue.size,0,'ambient work stops after one 2.2 second cycle');assert.deepEqual(uniforms.uRotation,idlePose);assert.deepEqual(uniforms.uScale,idleScale);assert.equal(die.value,3);
 die.breathe();advance(2500);die.setCharge(.5);assert.equal(queue.size,0,'press feedback takes over idle movement immediately');assert(Math.abs(uniforms.uScale[1]-.91)<1e-12);assert.notEqual(uniforms.uScale[0],uniforms.uScale[2],'pressure spreads the material asymmetrically');assert(Math.abs(uniforms.uScale.reduce((volume,value)=>volume*value,1)-1)<1e-12);
 const chargedScale=uniforms.uScale.slice(),chargedPose=uniforms.uRotation.slice(),idleRoll=die.roll(5);advance(2500);assert.deepEqual(uniforms.uScale,chargedScale,'launch begins at the visible compressed shape');assert.deepEqual(uniforms.uRotation,chargedPose);
 advance(5100);assert.equal(await idleRoll,5);assert.equal(die.busy,false);assert.equal(queue.size,1,'landing may invite the next interaction without delaying its result');
 die.pauseMotion();assert.equal(queue.size,0);assert.deepEqual(uniforms.uScale,[1,1,1]);
 die.breathe();advance(5500);intersectionChanged([{isIntersecting:false}]);assert.equal(queue.size,0,'offscreen ambient work stops');assert.equal(die.breathe(),false);intersectionChanged([{isIntersecting:true}]);assert.equal(queue.size,0,'scrolling back never restarts idle motion by itself');
 die.breathe();sandbox.document.hidden=true;for(const listener of documentHandlers.get('visibilitychange'))listener();assert.equal(queue.size,0,'hidden-page ambient work stops');assert.equal(die.breathe(),false);sandbox.document.hidden=false;
 die.breathe();die.setReducedMotion(true);assert.equal(queue.size,0);assert.equal(die.breathe(),false);assert.deepEqual(uniforms.uScale,[1,1,1]);die.setReducedMotion(false);
 const hiddenRoll=die.roll(6);sandbox.document.hidden=true;for(const listener of documentHandlers.get('visibilitychange'))listener();assert.equal(await hiddenRoll,6);assert.equal(queue.size,0,'a hidden roll resolves without starting a breath');sandbox.document.hidden=false;
 die.breathe();die.destroy();assert.equal(queue.size,0);assert.equal(intersectionDisconnected,true);delete sandbox.IntersectionObserver;
 fs.writeFileSync('/tmp/onde-dice-shaders.json',JSON.stringify({vertex:q.VERTEX,fragment:q.FRAGMENT}));
 console.log(JSON.stringify({status:'PASS',poses,minimumResultVisibility:minVisible,continuousPhaseJoins:joins,continuousInkJoins:inkJoins,maximumJoinDelta:worstJoin,forceAngularTravel:trajectories.map(t=>t.distance),forceCannotChangeResult:true,nativePressCancellation:true,initialThreeQuarterPose:true,restPosePreserved:true,rollCancellation:true,reducedMotion:true,runtimeMotionPreference:true,legacyMotionPreference:true,categoryPigment:true,inFlightPigmentPreservesPose:true,fallbackPigment:true,boundedIdleBreath:true,idleStopsOffscreen:true,idleStopsWhenHidden:true,volumePreservedDuringPressure:true,chargedLaunchIsContinuous:true,dpr2:[904,476],fallbackNumericResults:fallbackValues,shaderCompile:'Not validated by mock; shader sources exported for optional real compiler.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
