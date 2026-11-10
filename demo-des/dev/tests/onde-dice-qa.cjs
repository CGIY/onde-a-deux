const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const filename=require('node:path').join(__dirname,'../src/onde-app-dice.js');
const src=fs.readFileSync(filename,'utf8').replace(/global\.OndeDice=Object\.freeze\(\{[^}]*\}\);/,'$&global.__qa={CUBE_FACES,POLYS,ICON_PATHS,targetRotation,initialRotation,matrix,transform,support,clampPower,rollDuration,cameraOffset,FRAGMENT,VERTEX};');
let now=0,nextRaf=0,queue=new Map(),uniforms={},labels=[],atlas=[],numerals=[],pictograms=[],documentHandlers=new Map(),glyphCenter=null;
const gradient=()=>({stops:[],addColorStop(at,color){this.stops.push([at,color]);}});
const selectedEngraving=mark=>mark.ink?.stops?.some(([,color])=>color==='rgba(188,196,207,0.66)');
const ctx2d=new Proxy({createRadialGradient:gradient,createLinearGradient:gradient,fillText(text){atlas.push(String(text));numerals.push({text:String(text),ink:this.fillStyle});},fill(path,rule){if(path?.d)pictograms.push({path:path.d,ink:this.fillStyle,rule});},transform(_a,_b,_c,_d,x,y){glyphCenter=[x,y];},stroke(path){if(path?.d)pictograms.push({path:path.d,ink:this.strokeStyle,rule:"stroke",center:glyphCenter});}}, {get(o,p){return p in o?o[p]:()=>{}},set(o,p,v){o[p]=v;return true;}});
const gl=new Proxy({VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_p,n)=>n,getAttribLocation:()=>0,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),uniformMatrix3fv(n,_transpose,a){uniforms[n]=Array.from(a);},uniform3fv(n,a){uniforms[n]=Array.from(a);},uniform3f(n,...a){uniforms[n]=a;},uniform2f(n,...a){uniforms[n]=a;},uniform4f(n,...a){uniforms[n]=a;},uniform1f(n,a){uniforms[n]=a;},uniform1i(n,a){uniforms[n]=a;}},{get(o,p){return p in o?o[p]:()=>{}}});
const makeCanvas=(useWebgl=true)=>({width:0,height:0,clientWidth:452,clientHeight:238,style:{},listeners:new Map(),getContext:type=>type==='webgl'?(useWebgl?gl:null):ctx2d,setAttribute(n,v){labels.push([n,v]);},addEventListener(n,fn){this.listeners.set(n,fn);},removeEventListener(n){this.listeners.delete(n);},dispatch(n,event={}){this.listeners.get(n)?.(event);},setPointerCapture(){},toDataURL:()=>''});
const window={devicePixelRatio:3,addEventListener(){},removeEventListener(){}};
const sandbox={window,Path2D:class{constructor(d){this.d=d;}},document:{createElement:()=>makeCanvas(false),addEventListener(name,fn){if(!documentHandlers.has(name))documentHandlers.set(name,new Set());documentHandlers.get(name).add(fn);},removeEventListener(name,fn){documentHandlers.get(name)?.delete(fn);}},performance:{now:()=>now},requestAnimationFrame(fn){queue.set(++nextRaf,fn);return nextRaf;},cancelAnimationFrame(id){queue.delete(id);},console};
vm.createContext(sandbox);vm.runInContext(src,sandbox);const q=window.__qa;
vm.runInContext('Math.random=()=>.5',sandbox);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>a.map(x=>x/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],maxdiff=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
const view=norm([4.3,5.25,6.4]);let poses=0,minVisible=1;
const octahedron=q.POLYS[8].faces;
assert.equal(octahedron.length,8,'octahedron has eight faces');
assert.equal(new Set(octahedron.flatMap(f=>f.points.map(p=>p.join(',')))).size,6,'octahedron has six vertices');
for(let i=0;i<octahedron.length;i++){
 const {n,b,h,points}=octahedron[i];
 assert.equal(points.length,3,'octahedron faces are triangular');
 for(const vertex of points)assert(Math.abs(dot(n,vertex)-h)<1e-12,'face points lie on the face plane');
 assert(Math.abs(dot(n,octahedron[7-i].n)+1)<1e-12,'opposing D8 results sum to nine');
 assert(dot(b,points[1])>0,'each number faces its triangular tip');
 const distance=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));
 assert(Math.abs(distance(points[0],points[1])-distance(points[1],points[2]))<1e-12);
 assert(Math.abs(distance(points[1],points[2])-distance(points[2],points[0]))<1e-12);
}
for(const kind of [4,6,8,20])for(let value=1;value<=kind;value++){
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
 // Waiting for the server animates immediately without inventing a result,
 // and can be interrupted by an error or by the authoritative roll.
 {
  now=0;queue.clear();const die=window.OndeDice.create(makeCanvas(),{kind:6,value:1});
  const initial=uniforms.uRotation.slice();assert.equal(die.startWaiting(),true);advance(300);
  assert(maxdiff(initial,uniforms.uRotation)>.01,'pending request moves the die');
  assert.equal(uniforms.uValue,1,'pending animation does not choose a result');
  die.stopWaiting();assert.equal(queue.size,0,'a failed request cancels pending motion');
  assert.equal(die.startWaiting(),true);advance(600);const done=die.roll(5,{durationMs:900});
  advance(1501);assert.equal(await done,5,'server result remains authoritative');
  die.setReducedMotion(true);assert.equal(die.startWaiting(),false,'reduced motion skips pending animation');
  die.destroy();now=0;queue.clear();
 }
 for(const kind of [4,6,8,20]){
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
 // A late live snapshot catches up to its server timeline instead of starting over.
 {
  now=0;queue.clear();const live=window.OndeDice.create(makeCanvas(),{kind:20,value:1});
  const result=live.roll(17,{durationMs:2200,elapsedMs:1700});
  advance(499);assert.equal(live.busy,true,'late live roll keeps only its remaining 500ms');
  advance(501);assert.equal(await result,17);assert.equal(live.busy,false,'shared reveal deadline is preserved');
  live.destroy();now=0;queue.clear();
 }
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
 // Swipes move the die in the requested screen direction without changing its result.
 for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){
  now=0;queue.clear();const die=window.OndeDice.create(makeCanvas(),{kind:6,value:1});
  const done=die.roll(5,{direction,durationMs:1650});
  const middle=advance(1650*(160+500)/2250),screen=q.cameraOffset(middle.p),center=q.cameraOffset([0,middle.p[1],0]);
  const dx=screen[0]-center[0],dy=screen[1]-center[1];
  assert(dx*direction.x+dy*direction.y>0,'movement follows the swipe on screen');
  advance(1651);assert.equal(await done,5,'swipe direction never changes the result');die.destroy();
 }
 // Every motion/ink transition stays continuous with the extra revolutions.
 for(const kind of [4,6,8,20])for(const power of [0,.5,1]){
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
 for(const kind of [4,6,8,20])for(let value=1;value<=kind;value++){
  atlas=[];numerals=[];const die=window.OndeDice.create(makeCanvas(false),{kind,value,reducedMotion:true});assert.equal(die.mode,'fallback');assert(atlas.includes(String(value)),`numeric fallback face ${kind}/${value}`);
  const bright=numerals.filter(n=>typeof n.ink==='object');assert.equal(bright.length,1,`exactly one bright fallback face ${kind}/${value}`);assert.equal(bright[0].text,String(value));
  assert.deepEqual(bright[0].ink.stops.map(s=>s[1]),['rgb(232,226,212)','rgb(236,230,218)','rgb(239,232,220)','rgb(234,229,215)','rgb(230,225,212)'],'muted ivory specular band');
  fallbackValues.push(`${kind}/${value}`);die.destroy();
 }
 // Pictograms change the atlas while accessible labels and numeric results remain available.
 {
  const categories=['Cocon','Offrandes','Aventures','Braises'];
  const cards=['Paper','Selfie','Massage','Soin','Soirée','No Phone','Kiss','Aide'];
  const categoryIcons=['heart','coins','tent','flame'];
  const cardIcons=['note','camera','massage','polish','moon','phone-off','kiss','help'];
  atlas=[];labels=[];pictograms=[];
  const die=window.OndeDice.create(makeCanvas(),{kind:4,value:3,labels:categories,icons:categoryIcons,reducedMotion:true});
  assert.equal(die.getResultAnchor(),null,'the preview face has no result anchor');
  assert.deepEqual(pictograms.map(mark=>mark.path),categoryIcons.map(key=>q.ICON_PATHS[key]),'D4 atlas engraves Lucide pictograms in face order');
  assert.ok(pictograms.every(mark=>mark.rule==='stroke'),'engraved contours leave the mineral visible');
  assert.deepEqual(uniforms.uColor,[.19,.25,.36],'the pictogram D4 uses dark slate');
  const neutralRim=uniforms.uRimColor;
  die.setColor('#e3bd8b');
  assert.deepEqual(uniforms.uColor,[.19,.25,.36],'the category tint leaves the body dark');
  assert.notDeepEqual(uniforms.uRimColor,neutralRim,'the category tint reaches the rim');
  die.setColor(null);
  assert.equal(atlas.length,0,'icons replace visible text');
  assert.equal(uniforms.uAtlasRows,1,'D4 icons use only their occupied row');
  assert.equal(uniforms.uValue,3);
  assert(labels.at(-1)[1].endsWith('Aventures.'),'screen readers announce the face word');
  die.setLabels(categories.slice(),categoryIcons.slice());
  assert.equal(pictograms.length,categoryIcons.length,'repeating the same icons avoids an upload');
  die.setKind(8,6);
  assert.deepEqual(uniforms.uIconScale,[0,0],'changing die type restores numeric marks');
  assert.equal(uniforms.uAtlasRows,8,'numeric atlas retains its original layout');
  assert(labels.at(-1)[1].endsWith('6.'));
  die.setLabels(cards,cardIcons);
  assert.deepEqual(pictograms.slice(-cardIcons.length).map(mark=>mark.path),cardIcons.map(key=>q.ICON_PATHS[key]),'D8 atlas follows card order');
  assert.equal(uniforms.uAtlasRows,2,'the second D8 icon row is addressable');
  assert.equal(new Set([...categoryIcons,...cardIcons].map(key=>q.ICON_PATHS[key])).size,12,'all twelve icons have distinct outlines');
  assert.deepEqual(uniforms.uColor,[.165,.11,.235],'Cocon keeps its dark mauve material');
  assert.equal(await die.roll(5),5);
  assert(labels.at(-1)[1].endsWith('Soirée.'));
  const anchor=die.getResultAnchor();
  assert(anchor&&anchor.x>.4&&anchor.x<.6&&anchor.y>.2&&anchor.y<.5,'the upper D8 face is anchored above the canvas midpoint');
  die.setKind(8,5);
  assert.equal(die.getResultAnchor().y,anchor.y,'rendering the same result retains its anchor');
  die.setCharge(1);
  assert.equal(die.getResultAnchor(),null,'pressure hides the settled anchor');
  die.setCharge(0);
  die.setReducedMotion(false);
  const pendingResult=die.roll(8);
  assert.equal(die.getResultAnchor(),null,'moving dice have no result anchor');
  die.setReducedMotion(true);
  assert.equal(await pendingResult,8);
  assert(die.getResultAnchor(),'the new result is anchored when its animation settles');
  assert.throws(()=>die.setLabels(categories),/each face/);
  assert.throws(()=>die.setLabels(new Array(8)),/nonempty/);
  assert.throws(()=>die.setLabels(cards,categoryIcons),/each face/);
  assert.throws(()=>die.setLabels(cards,cardIcons.map(()=> 'unknown')),/Unknown dice pictogram/);
  atlas=[];pictograms=[];die.setLabels(null);die.setLabels(cards,cardIcons);die.setKind(4,1);die.setLabels(categories,categoryIcons);
  assert.deepEqual(atlas,[],'numeric, D4 and D8 textures stay cached across stages');
  assert.deepEqual(pictograms,[],'cached icons require no new drawing');
  die.destroy();
  const additionalD8=[
   ['#3b2a1c',['shirt','book-open','sandwich','utensils','cookie','coffee','shopping-basket','gift']],
   ['#163239',['footprints','camera','palette','map','armchair','archive','compass','telescope']],
   ['#411d32',['speech','zap','vibrate','aperture','webcam','image-up','link','target']]
  ];
  for(const [color,icons] of additionalD8){
   pictograms=[];
   const themed=window.OndeDice.create(makeCanvas(),{kind:8,labels:icons,icons,reducedMotion:true});
   assert.deepEqual(pictograms.map(mark=>mark.path),icons.map(key=>q.ICON_PATHS[key]),'each D8 glyph maps to the correct atlas cell');
   assert.equal(new Set(pictograms.map(mark=>mark.path)).size,8,'the eight faces have distinct outlines');
   const neutralRim=uniforms.uRimColor;
   themed.setColor(color);
   assert.deepEqual(uniforms.uColor,[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255),'D8 accepts the mineral pigment');
   assert.notDeepEqual(uniforms.uRimColor,neutralRim,'the D8 pigment also tints its reflection');
   assert.equal(await themed.roll(8),8);
   assert(themed.getResultAnchor(),'the eighth glyph keeps its HUD anchor');
   themed.setColor(null);
   assert.deepEqual(uniforms.uColor,[.165,.11,.235],'removing the tint restores Cocon mauve');
   themed.destroy();
  }
  const fallbackCanvas=makeCanvas(false);
  const fallback=window.OndeDice.create(fallbackCanvas,{kind:8,value:6,labels:cards,icons:cardIcons,reducedMotion:true});
  pictograms=[];assert.equal(await fallback.roll(6),6);
  assert.deepEqual(pictograms.filter(selectedEngraving).map(mark=>mark.path),[q.ICON_PATHS['phone-off']]);
  const fallbackAnchor=fallback.getResultAnchor();
  const [cx,cy]=pictograms.find(selectedEngraving).center;
  const side=Math.min(fallbackCanvas.width,fallbackCanvas.height);
  assert(Math.abs(fallbackAnchor.x-(.5+(cx/480-.5)*side/fallbackCanvas.width))<1e-12);
  assert(Math.abs(fallbackAnchor.y-(.5+(cy/480-.5)*side/fallbackCanvas.height))<1e-12);
  numerals=[];fallback.setLabels(null);
  assert.equal(fallback.getResultAnchor(),null,'numeric fallback faces have no glyph anchor');
  assert.deepEqual(numerals.filter(mark=>typeof mark.ink==='object').map(mark=>mark.text),['6']);
  fallback.destroy();
  assert.equal(fallback.getResultAnchor(),null,'a destroyed die has no glyph anchor');
 }
 // A variant D6 can use the same engraved material and settled anchor as the D8.
 {
  const icons=['heart','coins','tent','flame','note','camera'],color='#411d32';
  for(const useWebgl of [true,false]){
   atlas=[];pictograms=[];
   const canvas=makeCanvas(useWebgl),die=window.OndeDice.create(canvas,{kind:6,labels:icons,icons,color,reducedMotion:true});
   assert.equal(die.getResultAnchor(),null,'an unrolled D6 keeps its anchor hidden');
   if(useWebgl){
    assert.deepEqual(pictograms.map(mark=>mark.path),icons.map(key=>q.ICON_PATHS[key]),'the D6 atlas matches each face to its glyph');
    assert.equal(uniforms.uAtlasRows,2);
    assert.deepEqual(uniforms.uColor,[65/255,29/255,50/255],'the D6 retains its themed pigment');
   }
   for(let value=1;value<=6;value++){
    pictograms=[];
    assert.equal(await die.roll(value),value);
    const anchor=die.getResultAnchor();
    assert(anchor&&anchor.x>.4&&anchor.x<.6&&anchor.y>.2&&anchor.y<.5,'each result anchor is on the top face');
    assert(labels.at(-1)[1].endsWith(icons[value-1]+'.'),'the spoken result matches the selected glyph');
    if(!useWebgl){
     const mark=pictograms.find(selectedEngraving);
     assert.equal(mark.path,q.ICON_PATHS[icons[value-1]]);
     const [x,y]=mark.center,side=Math.min(canvas.width,canvas.height);
     assert(Math.abs(anchor.x-(.5+(x/480-.5)*side/canvas.width))<1e-12);
     assert(Math.abs(anchor.y-(.5+(y/480-.5)*side/canvas.height))<1e-12);
    }
   }
   assert.deepEqual(atlas,[],'there is no numeral in the engraved D6 atlas');
   die.setLabels(null);
   assert.equal(die.getResultAnchor(),null,'a numeric D6 keeps the existing presentation');
   assert(atlas.includes('6'));
   die.destroy();
  }
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
